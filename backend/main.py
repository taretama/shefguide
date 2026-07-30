from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import users_collection, sessions_collection, checklists_collection, posts_collection, security_events_collection
from auth import hash_password, check_password, make_token, decode_token
from datetime import datetime
from bson import ObjectId
from llm import ask_llm
from security import check_prompt_injection, redact_pii, check_rate_limit
import json
import re
import pdfplumber
import io
from fastapi import UploadFile, File

app = FastAPI()
@app.get("/")
def home():
    return {"message": "ShefGuide backend is running"}

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

def get_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(401, "Invalid token")
    return user_id

def require_disclosure(user_id: str):
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("disclosure_accepted"):
        raise HTTPException(403, "Please accept the cloud data disclosure first")

def require_rate_limit(user_id: str, endpoint: str):
    if not check_rate_limit(user_id, endpoint):
        raise HTTPException(429, "Too many requests. Please wait a minute and try again.")

def guard_and_redact(user_id: str, endpoint: str, text: str) -> str:
    if check_prompt_injection(text):
        security_events_collection.insert_one({
            "user_id":    user_id,
            "event_type": "prompt_injection_blocked",
            "endpoint":   endpoint,
            "created_at": datetime.utcnow()
        })
        raise HTTPException(
            400,
            "This message could not be processed because it appears to try to "
            "change the assistant's instructions. Please rephrase your question."
        )

    clean_text, redacted_count = redact_pii(text)
    if redacted_count:
        security_events_collection.insert_one({
            "user_id":    user_id,
            "event_type": "pii_redacted",
            "endpoint":   endpoint,
            "created_at": datetime.utcnow()
        })
    return clean_text

@app.get("/me")
def get_me(authorization: str = Header(...)):
    user_id = get_user(authorization)
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    return {
        "email": user["email"],
        "university": user["university"],
        "home_country": user["home_country"],
        "programme": user["programme"],
        "disclosure_accepted": bool(user.get("disclosure_accepted"))
    }

@app.post("/consent/cloud-disclosure")
def accept_disclosure(authorization: str = Header(...)):
    user_id = get_user(authorization)
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "disclosure_accepted":    True,
            "disclosure_accepted_at": datetime.utcnow()
        }}
    )
    return {"message": "Disclosure accepted"}

class RegisterBody(BaseModel):
    email: str
    password: str
    university: str
    home_country: str
    programme: str

@app.post("/auth/register")
def register(body: RegisterBody):
    if users_collection.find_one({"email": body.email}):
        raise HTTPException(400, "Email already registered")
    result = users_collection.insert_one({
        "email": body.email,
        "password_hash": hash_password(body.password),
        "university": body.university,
        "home_country": body.home_country,
        "programme": body.programme,
        "created_at": datetime.utcnow()
    })
    return {"token": make_token(str(result.inserted_id))}

class LoginBody(BaseModel):
    email: str
    password: str

@app.post("/auth/login")
def login(body: LoginBody):
    user = users_collection.find_one({"email": body.email})
    if not user or not check_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Wrong email or password")
    return {"token": make_token(str(user["_id"]))}

class ChatBody(BaseModel):
    messages: list
    model: str = "gpt"   # "gpt" or "gemini"
    session_id: str | None = None

@app.post("/chat")
def chat(body: ChatBody, authorization: str = Header(...)):
    user_id = get_user(authorization)
    require_disclosure(user_id)
    require_rate_limit(user_id, "/chat")

    messages = list(body.messages)
    pii_redacted = False
    if messages:
        clean_content = guard_and_redact(user_id, "/chat", messages[-1]["content"])
        pii_redacted = clean_content != messages[-1]["content"]
        messages[-1] = {**messages[-1], "content": clean_content}

    result     = ask_llm(messages, model=body.model)
    reply      = result["reply"]
    latency    = result["latency"]
    model_used = result["model_used"]

    all_messages = body.messages + [{"role": "assistant", "content": reply}]

    if body.session_id:
        sessions_collection.update_one(
            {"_id": ObjectId(body.session_id)},
            {"$set": {"messages": all_messages}}
        )
        sid = body.session_id
    else:
        res = sessions_collection.insert_one({
            "user_id":     user_id,
            "model_used":  model_used,
            "latency_sec": latency,
            "messages":    all_messages,
            "created_at":  datetime.utcnow()
        })
        sid = str(res.inserted_id)

    return {
        "reply":        reply,
        "session_id":   sid,
        "latency":      latency,
        "model_used":   model_used,
        "pii_redacted": pii_redacted
    }

