from openai import OpenAI
from google import genai
from dotenv import load_dotenv
import os
import time

load_dotenv()

# OpenAI client — GPT-4o-mini
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Gemini client
gemini_client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

SYSTEM_PROMPT = """You are ShefGuide, an academic support assistant for
international students in UK higher education. You help with:
- Understanding assignments, marking criteria, and UK academic writing
- Referencing styles (Harvard, APA, IEEE)
- UK academic culture: seminars, tutorials, office hours, critical thinking
- Academic integrity and avoiding plagiarism
- Cybersecurity awareness when using AI tools

You do NOT provide mental health support, immigration advice, financial
advice, or medical advice. For those respond with:
'I cannot help with that, but your university Student Services team can.
Please contact them directly.'

Keep answers clear, warm, and concise — 3 to 5 sentences unless more
detail is genuinely needed. Many users are new to UK education."""


def ask_llm(messages: list, model: str = "gpt") -> dict:
    """
    model = "gpt"    → uses OpenAI GPT-4o-mini
    model = "gemini" → uses Google Gemini 3.5 Flash

    Returns dict with:
      reply      → the text response
      latency    → how many seconds it took
      model_used → human-readable model name (saved to MongoDB)
    """
    start = time.time()

    if model == "gpt":
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
            max_tokens=800,
            temperature=0.7
        )
        reply      = response.choices[0].message.content
        model_used = "GPT-4o-mini (OpenAI)"

    elif model == "gemini":
        # Gemini uses a different API format — build one big string
        conversation = SYSTEM_PROMPT + "\n\n"
        for msg in messages:
            role = "Student" if msg["role"] == "user" else "ShefGuide"
            conversation += f"{role}: {msg['content']}\n"
        conversation += "ShefGuide:"

        response = gemini_client.models.generate_content(
            model="gemini-1.5-flash",
            contents=conversation
        )
        reply      = response.text
        model_used = "Gemini 3.5 Flash (Google)"

    else:
        raise ValueError(f"Unknown model: {model}")

    latency = round(time.time() - start, 2)
    return {"reply": reply, "latency": latency, "model_used": model_used}