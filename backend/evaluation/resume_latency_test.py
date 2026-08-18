"""Re-runs only the rows in latency_results.csv that failed (e.g. Gemini's
20-requests/day free-tier quota being hit mid-run), leaving every already-
successful row untouched. Safe to re-run daily until the CSV is complete.
"""

import csv
import time

from test_questions import QUESTIONS
from run_latency_test import register_eval_account, ask, OUT_CSV, OUT_PLOT

QUESTIONS_BY_ID = {q["id"]: q for q in QUESTIONS}


def load_existing_rows():
    with open(OUT_CSV, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def save_rows(rows):
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "model", "question_id", "category", "question",
            "server_latency_sec", "client_roundtrip_sec",
            "reply_length_chars", "model_used", "error",
        ])
        writer.writeheader()
        writer.writerows(rows)


def main():
    rows = load_existing_rows()
    failed = [r for r in rows if r.get("error")]
    if not failed:
        print("No failed rows found - nothing to resume.")
        return

    print(f"Found {len(failed)} failed row(s) to retry:")
    for r in failed:
        print(f"  [{r['model']}] Q{r['question_id']} - {r['error'][:80]}")

    token = register_eval_account()
    for r in failed:
        q = QUESTIONS_BY_ID[int(r["question_id"])]
        model = r["model"]
        print(f"[{model}] Q{q['id']:02d} ({q['category']})... ", end="", flush=True)
        try:
            result = ask(token, model, q["text"])
        except Exception as e:
            print(f"still failing: {e}")
            r["error"] = str(e)
            time.sleep(3)
            continue
        print(f"{result['server_latency_sec']}s - recovered")
        r.update(result)
        r["error"] = ""
        time.sleep(3)

    save_rows(rows)
    still_failed = [r for r in rows if r.get("error")]
    print(f"\nDone. {len(rows) - len(still_failed)}/{len(rows)} rows now succeeded "
          f"({len(still_failed)} still failing).")


if __name__ == "__main__":
    main()
