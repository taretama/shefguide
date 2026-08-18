"""One-off retry for the single consistency_check.py cell that failed twice:
gemini / Q27 (out_of_scope), runs 1 and 3. Patches consistency_results.csv
and consistency_summary.csv in place rather than re-running everything.
"""

import csv
import statistics
import sys
import time
from pathlib import Path

from test_questions import QUESTIONS
from run_latency_test import register_eval_account
from collect_answers_for_scoring import ask_full

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from rag import embed_texts, cosine  # noqa: E402

Q = next(q for q in QUESTIONS if q["id"] == 27)
MODEL = "gemini"

token = register_eval_account()

with open("consistency_results.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

for r in rows:
    if int(r["question_id"]) == 27 and "GPT" not in r["model"] and r["notes"].startswith("FAILED"):
        run = r["run"]
        print(f"retrying run {run}... ", end="", flush=True)
        try:
            result = ask_full(token, MODEL, Q["text"])
        except Exception as e:
            print(f"still failing: {e}")
            r["notes"] = f"FAILED: {e}"
            time.sleep(3)
            continue
        print("ok")
        r["model"] = result["model_used"]
        r["answer"] = result["answer"]
        r["notes"] = ""
        time.sleep(3)

with open("consistency_results.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["question_id", "category", "question", "model", "run", "answer", "notes"])
    writer.writeheader()
    writer.writerows(rows)

# Recompute the summary row for gemini/Q27
answers = [r["answer"] for r in rows if int(r["question_id"]) == 27 and "GPT" not in r["model"] and r["answer"]]
if len(answers) >= 2:
    vectors = embed_texts(answers)
    pairs = [cosine(vectors[i], vectors[j]) for i in range(len(vectors)) for j in range(i + 1, len(vectors))]
    sim = sum(pairs) / len(pairs)
    lengths = [len(a) for a in answers]
    length_stdev = statistics.stdev(lengths) if len(lengths) > 1 else 0.0
else:
    sim = None
    length_stdev = None

with open("consistency_summary.csv", newline="", encoding="utf-8") as f:
    summary = list(csv.DictReader(f))

for s in summary:
    if s["model"] == MODEL and int(s["question_id"]) == 27:
        s["runs_succeeded"] = len(answers)
        s["mean_pairwise_cosine_similarity"] = round(sim, 4) if sim is not None else ""
        s["answer_length_stdev_chars"] = round(length_stdev, 1) if length_stdev is not None else ""

with open("consistency_summary.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=[
        "model", "question_id", "category", "question", "runs_succeeded",
        "mean_pairwise_cosine_similarity", "answer_length_stdev_chars",
    ])
    writer.writeheader()
    writer.writerows(summary)

print(f"\nDone. gemini/Q27 now has {len(answers)}/3 valid runs, "
      f"mean cosine similarity = {sim}")
