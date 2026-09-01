# ShefGuide

An AI-supported web app for international students in UK higher education, built as an MSc dissertation project.

**Live demo:** [shefguide.onrender.com](https://shefguide.onrender.com/) — hosted on Render's free tier, so the first request after a period of inactivity can take up to a minute to wake the server.

**What it does**

- **Dual-LLM academic support chat** — the same question can be put to GPT-4o-mini or Gemini 3.5 Flash under one interface and one system prompt, which is what makes the model comparison in the dissertation possible.
- **Retrieval-augmented, document-aware answers** — ShefGuide keeps its own curated corpus of UK academic guidance. Every question searches that corpus *and* any PDF the student has attached, so a single answer can draw on both. This is the feature's value over pasting a document into a general-purpose chatbot.
- **Community Q&A board** — students post questions, get an AI answer immediately, and see human replies. AI answers are cached, so a repeated question reuses the stored answer instead of paying for a new generation.
- **Personalised arrival checklist** — generated from the student's home country, programme and university.
- **Conversation history** — every chat is saved, titled by its opening question, and can be reopened, resumed, or deleted.
- **Guest access** — a visitor can use the chat without registering. Registering later upgrades the anonymous account in place, so nothing is lost.

**Stack**

- **Backend:** Python, FastAPI, MongoDB
- **Frontend:** React + TypeScript (Vite, Tailwind), built to static files and served by the backend
- **Embeddings:** OpenAI `text-embedding-3-small`, cosine similarity computed in Python

## Prerequisites

- [Python 3.11+](https://www.python.org/downloads/)
- [MongoDB](https://www.mongodb.com/try/download/community) running locally, or a MongoDB Atlas connection string
- An [OpenAI API key](https://platform.openai.com/api-keys) — used for both chat and embeddings
- A [Gemini API key](https://aistudio.google.com/apikey)

## 1. Set up the backend

```powershell
cd shefguide
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

> If you already have a `.venv` folder from a different machine or Windows user account, delete it first (`Remove-Item -Recurse -Force .venv`) and recreate it — a venv is tied to the exact Python path it was created with and won't run under a different user or machine.

## 2. Configure environment variables

Create `backend/.env` (git-ignored, never commit it):

```
MONGO_URI=mongodb://localhost:27017
OPENAI_API_KEY=sk-your-openai-key
GEMINI_API_KEY=your-gemini-key
JWT_SECRET=replace-with-a-long-random-string
```

## 3. Start MongoDB

Make sure the service is running (default port `27017`). No manual database or collection setup is needed — collections are created on first write.

## 4. Index the knowledge base

**Do this once before first use, and again whenever a file in `backend/knowledge/` changes.** Without it, retrieval has nothing of its own to search and answers fall back to the model's general knowledge alone.

```powershell
cd backend
python index_knowledge.py
```

This chunks every `knowledge/*.md` file, embeds the chunks, and stores them in the `knowledge_chunks` collection. It rebuilds the collection from scratch each run, so it is safe to repeat.

## 5. Run the backend

```powershell
cd backend
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. `http://localhost:8000/health` should return
`{"message": "ShefGuide backend is running"}`.

If a frontend build is present the backend also serves the site itself, so
`http://localhost:8000` opens ShefGuide rather than returning JSON. With no build
present the backend runs API-only exactly as before.

## 6. Build the frontend

The frontend is a React app that compiles to static files. Build it once, and
again whenever you change it:

```powershell
cd ../frontend
npm install
npm run build:deploy
```

That writes the compiled site to `shefguide/frontend-dist/`, which is where the
backend looks for it. Restart the backend afterwards and open
`http://localhost:8000`.

To work on the frontend with hot reload instead, run `npm run dev` and use the
URL it prints; in that mode it calls the backend on port 8000 directly.

The built app talks to the API using relative URLs, so it works unchanged on
localhost, on a LAN address, or through a tunnel. Only one port needs to be
exposed when sharing a link.

### The previous frontend

The original static HTML frontend is kept in `legacy-static-frontend/`. It is no
longer what gets served. To go back to it, restore `backend/main.py` from
`backend/main.py.bak` and serve that folder with `python -m http.server 5500`.

## Project structure

```
backend/
  main.py              FastAPI app: auth, guest sessions, chat, retrieval,
                       history, checklist, community Q&A, document upload
  rag.py               Chunking, embedding, cosine similarity, relevance
                       threshold — the retrieval layer
  index_knowledge.py   Rebuilds the knowledge-base index (see step 4)
  knowledge/           The curated guidance corpus (six markdown files)
  llm.py               OpenAI / Gemini wrapper and the system prompt
  security.py          Prompt-injection detection, PII redaction, rate limiting
  auth.py              bcrypt password hashing, JWT issuing and verification
  database.py          MongoDB connection and collections
  .env                 Secrets — not committed
frontend/              React 19 + Vite + TypeScript + Tailwind v4
  client/src/pages/    One file per route: Home, Chat, Checklist, Community,
                       History, Auth, Policy, NotFound
  client/src/components/
                       Shared shell: Brand, PublicHeader, WorkspaceSidebar,
                       HowItWorks, DisclosureGate, plus ui/ (shadcn primitives)
  client/src/lib/api.ts
                       Every backend call, token storage, guest-session recovery
  client/src/index.css Tailwind entry, fonts, project utilities
  DESIGN.md            The design system: dials, locks, rules
frontend-dist/         The built site the backend serves (generated)
legacy-static-frontend/
                       The original HTML/CSS/JS site, kept for rollback only
```

## How retrieval works

1. Knowledge files and any uploaded PDF are split into overlapping chunks of roughly 1,200 characters, preferring paragraph boundaries.
2. Each chunk is embedded once with `text-embedding-3-small` and stored in MongoDB — the knowledge corpus shared by everyone, document chunks scoped per user.
3. Each question is embedded with the same model and scored by cosine similarity against both stores. The top three passages from each are kept.
4. Passages scoring below **0.40** are discarded. That threshold was measured, not guessed: in-scope questions score 0.47–0.58 against the correct passage, while out-of-scope questions peak at 0.33. An unrelated question therefore retrieves nothing and the assistant answers normally instead of being fed misleading context.

The corpus is small enough that an exact scan beats the round trip to a vector database, and it keeps the retrieval step simple enough to describe and defend.

## Notes and known limitations

- The curated guidance corpus was **written for this prototype** and is deliberately general to UK higher education. It is **not** official University of Sheffield policy, and each file records its own provenance. See section 4.10 of the dissertation.
- CORS is wide open (`allow_origins=["*"]`) for local development — tighten before any real deployment.
- Rate limiting is in-memory and resets on restart, which is fine for a single-instance deployment but would not survive horizontal scaling.
- Guests are capped at five answers and their sessions expire after six hours.
- Only one attached document is held per user at a time; attaching a new one replaces the previous one.
