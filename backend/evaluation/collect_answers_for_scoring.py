"""Collects full answer text from both models for all 30 standardised
questions, and writes a scoring sheet ready to open in Excel/Sheets.

This does NOT score anything itself - scoring the 0-5 accuracy/relevance
rubric per dissertation Section 3.6 is a manual judgement call and has to
be done by a human reading each answer, not automated.

Usage (from backend/evaluation/):
    python collect_answers_for_scoring.py

Requires the backend to already be running on http://localhost:8000.
Writes quality_scoring_sheet.csv in this folder.
"""

import csv
import time
import requests

from test_questions import QUESTIONS
from run_latency_test import register_eval_account, API, MODELS

OUT_CSV = "quality_scoring_sheet.csv"


def ask_full(token: str, model: str, question: str) -> dict:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {"messages": [{"role": "user", "content": question}], "model": model}
    res = requests.post(f"{API}/chat", headers=headers, json=body, timeout=120)
    if res.status_code == 429:
        time.sleep(65)
        res = requests.post(f"{API}/chat", headers=headers, json=body, timeout=120)
    res.raise_for_status()
    data = res.json()
    return {
        "answer": data.get("reply", ""),
        "model_used": data.get("model_used"),
        "sources": "; ".join(data.get("sources", []) or []),
    }


def main():
    token = register_eval_account()
    print(f"Evaluation account ready. Collecting answers for {len(QUESTIONS)} questions "
          f"x {len(MODELS)} models.\n")

    rows = []
    for model in MODELS:
        for q in QUESTIONS:
            print(f"[{model}] Q{q['id']:02d} ({q['category']})... ", end="", flush=True)
            try:
                result = ask_full(token, model, q["text"])
            except Exception as e:
                print(f"FAILED: {e}")
                rows.append({
                    "question_id": q["id"], "category": q["category"], "question": q["text"],
                    "model": model, "answer": "", "sources_used": "",
                    "score_0_5": "", "notes": f"FAILED: {e}",
                })
                time.sleep(3)
                continue
            print("ok")
            rows.append({
                "question_id": q["id"], "category": q["category"], "question": q["text"],
                "model": result["model_used"], "answer": result["answer"],
                "sources_used": result["sources"], "score_0_5": "", "notes": "",
            })
            time.sleep(3)

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "question_id", "category", "question", "model", "answer",
            "sources_used", "score_0_5", "notes",
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWrote {len(rows)} rows to {OUT_CSV}.")
    print("Next: open it in Excel/Sheets and fill in score_0_5 for each row "
          "(0 = irrelevant, 5 = accurate and relevant), per Section 3.6's rubric.")


if __name__ == "__main__":
    main()
