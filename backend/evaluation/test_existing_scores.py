"""Significance tests on the scores already reported in Appendix E.

Section 5.4 reports GPT-4o-mini at 4.67 and Gemini 3.5 Flash at 4.20 and
treats the gap as meaningful. Section 5.7 then concedes it may not be,
saying the academic-support difference "supports nothing". Neither claim is
tested. This script tests them.

No new scoring is required: the 60 scores in Appendix E are the input.

The scores are ordinal (a 0-5 rubric) and paired (the same question answered
by both models), so the Wilcoxon signed-rank test is used rather than a
t-test, which would assume interval data and normality the rubric does not
provide. Each result is reported with a matched-pairs rank-biserial
correlation, because a p-value says whether a difference exists and not
whether it is large enough to matter.

Usage (from backend/evaluation/):
    python test_existing_scores.py

Reads appendix_e_scores.csv. Writes appendix_e_statistics.txt.
"""

import csv
import sys
from collections import defaultdict

from scipy.stats import wilcoxon

SOURCE = "appendix_e_scores.csv"
OUT = "appendix_e_statistics.txt"
ALPHA = 0.05

lines = []


def say(text=""):
    print(text)
    lines.append(text)


def rank_biserial(a, b):
    """Matched-pairs rank-biserial correlation, for ordinal paired data."""
    diffs = [x - y for x, y in zip(a, b) if x != y]
    if not diffs:
        return 0.0
    n = len(diffs)
    stat, _ = wilcoxon(a, b, zero_method="wilcox")
    return 1 - (2 * stat) / (n * (n + 1) / 2)


def magnitude(r):
    a = abs(r)
    return ("negligible" if a < 0.1 else "small" if a < 0.3
            else "medium" if a < 0.5 else "large")


def compare(label, gpt, gem):
    say("")
    say(label)
    say("-" * len(label))
    say("  n pairs      : %d" % len(gpt))
    say("  GPT-4o-mini  : mean %.3f, median %.1f, total %d"
        % (sum(gpt) / len(gpt), sorted(gpt)[len(gpt) // 2], sum(gpt)))
    say("  Gemini 3.5   : mean %.3f, median %.1f, total %d"
        % (sum(gem) / len(gem), sorted(gem)[len(gem) // 2], sum(gem)))
    say("  difference   : %+.3f" % (sum(gpt) / len(gpt) - sum(gem) / len(gem)))

    if gpt == gem:
        say("  Identical in every pair. No test needed.")
        return
    if len(gpt) < 6:
        say("  Too few pairs (%d) for a meaningful test." % len(gpt))
        return

    stat, p = wilcoxon(gpt, gem)
    r = rank_biserial(gpt, gem)
    say("  Wilcoxon W   : %.1f" % stat)
    say("  p-value      : %.4f" % p)
    say("  effect size  : r = %+.3f (%s)" % (r, magnitude(r)))
    if p < ALPHA:
        say("  -> SIGNIFICANT at alpha = %.2f." % ALPHA)
        say("     The difference is distinguishable from noise and can be claimed.")
    else:
        say("  -> NOT significant at alpha = %.2f." % ALPHA)
        say("     The gap is within what sampling variation would produce.")
        say("     It should be reported descriptively, with no claim made on it.")


def main():
    try:
        with open(SOURCE, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
    except FileNotFoundError:
        print("Missing %s." % SOURCE)
        sys.exit(1)

    by_model = defaultdict(dict)
    categories = {}
    for r in rows:
        qid = int(r["question_id"])
        by_model[r["model"]][qid] = int(r["score_0_5"])
        categories[qid] = r["category"]

    qids = sorted(set(by_model["gpt"]) & set(by_model["gemini"]))
    gpt = [by_model["gpt"][q] for q in qids]
    gem = [by_model["gemini"][q] for q in qids]

    say("Significance tests on the scores already in Appendix E")
    say("=" * 54)
    say("")
    say("Input: %d scored answers, %d questions answered by both models."
        % (len(rows), len(qids)))
    say("No new scoring was required for any result below.")

    compare("All 30 questions", gpt, gem)

    for cat in sorted(set(categories.values())):
        ids = [q for q in qids if categories[q] == cat]
        compare("Category: %s (%d questions)" % (cat, len(ids)),
                [by_model["gpt"][q] for q in ids],
                [by_model["gemini"][q] for q in ids])

    say("")
    say("")
    say("What this means for the write-up")
    say("=" * 32)
    say("Section 5.4 currently reports these means without testing them, and")
    say("Section 5.7 concedes the academic-support gap 'supports nothing'.")
    say("Each comparison above now has a p-value and an effect size, so the")
    say("dissertation can state which differences are real and which are not,")
    say("rather than leaving the reader to guess.")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("\nWritten to %s" % OUT)


if __name__ == "__main__":
    main()
