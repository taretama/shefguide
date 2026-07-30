# ShefGuide

An AI-supported web app for international students in UK higher education. Provides a dual-LLM (GPT-4o-mini / Gemini) academic support chat, a community Q&A board with cached AI answers, a PDF document explainer (upload an assignment brief or policy doc and ask questions about it), and a personalised arrival checklist.

- **Backend:** Python, FastAPI, MongoDB
- **Frontend:** static HTML/CSS/JS (no build step)

## Prerequisites

- [Python 3.11+](https://www.python.org/downloads/)
- [MongoDB](https://www.mongodb.com/try/download/community) running locally, or a MongoDB Atlas connection string
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A [Gemini API key](https://aistudio.google.com/apikey)

## 1. Clone and set up the backend

```powershell
cd shefguide
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

> If you already have a `.venv` folder from a different machine or Windows user account, delete it first (`Remove-Item -Recurse -Force .venv`) and recreate it with the commands above — a venv is tied to the exact Python path it was created with and won't run under a different user/machine.

## 2. Configure environment variables

Create `backend/.env` (this file is git-ignored and must never be committed):

```
MONGO_URI=mongodb://localhost:27017
OPENAI_API_KEY=sk-your-openai-key
GEMINI_API_KEY=your-gemini-key
JWT_SECRET=replace-with-a-long-random-string
```

## 3. Start MongoDB

If running locally, make sure the MongoDB service is running (default port `27017`). No manual database/collection creation is needed — collections are created automatically on first write.

## 4. Run the backend

```powershell
cd backend
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`. Visit `http://localhost:8000` in a browser to confirm it's running (`{"message": "ShefGuide backend is running"}`).

## 5. Run the frontend

The frontend is plain HTML/JS with no build step — just open it in a browser:

```powershell
cd frontend
python -m http.server 5500
```

Then visit `http://localhost:5500/index.html`. (Opening the file directly with `file://` also works, since the frontend calls the backend via absolute `http://localhost:8000` URLs.)

## Project structure

```
backend/
  main.py        FastAPI app: auth, chat, checklist, community Q&A, document explainer
  auth.py        Password hashing (bcrypt) and JWT issuing/verification
  database.py    MongoDB connection and collections
  llm.py         OpenAI / Gemini wrapper used by all AI features
  .env           Secrets — not committed
  requirements.txt
frontend/
  index.html     Login/register, chat, PDF upload
  qa.html         Community Q&A board
```

## Notes

- CORS is currently wide open (`allow_origins=["*"]`) for local development — tighten this before any real deployment.
- The document explainer stores extracted PDF text in memory (not MongoDB), so uploaded documents are lost on backend restart.
