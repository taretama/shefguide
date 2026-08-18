"""Consistency check (dissertation Section 3.6): for 3 representative
questions, one per category, ask each model the SAME question 3 separate
times (fresh, history-free requests) and measure how similar the 3 answers
are to each other.

Consistency is scored two ways:
  - semantic similarity: mean pairwise cosine similarity between the 3
    answers' OpenAI embeddings (1.0 = identical meaning, lower = more
    variation between runs)
  - length variation: stdev of answer length across the 3 runs, as a
    simple, easy-to-explain secondary signal

This does not judge whether the answers are CORRECT (that is the separate
quality-scoring rubric) - only whether the same model gives a similar answer
to the same question on repeated asks.

Usage (from backend/evaluation/):
    python consistency_check.py

Requires the backend to already be running on http://localhost:8000.
Writes consistency_results.csv in this folder.
"""

import csv
import statistics
import sys
import time
from pathlib import Path

from test_questions import QUESTIONS
from run_latency_test import register_eval_account, API, MODELS
from collect_answers_for_scoring import ask_full

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from rag import embed_texts, cosine  # noqa: E402

OUT_CSV = "consistency_results.csv"
RUNS_PER_QUESTION = 3

# One representative question per category.
REP_QUESTION_IDS = [1, 18, 27]


def mean_pairwise_cosine(vectors: list[list[float]]) -> float:
    pairs = []
    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            pairs.append(cosine(vectors[i], vectors[j]))
    return sum(pairs) / len(pairs) if pairs else 1.0


def main():
    questions = [q for q in QUESTIONS if q["id"] in REP_QUESTION_IDS]
    token = register_eval_account()

    rows = []
    summary = []

    for model in MODELS:
        for q in questions:
            answers = []
            print(f"[{model}] Q{q['id']:02d} ({q['category']})")
            for run in range(1, RUNS_PER_QUESTION + 1):
                print(f"  run {run}/{RUNS_PER_QUESTION}... ", end="", flush=True)
                try:
                    result = ask_full(token, model, q["text"])
                except Exception as e:
                    print(f"FAILED: {e}")
                    answers.append("")
                    rows.append({
                        "question_id": q["id"], "category": q["category"],
                        "question": q["text"], "model": model, "run": run,
                        "answer": "", "notes": f"FAILED: {e}",
                    })
                    time.sleep(3)
                    continue
                print("ok")
                answers.append(result["answer"])
                rows.append({
                    "question_id": q["id"], "category": q["category"],
                    "question": q["text"], "model": result["model_used"], "run": run,
                    "answer": result["answer"], "notes": "",
                })
                time.sleep(3)

            valid = [a for a in answers if a]
            if len(valid) >= 2:
                vectors = embed_texts(valid)
                sim = mean_pairwise_cosine(vectors)
                lengths = [len(a) for a in valid]
                length_stdev = statistics.stdev(lengths) if len(lengths) > 1 else 0.0
            else:
                sim = None
                length_stdev = None

            summary.append({
                "model": model, "question_id": q["id"], "category": q["category"],
                "question": q["text"], "runs_succeeded": len(valid),
                "mean_pairwise_cosine_similarity": round(sim, 4) if sim is not None else "",
                "answer_length_stdev_chars": round(length_stdev, 1) if length_stdev is not None else "",
            })

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "question_id", "category", "question", "model", "run", "answer", "notes",
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWrote {len(rows)} rows to {OUT_CSV}.\n")
    print("Summary (higher cosine similarity = more consistent across repeated runs):")
    print(f"{'Model':<20}{'Q#':<5}{'Category':<18}{'Runs OK':<9}{'Mean cos sim':<14}{'Length stdev':<14}")
    for s in summary:
        print(f"{s['model']:<20}{s['question_id']:<5}{s['category']:<18}"
              f"{s['runs_succeeded']:<9}{s['mean_pairwise_cosine_similarity']:<14}"
              f"{s['answer_length_stdev_chars']:<14}")

    with open("consistency_summary.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "model", "question_id", "category", "question", "runs_succeeded",
            "mean_pairwise_cosine_similarity", "answer_length_stdev_chars",
        ])
        writer.writeheader()
        writer.writerows(summary)
    print("\nWrote consistency_summary.csv")


if __name__ == "__main__":
    main()