@app.get("/sessions")
def get_sessions(authorization: str = Header(...)):
    user_id = get_user(authorization)

    sessions = list(
        sessions_collection.find(
            {"user_id": user_id},
            {"messages": 0}
        )
        .sort("created_at", -1)
        .limit(20)
    )

    for s in sessions:
        s["_id"] = str(s["_id"])

    return {
        "sessions": sessions
    }


@app.get("/sessions/{session_id}")
def get_session(session_id: str, authorization: str = Header(...)):
    user_id = get_user(authorization)

    s = sessions_collection.find_one({
        "_id": ObjectId(session_id),
        "user_id": user_id
    })

    if not s:
        raise HTTPException(404, "Not found")

    s["_id"] = str(s["_id"])

    return s

@app.post("/checklist/generate")
def generate_checklist(authorization: str = Header(...)):
    user_id = get_user(authorization)
    require_rate_limit(user_id, "/checklist/generate")
    user = users_collection.find_one({"_id": ObjectId(user_id)})

    prompt = f"""Generate a personalised UK university arrival checklist for:
Home country: {user['home_country']}
Programme: {user['programme']}
University: {user['university']}

Return ONLY a JSON array. Each item must have:
- task: short title, max 8 words
- explanation: why it matters for someone from their country, 2 sentences
- priority: "urgent" or "first_week" or "first_month"

Include 12 tasks covering: GP registration, bank account, university IT, 
accommodation, transport, student union, UKCISA rights, academic support.
Return only the JSON array. No other text."""

    result = ask_llm(
    [{"role": "user", "content": prompt}],
    model="gpt"
   )

    raw = result["reply"]
    
    # Clean the response in case GPT wraps it in markdown
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    tasks = json.loads(raw)
    
    checklists_collection.update_one(
        {"user_id": user_id},
        {"$set": {"items": tasks, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    return {"tasks": tasks}

@app.get("/checklist")
def get_checklist(authorization: str = Header(...)):
    user_id = get_user(authorization)
    checklist = checklists_collection.find_one({"user_id": user_id})
    if not checklist:
        return {"tasks": []}
    return {"tasks": checklist["items"]}

# ── COMMUNITY Q&A ─────────────────────────────────────────────────────────────

class PostBody(BaseModel):
    question: str
    category: str = "general"
    # category options: "academic", "arrival", "technology", "general"


@app.post("/posts")
def create_post(body: PostBody, authorization: str = Header(...)):
    user_id = get_user(authorization)

    # If exact question already exists, return the existing one
    # This prevents duplicate posts of the same question
    existing = posts_collection.find_one({"question": body.question})
    if existing:
        existing["_id"] = str(existing["_id"])
        return {
            "message":  "A similar question already exists",
            "post_id":  existing["_id"],
            "question": existing["question"],
            "ai_answer": existing.get("ai_answer")
        }

    result = posts_collection.insert_one({
        "user_id":    user_id,
        "question":   body.question,
        "category":   body.category,
        "replies":    [],
        "ai_answer":  None,
        "created_at": datetime.utcnow()
    })
    return {"post_id": str(result.inserted_id), "question": body.question}


@app.get("/posts")
def list_posts(category: str = None, authorization: str = Header(...)):
    get_user(authorization)
    query = {}
    if category:
        query["category"] = category
    posts = list(posts_collection.find(query).sort("created_at", -1).limit(50))
    for p in posts:
        p["_id"]         = str(p["_id"])
        p["reply_count"] = len(p.get("replies", []))
    return {"posts": posts}


@app.get("/posts/search/{query}")
def search_posts(query: str, authorization: str = Header(...)):
    get_user(authorization)
    posts = list(posts_collection.find(
        {"question": {"$regex": re.escape(query), "$options": "i"}}
    ).limit(10))
    for p in posts:
        p["_id"] = str(p["_id"])
    return {"results": posts, "count": len(posts)}


@app.get("/posts/{post_id}")
def get_post(post_id: str, authorization: str = Header(...)):
    get_user(authorization)
    post = posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")
    post["_id"] = str(post["_id"])
    return post


class ReplyBody(BaseModel):
    text: str


@app.post("/posts/{post_id}/reply")
def add_reply(post_id: str, body: ReplyBody, authorization: str = Header(...)):
    user_id = get_user(authorization)
    posts_collection.update_one(
        {"_id": ObjectId(post_id)},
        {"$push": {"replies": {
            "user_id":    user_id,
            "text":       body.text,
            "created_at": datetime.utcnow()
        }}}
    )
    return {"message": "Reply added"}


class AIAnswerBody(BaseModel):
    model: str = "gpt"


@app.post("/posts/{post_id}/ai-answer")
def generate_ai_answer(post_id: str, body: AIAnswerBody,
                        authorization: str = Header(...)):
    user_id = get_user(authorization)
    require_disclosure(user_id)
    require_rate_limit(user_id, "/posts/ai-answer")

    post = posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")

    # CACHING — if AI answer already exists, return it immediately
    # Never re-call the API for the same question
    if post.get("ai_answer"):
        return {
            "message":   "Returning cached answer",
            "ai_answer": post["ai_answer"],
            "cached":    True
        }

    # No cached answer yet — generate one
    clean_question = guard_and_redact(user_id, "/posts/ai-answer", post["question"])
    result = ask_llm(
        [{"role": "user", "content": clean_question}],
        model=body.model
    )

    ai_answer = {
        "text":         result["reply"],
        "model_used":   result["model_used"],
        "latency_sec":  result["latency"],
        "generated_at": datetime.utcnow()
    }

    # Save permanently on the post — this is the cache
    posts_collection.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": {"ai_answer": ai_answer}}
    )

    return {"message": "AI answer generated", "ai_answer": ai_answer, "cached": False}

# ── DOCUMENT EXPLAINER (RAG-lite) ─────────────────────────────────────────────

# Stores extracted PDF text per user in memory
# Key = user_id, Value = extracted text string
document_store = {}


@app.post("/document/upload")
async def upload_document(
    file: UploadFile = File(...),
    authorization: str = Header(...)
):
    user_id  = get_user(authorization)
    contents = await file.read()

    extracted = ""
    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                extracted += text + "\n"

    if not extracted.strip():
        raise HTTPException(
            400,
            "Could not extract text. Make sure the PDF is not a scanned image."
        )

    # Limit to 12,000 characters — enough for most assignment briefs
    document_store[user_id] = extracted[:12000]
    word_count = len(extracted.split())

    return {
        "message":    "Document uploaded",
        "word_count": word_count
    }


class DocumentAskBody(BaseModel):
    question: str
    model:    str = "gpt"


@app.post("/document/ask")
def ask_document(body: DocumentAskBody, authorization: str = Header(...)):
    user_id  = get_user(authorization)
    require_disclosure(user_id)
    require_rate_limit(user_id, "/document/ask")
    doc_text = document_store.get(user_id)

    if not doc_text:
        raise HTTPException(400, "No document uploaded yet. Please upload a PDF first.")

    clean_question = guard_and_redact(user_id, "/document/ask", body.question)

    # This is the RAG prompt — document text is injected directly as context
    rag_prompt = f"""You are helping a student understand their document.

DOCUMENT:
{doc_text}

STUDENT QUESTION: {clean_question}

Rules:
- Answer ONLY from the document above
- If the answer is not in the document, say:
  "I could not find that in your document. Please check with your tutor."
- Quote the relevant part so the student can see where the answer comes from
- Keep it clear and simple"""

    result = ask_llm([{"role": "user", "content": rag_prompt}], model=body.model)
    return {"reply": result["reply"], "latency": result["latency"]}
