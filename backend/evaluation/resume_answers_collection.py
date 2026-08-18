"""Re-runs only the rows in quality_scoring_sheet.csv that failed to collect
an answer, leaving every already-successful row (and any scores already
entered in score_0_5) untouched. Safe to re-run daily until complete.
"""

import csv
import time

from test_questions import QUESTIONS
from run_latency_test import register_eval_account
from collect_answers_for_scoring import ask_full, OUT_CSV

QUESTIONS_BY_ID = {q["id"]: q for q in QUESTIONS}
FIELDNAMES = ["question_id", "category", "question", "model", "answer",
              "sources_used", "score_0_5", "notes"]


def load_existing_rows():
    with open(OUT_CSV, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def save_rows(rows):
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def main():
    rows = load_existing_rows()
    failed = [r for r in rows if r.get("notes", "").startswith("FAILED")]
    if not failed:
        print("No failed rows found - nothing to resume.")
        return

    print(f"Found {len(failed)} failed row(s) to retry:")
    for r in failed:
        print(f"  [{r['model']}] Q{r['question_id']} - {r['notes'][:80]}")

    token = register_eval_account()
    for r in failed:
        q = QUESTIONS_BY_ID[int(r["question_id"])]
        model = r["model"]
        print(f"[{model}] Q{q['id']:02d} ({q['category']})... ", end="", flush=True)
        try:
            result = ask_full(token, model, q["text"])
        except Exception as e:
            print(f"still failing: {e}")
            r["notes"] = f"FAILED: {e}"
            time.sleep(3)
            continue
        print("recovered")
        r["model"] = result["model_used"]
        r["answer"] = result["answer"]
        r["sources_used"] = result["sources"]
        r["notes"] = ""
        time.sleep(3)

    save_rows(rows)
    still_failed = [r for r in rows if r.get("notes", "").startswith("FAILED")]
    print(f"\nDone. {len(rows) - len(still_failed)}/{len(rows)} rows now succeeded "
          f"({len(still_failed)} still failing).")


if __name__ == "__main__":
    main()
