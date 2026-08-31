"""Does the 0.40 similarity threshold actually separate in-scope from out-of-scope?

rag.py sets MIN_SCORE = 0.40 and states that in-scope questions score
0.47-0.58 against their correct passage while out-of-scope questions peak at
0.33. This script measures whether that is true of the knowledge base as it
currently stands, rather than taking the comment on trust.

For every question in the standardised set it records the best cosine score
against any knowledge-base chunk, then reports the two distributions and
where they separate. If the claim holds, the in-scope minimum sits above the
out-of-scope maximum and 0.40 falls in the gap between them.

Usage (from backend/evaluation/):
    python verify_threshold.py

Writes threshold_distribution.csv and threshold_distribution.png.
"""

import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import rag
from database import knowledge_collection
from test_questions import QUESTIONS

OUT_CSV = "threshold_distribution.csv"
OUT_PNG = "threshold_distribution.png"
THRESHOLD = rag.MIN_SCORE


def main() -> None:
    records = list(knowledge_collection.find({}, {"_id": 0}))
    if not records:
        print("The knowledge base is empty. Run index_knowledge.py first.")
        return
    print("Knowledge base: %d chunks\n" % len(records))

    rows = []
    for question in QUESTIONS:
        vector = rag.embed_one(question["text"])
        best_score, best_title = 0.0, ""
        for record in records:
            score = rag.cosine(vector, record["embedding"])
            if score > best_score:
                best_score, best_title = score, record.get("title", "")

        # Questions 26-30 are out of scope by design; the rest are in scope.
        in_scope = question["category"] != "out_of_scope"
        rows.append({
            "question_id": question["id"],
            "category": question["category"],
            "in_scope": in_scope,
            "question": question["text"],
            "best_score": round(best_score, 4),
            "best_match_file": best_title,
            "passes_threshold": best_score >= THRESHOLD,
        })
        print("q%-2d %-16s best=%.3f %s %s"
              % (question["id"], question["category"], best_score,
                 "PASS" if best_score >= THRESHOLD else "drop ",
                 best_title[:34]))

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    in_scope = [r["best_score"] for r in rows if r["in_scope"]]
    out_scope = [r["best_score"] for r in rows if not r["in_scope"]]

    print("\n" + "=" * 58)
    print("IN SCOPE      n=%-2d  min=%.3f  max=%.3f  mean=%.3f"
          % (len(in_scope), min(in_scope), max(in_scope),
             sum(in_scope) / len(in_scope)))
    print("OUT OF SCOPE  n=%-2d  min=%.3f  max=%.3f  mean=%.3f"
          % (len(out_scope), min(out_scope), max(out_scope),
             sum(out_scope) / len(out_scope)))
    print("-" * 58)
    print("Threshold in rag.py: %.2f" % THRESHOLD)

    gap_low, gap_high = max(out_scope), min(in_scope)
    if gap_low < gap_high:
        print("Clean separation: out-of-scope tops out at %.3f, in-scope starts "
              "at %.3f." % (gap_low, gap_high))
        if gap_low < THRESHOLD < gap_high:
            print("The threshold sits inside that gap. The claim holds.")
        else:
            print("The gap is %.3f-%.3f, but the threshold is %.2f, which is "
                  "outside it." % (gap_low, gap_high, THRESHOLD))
    else:
        overlap = [r for r in rows if not r["in_scope"]
                   and r["best_score"] >= min(in_scope)]
        print("The distributions overlap: %d out-of-scope question(s) score at "
              "or above the lowest in-scope question." % len(overlap))
        for r in overlap:
            print("   q%-2d %.3f  %s" % (r["question_id"], r["best_score"],
                                         r["question"][:52]))
        print("No single threshold separates them cleanly. Any value trades a "
              "false positive against a false negative.")

    dropped = [r for r in rows if r["in_scope"] and not r["passes_threshold"]]
    admitted = [r for r in rows if not r["in_scope"] and r["passes_threshold"]]
    print("-" * 58)
    print("In-scope questions the threshold drops : %d" % len(dropped))
    for r in dropped:
        print("   q%-2d %.3f  %s" % (r["question_id"], r["best_score"],
                                     r["question"][:52]))
    print("Out-of-scope questions it admits       : %d" % len(admitted))
    for r in admitted:
        print("   q%-2d %.3f  %s" % (r["question_id"], r["best_score"],
                                     r["question"][:52]))

    fig, ax = plt.subplots(figsize=(8, 3.6))
    ax.scatter(in_scope, [1] * len(in_scope), s=46, alpha=0.75,
               color="#2F3B4C", label="In scope (q1-25)")
    ax.scatter(out_scope, [0.75] * len(out_scope), s=46, alpha=0.75,
               color="#B9552F", marker="s", label="Out of scope (q26-30)")
    ax.axvline(THRESHOLD, color="#B9552F", linestyle="--", linewidth=1.3)
    ax.text(THRESHOLD, 1.22, " threshold %.2f" % THRESHOLD,
            fontsize=8.5, color="#B9552F", va="top")
    ax.set_ylim(0.55, 1.3)
    ax.set_yticks([])
    ax.set_xlabel("Best cosine similarity against any knowledge-base chunk",
                  fontsize=9)
    ax.set_title("Where the retrieval threshold sits relative to the data",
                 fontsize=10.5)
    ax.legend(fontsize=8.5, frameon=False, loc="lower right")
    ax.grid(axis="x", alpha=0.25, linewidth=0.6)
    ax.set_axisbelow(True)
    fig.tight_layout()
    fig.savefig(OUT_PNG, dpi=200)

    print("\nWrote %s and %s" % (OUT_CSV, OUT_PNG))


if __name__ == "__main__":
    main()
