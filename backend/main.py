from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import (users_collection, sessions_collection, checklists_collection,
                      posts_collection, security_events_collection,
                      knowledge_collection, document_chunks_collection)
from auth import hash_password, check_password, make_token, decode_token
from datetime import datetime
from bson import ObjectId
from llm import ask_llm
from security import check_prompt_injection, redact_pii, check_rate_limit
import rag
import json
import re
import pdfplumber
import io
import math
import os
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import UploadFile, File

app = FastAPI()
@app.get("/")
def home():
    return {"message": "ShefGuide backend is running"}

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# How many passages to pull from each source for a single answer. The
# knowledge base gets the larger share because it is the assistant's own
# background; the document is usually short and highly targeted.
KB_TOP_K = 3
DOC_TOP_K = 3

# A visitor can use the AI chat without registering, but not indefinitely: the
# calls cost money and there is no account to attribute abuse to. The cap is
# generous enough to answer a real question and follow it up, which is what the
# trial needs to demonstrate.
GUEST_CHAT_LIMIT = 5


def retrieve_context(user_id: str, question: str) -> tuple[str | None, list[str]]:
    """Search the curated knowledge base and the student's attached document.

    Returns the formatted context block (or None) plus a short list of source
    labels, so the caller can report what an answer was actually grounded in.
    """
    try:
        query_vec = rag.embed_one(question)
    except Exception:
        # Retrieval must never take the chat down; fall back to no context.
        return None, []

    kb_records = list(knowledge_collection.find({}, {"_id": 0}))
    kb_hits = rag.top_matches(query_vec, kb_records, KB_TOP_K)

    doc_records = list(document_chunks_collection.find({"user_id": user_id}, {"_id": 0}))
    doc_hits = rag.top_matches(query_vec, doc_records, DOC_TOP_K)

    sources: list[str] = []
    seen = set()
    for h in kb_hits:
        label = f"ShefGuide guidance: {h.get('title', 'general')}"
        if label not in seen:
            seen.add(label)
            sources.append(label)
    if doc_hits:
        fname = doc_hits[0].get("filename") or "attached document"
        sources.append(f"Your document: {fname}")

    return rag.build_context_block(kb_hits, doc_hits), sources

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

def is_guest(user_id: str) -> bool:
    """Read the guest flag from the stored account, not from the token.

    The token's 'guest' claim is signed, so it cannot be flipped either — but
    checking the database keeps a single source of truth, which matters when a
    guest upgrades to a real account and their existing token is still valid.
    """
    user = users_collection.find_one({"_id": ObjectId(user_id)}, {"is_guest": 1})
    return bool(user and user.get("is_guest"))

