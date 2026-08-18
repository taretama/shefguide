"""Latency evaluation: runs the standardised 30-question set (see
test_questions.py) against both supported LLMs through ShefGuide's own
/chat endpoint, and records the per-question response time.

Each question is sent as a single, fresh, history-free turn (no prior
conversation context), and both models see identical questions in identical
order under identical conditions, per dissertation Section 3.6.

Usage (from backend/evaluation/):
    python run_latency_test.py

Requires the backend to already be running on http://localhost:8000.
Writes results to latency_results.csv, and a distribution plot to
latency_distribution.png, both in this folder.
"""

import csv
import time
import statistics
import requests

from test_questions import QUESTIONS

API = "http://localhost:8000"
MODELS = ["gpt", "gemini"]
OUT_CSV = "latency_results.csv"
OUT_PLOT = "latency_distribution.png"


def register_eval_account() -> str:
    """Registers a dedicated, disposable evaluation account and returns its token."""
    email = f"eval_latency_{int(time.time())}@example.com"
    res = requests.post(f"{API}/auth/register", json={
        "email": email,
        "password": "eval-test-pass-123",
        "university": "University of Sheffield",
        "home_country": "Nigeria",
        "programme": "MSc Data Science",
    })
    res.raise_for_status()
    token = res.json()["token"]
    requests.post(f"{API}/consent/cloud-disclosure",
                   headers={"Authorization": f"Bearer {token}"})
    return token


def ask(token: str, model: str, question: str) -> dict:
    """Sends one fresh, history-free question and returns timing + reply info."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {"messages": [{"role": "user", "content": question}], "model": model}

    client_start = time.time()
    res = requests.post(f"{API}/chat", headers=headers, json=body, timeout=120)
    client_elapsed = time.time() - client_start

    if res.status_code == 429:
        # Rate limited - wait out the window and retry once.
        time.sleep(65)
        client_start = time.time()
        res = requests.post(f"{API}/chat", headers=headers, json=body, timeout=120)
        client_elapsed = time.time() - client_start

    res.raise_for_status()
    data = res.json()
    return {
        "server_latency_sec": data.get("latency"),
        "client_roundtrip_sec": round(client_elapsed, 3),
        "reply_length_chars": len(data.get("reply", "")),
        "model_used": data.get("model_used"),
    }


def main():
    token = register_eval_account()
    print(f"Evaluation account ready. Running {len(QUESTIONS)} questions x {len(MODELS)} models "
          f"= {len(QUESTIONS) * len(MODELS)} calls.\n")

    rows = []
    for model in MODELS:
        for q in QUESTIONS:
            print(f"[{model}] Q{q['id']:02d} ({q['category']})... ", end="", flush=True)
            try:
                result = ask(token, model, q["text"])
            except Exception as e:
                print(f"FAILED: {e}")
                rows.append({
                    "model": model, "question_id": q["id"], "category": q["category"],
                    "question": q["text"], "server_latency_sec": None,
                    "client_roundtrip_sec": None, "reply_length_chars": None, "error": str(e),
                })
                continue
            print(f"{result['server_latency_sec']}s")
            rows.append({
                "model": model, "question_id": q["id"], "category": q["category"],
                "question": q["text"], **result, "error": "",
            })
            # Stay comfortably under the 10-requests/60s per-user rate limit.
            time.sleep(3)

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "model", "question_id", "category", "question",
            "server_latency_sec", "client_roundtrip_sec",
            "reply_length_chars", "model_used", "error",
        ])
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nWrote {len(rows)} rows to {OUT_CSV}")

    # Summary stats + plot
    try:
        import matplotlib.pyplot as plt

        by_model = {m: [r["server_latency_sec"] for r in rows
                         if r["model"] == m and r["server_latency_sec"] is not None]
                    for m in MODELS}

        for m, vals in by_model.items():
            if not vals:
                continue
            print(f"\n{m}: n={len(vals)}  mean={statistics.mean(vals):.2f}s  "
                  f"median={statistics.median(vals):.2f}s  "
                  f"min={min(vals):.2f}s  max={max(vals):.2f}s")

        fig, ax = plt.subplots(figsize=(6, 5))
        labels = [m for m in MODELS if by_model.get(m)]
        data = [by_model[m] for m in labels]
        ax.boxplot(data, tick_labels=labels, showmeans=True)
        ax.set_ylabel("Response latency (seconds)")
        ax.set_title("ShefGuide /chat latency by model\n(30-question standardised test set)")
        fig.tight_layout()
        fig.savefig(OUT_PLOT, dpi=150)
        print(f"Wrote distribution plot to {OUT_PLOT}")
    except ImportError:
        print("matplotlib not installed - skipping plot, CSV is still complete.")


if __name__ == "__main__":
    main()
