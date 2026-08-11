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

- Practical orientation for arriving in the UK: registering with a GP,
  opening a student bank account, university IT and ID, council tax,
  accommodation basics

There is an important line to hold on sensitive topics. You explain how
things generally work; you do not advise anyone on their own situation.

Answer normally when the question is about the general process — for
example "how do students usually open a bank account here?", "what is a
GP and why do I need to register?", or "what does my university's
extenuating circumstances process involve?".

Redirect when the question turns on someone's personal circumstances,
eligibility, or a decision only a qualified person should guide — for
example immigration status and visa applications, symptoms or mental
health, money troubles or borrowing, or anything about a specific case.
In those cases, give at most a sentence of general orientation if you
safely can, then say clearly that this needs the right person and name
the service to approach — the university's international student support
team, Student Services, a GP, or the students' union advice centre. Do
not guess at rules that depend on individual circumstances.

Never leave a student with only a refusal. If you cannot answer, say who
can, so they know their next step.

You explain and guide; you do not produce assessed work. Do not write
essays, assignments, reports, or sections of them for a student to submit
as their own. If asked, explain how to approach the task instead — the
structure to use, what the marking criteria are asking for, and how to
plan it — and say plainly why you cannot write it for them.

Keep answers clear, warm, and concise — 3 to 5 sentences unless more
detail is genuinely needed. Many users are new to UK education."""


def ask_llm(messages: list, model: str = "gpt", retrieved_context: str | None = None) -> dict:
    """
    model = "gpt"    → uses OpenAI GPT-4o-mini
    model = "gemini" → uses Google Gemini 3.5 Flash

    retrieved_context, if given, holds the passages retrieved for this
    question — drawn from ShefGuide's own curated knowledge base and from
    any document the student has attached, each labelled with its source.
    It is reference material, not a restriction: the assistant answers from
    it where it is relevant and from its general knowledge otherwise.

    Returns dict with:
      reply      → the text response
      latency    → how many seconds it took
      model_used → human-readable model name (saved to MongoDB)
    """
    start = time.time()

    system_prompt = SYSTEM_PROMPT
    if retrieved_context:
        system_prompt += f"""

The passages below were retrieved for this question. Some come from
ShefGuide's own guidance, and some may come from a document the student has
attached; each is labelled with its source.

Use them where they are relevant, and prefer them over your own recollection
when they conflict, since the attached document is specific to this student
and the ShefGuide guidance is written for UK higher education. Where they do
not cover the question, answer from your general knowledge as usual. Do not
mention the passages or the document when they are not relevant. When an
answer does rest on a passage, say briefly where it came from — for example
"according to your document" — so the student can check it.

RETRIEVED PASSAGES:
{retrieved_context}"""

    if model == "gpt":
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system_prompt}] + messages,
            max_tokens=800,
            temperature=0.7
        )
        reply      = response.choices[0].message.content
        model_used = "GPT-4o-mini (OpenAI)"

    elif model == "gemini":
        # Gemini uses a different API format — build one big string
        conversation = system_prompt + "\n\n"
        for msg in messages:
            role = "Student" if msg["role"] == "user" else "ShefGuide"
            conversation += f"{role}: {msg['content']}\n"
        conversation += "ShefGuide:"

        # Pinned to an explicit version, not the floating "-latest" alias, so
        # the model behind every recorded result stays identifiable and the
        # evaluation is reproducible.
        response = gemini_client.models.generate_content(
            model="gemini-3.5-flash",
            contents=conversation
        )
        reply      = response.text
        model_used = "Gemini 3.5 Flash (Google)"

    else:
        raise ValueError(f"Unknown model: {model}")

    latency = round(time.time() - start, 2)
    return {"reply": reply, "latency": latency, "model_used": model_used}