def require_full_account(user_id: str, feature: str = "This feature"):
    if is_guest(user_id):
        raise HTTPException(
            403,
            f"{feature} needs a free account. Your guest conversation will be "
            f"kept when you register."
        )

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
    guest = bool(user.get("is_guest"))
    return {
        "email": user.get("email"),
        "university": user.get("university"),
        "home_country": user.get("home_country"),
        "programme": user.get("programme"),
        "disclosure_accepted": bool(user.get("disclosure_accepted")),
        "is_guest": guest,
        "messages_remaining": (
            max(0, GUEST_CHAT_LIMIT - user.get("guest_messages_used", 0))
            if guest else None
        )
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

@app.post("/auth/guest")
def start_guest_session():
    """Start using ShefGuide without registering.

    A guest is a real (if anonymous) account row rather than a special case
    threaded through every endpoint: everything downstream — rate limiting,
    disclosure, session storage, retrieval — keeps working unchanged, and the
    account can later be upgraded in place so nothing the visitor did is lost.
    """
    result = users_collection.insert_one({
        "email": None,
        "password_hash": None,
        "university": None,
        "home_country": None,
        "programme": None,
        "is_guest": True,
        "guest_messages_used": 0,
        "created_at": datetime.utcnow()
    })
    return {
        "token": make_token(str(result.inserted_id), guest=True),
        "is_guest": True,
        "messages_allowed": GUEST_CHAT_LIMIT
    }

class RegisterBody(BaseModel):
    email: str
    password: str
    university: str
    home_country: str
    programme: str
    arrival_date: str | None = None

@app.post("/auth/register")
def register(body: RegisterBody, authorization: str | None = Header(None)):
    if users_collection.find_one({"email": body.email}):
        raise HTTPException(400, "Email already registered")

    fields = {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "university": body.university,
        "home_country": body.home_country,
        "programme": body.programme,
        "arrival_date": body.arrival_date,
    }

    # If a guest is registering, upgrade the account they already have rather
    # than creating a second one. Their conversation history, disclosure
    # acceptance and any attached document carry over, so registering does not
    # feel like starting again.
    if authorization:
        guest_id = decode_token(authorization.replace("Bearer ", ""))
        if guest_id and is_guest(guest_id):
            users_collection.update_one(
                {"_id": ObjectId(guest_id)},
                {
                    "$set": {**fields, "is_guest": False,
                             "upgraded_at": datetime.utcnow()},
                    "$unset": {"guest_messages_used": ""}
                }
            )
            return {"token": make_token(guest_id), "upgraded_from_guest": True}

    result = users_collection.insert_one({**fields, "is_guest": False,
                                          "created_at": datetime.utcnow()})
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

    # Guests get a fixed number of answers before being asked to register. The
    # counter is incremented only once the answer has actually been produced,
    # so a failed request does not silently consume the visitor's trial.
    guest = is_guest(user_id)
    if guest:
        used = users_collection.find_one(
            {"_id": ObjectId(user_id)}, {"guest_messages_used": 1}
        ).get("guest_messages_used", 0)
        if used >= GUEST_CHAT_LIMIT:
            raise HTTPException(
                403,
                f"You have used all {GUEST_CHAT_LIMIT} free questions. Create a "
                f"free account to keep going — this conversation will be saved."
            )

    messages = list(body.messages)
    pii_redacted = False
    if messages:
        clean_content = guard_and_redact(user_id, "/chat", messages[-1]["content"])
        pii_redacted = clean_content != messages[-1]["content"]
        messages[-1] = {**messages[-1], "content": clean_content}

    # Retrieve the most relevant passages from ShefGuide's own knowledge base
    # and from any document the student has attached. Both feed one answer —
    # the document adds to the assistant's knowledge rather than replacing it.
    question = messages[-1]["content"] if messages else ""
    retrieved_context, retrieved_sources = retrieve_context(user_id, question)

    result     = ask_llm(messages, model=body.model, retrieved_context=retrieved_context)
    reply      = result["reply"]
    latency    = result["latency"]
    model_used = result["model_used"]

    all_messages = body.messages + [{"role": "assistant", "content": reply}]

    if body.session_id:
        sessions_collection.update_one(
            {"_id": ObjectId(body.session_id)},
            {"$set": {"messages": all_messages, "updated_at": datetime.utcnow()}}
        )
        sid = body.session_id
    else:
        # The opening question doubles as the session title. Without it the
        # history list could only show timestamps, which is not enough to find
        # a past conversation again.
        title = (question or "New conversation").strip()
        if len(title) > 90:
            title = title[:87].rstrip() + "..."
        res = sessions_collection.insert_one({
            "user_id":     user_id,
            "title":       title,
            "model_used":  model_used,
            "latency_sec": latency,
            "messages":    all_messages,
            "created_at":  datetime.utcnow(),
            "updated_at":  datetime.utcnow()
        })
        sid = str(res.inserted_id)

    messages_remaining = None
    if guest:
        users_collection.update_one(
            {"_id": ObjectId(user_id)}, {"$inc": {"guest_messages_used": 1}}
        )
        messages_remaining = max(0, GUEST_CHAT_LIMIT - (used + 1))

    return {
        "reply":        reply,
        "session_id":   sid,
        "latency":      latency,
        "model_used":   model_used,
        "sources":      retrieved_sources,
        "pii_redacted": pii_redacted,
        "is_guest":     guest,
        "messages_remaining": messages_remaining
    }

@app.get("/sessions")
def get_sessions(authorization: str = Header(...)):
    user_id = get_user(authorization)

    # The full message array is excluded — a history list only needs enough to
    # recognise a conversation. The transcript is fetched on demand.
    sessions = list(
        sessions_collection.find({"user_id": user_id})
        .sort("created_at", -1)
        .limit(50)
    )

    out = []
    for s in sessions:
        messages = s.get("messages", [])
        # Sessions created before titles were stored fall back to their first
        # user message, so old history stays readable rather than blank.
        title = s.get("title")
        if not title:
            first_user = next(
                (m.get("content", "") for m in messages if m.get("role") == "user"),
                ""
            ).strip()
            title = (first_user[:87] + "...") if len(first_user) > 90 else (
                first_user or "Conversation"
            )
        last_reply = next(
            (m.get("content", "") for m in reversed(messages)
             if m.get("role") == "assistant"),
            ""
        ).strip()
        out.append({
            "_id":           str(s["_id"]),
            "title":         title,
            "preview":       (last_reply[:160] + "...") if len(last_reply) > 160 else last_reply,
            "model_used":    s.get("model_used"),
            "latency_sec":   s.get("latency_sec"),
            "message_count": len(messages),
            "created_at":    s.get("created_at"),
            "updated_at":    s.get("updated_at") or s.get("created_at"),
        })

    return {"sessions": out}


@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, authorization: str = Header(...)):
    user_id = get_user(authorization)
    result = sessions_collection.delete_one({
        "_id": ObjectId(session_id),
        "user_id": user_id
    })
    if not result.deleted_count:
        raise HTTPException(404, "Not found")
    return {"message": "Conversation deleted"}


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
    # The checklist is generated from the student's country, programme and
    # university, which a guest has not given, so there is nothing to
    # personalise from.
    require_full_account(user_id, "A personalised checklist")
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
    sections = _group_checklist_tasks(tasks)

    checklists_collection.update_one(
        {"user_id": user_id},
        {"$set": {"sections": sections, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    return {"sections": sections}

# Maps the LLM's flat "urgent"/"first_week"/"first_month" priority onto the
# section grouping and icon the frontend renders as an accordion.
_CHECKLIST_SECTIONS = [
    ("urgent",      "Before You Arrive", "priority_high"),
    ("first_week",  "First Week",        "event"),
    ("first_month", "First Month",       "calendar_month"),
]

def _group_checklist_tasks(tasks: list) -> list:
    sections = []
    task_id = 0
    for priority, title, icon in _CHECKLIST_SECTIONS:
        section_tasks = []
        for t in tasks:
            if t.get("priority") != priority:
                continue
            task_id += 1
            section_tasks.append({
                "id": f"t{task_id}",
                "title": t.get("task", ""),
                "description": t.get("explanation", ""),
                "priority": "high" if priority == "urgent" else None,
                "completed": False,
            })
        if section_tasks:
            sections.append({"title": title, "icon": icon, "tasks": section_tasks})
    return sections

@app.get("/checklist")
def get_checklist(authorization: str = Header(...)):
    user_id = get_user(authorization)
    checklist = checklists_collection.find_one({"user_id": user_id})
    if not checklist:
        return {"sections": []}
    return {"sections": checklist.get("sections", [])}

class ToggleTaskBody(BaseModel):
    task_id: str

@app.post("/checklist/toggle")
def toggle_checklist_task(body: ToggleTaskBody, authorization: str = Header(...)):
    user_id = get_user(authorization)
    require_full_account(user_id, "Checklist tasks")
    checklist = checklists_collection.find_one({"user_id": user_id})
    if not checklist:
        raise HTTPException(404, "No checklist found")

    sections = checklist.get("sections", [])
    found = False
    for section in sections:
        for task in section.get("tasks", []):
            if task.get("id") == body.task_id:
                task["completed"] = not task.get("completed", False)
                found = True
                break
        if found:
            break
    if not found:
        raise HTTPException(404, "Task not found")

    checklists_collection.update_one(
        {"user_id": user_id},
        {"$set": {"sections": sections}}
    )
    return {"sections": sections}

# ── COMMUNITY Q&A ─────────────────────────────────────────────────────────────

class PostBody(BaseModel):
    question: str
    category: str = "general"
    # category options: "academic", "arrival", "technology", "general"


@app.post("/posts")
def create_post(body: PostBody, authorization: str = Header(...)):
    user_id = get_user(authorization)
    # Guests can read the board, but posting is attributable content that
    # other students will reply to, so it needs an account behind it.
    require_full_account(user_id, "Posting a question")

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
    require_full_account(user_id, "Replying to a question")
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

# ── DOCUMENT CONTEXT ──────────────────────────────────────────────────────────
# A student can attach a document (assignment brief, tenancy agreement, policy
# letter). Its text is stored per-user and injected into every /chat turn as
# extra context (see llm.ask_llm) — it's not a separate, walled-off Q&A mode.

def _store_document_text(user_id: str, filename: str, extracted: str) -> dict:
    """Shared by both attach paths (PDF upload and URL fetch): chunk, embed,
    and store extracted text as the student's one active document, replacing
    whatever was attached before. Chunking/embedding is what lets retrieval
    pull only the passages relevant to each question, rather than pasting
    the whole text into every prompt — that's what makes long sources work.
    """
    chunks = rag.chunk_text(extracted)
    if not chunks:
        raise HTTPException(400, "Could not read any usable text from that.")

    try:
        vectors = rag.embed_texts(chunks)
    except Exception:
        raise HTTPException(
            503,
            "Could not process that right now. Please try again shortly."
        )

    document_chunks_collection.delete_many({"user_id": user_id})
    document_chunks_collection.insert_many([
        {
            "user_id":     user_id,
            "filename":    filename,
            "chunk_index": i,
            "text":        chunk,
            "embedding":   vec,
            "created_at":  datetime.utcnow(),
        }
        for i, (chunk, vec) in enumerate(zip(chunks, vectors))
    ])

    return {"filename": filename, "word_count": len(extracted.split()), "chunks": len(chunks)}


@app.post("/document/upload")
async def upload_document(
    file: UploadFile = File(...),
    authorization: str = Header(...)
):
    user_id  = get_user(authorization)
    # Attaching a document uploads the student's own material and stores its
    # embedded chunks, so it is deliberately account-only.
    require_full_account(user_id, "Attaching a document")
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

    result = _store_document_text(user_id, file.filename, extracted)
    return {"message": "Document attached", **result}


@app.post("/document/remove")
def remove_document(authorization: str = Header(...)):
    user_id = get_user(authorization)
    document_chunks_collection.delete_many({"user_id": user_id})
    return {"message": "Document removed"}
