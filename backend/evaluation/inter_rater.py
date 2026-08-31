"""Inter-rater reliability for the answer-quality scores.

Every score in the evaluation was assigned by the person who built the
system. That is a conflict of interest, and without a second rater the
quality figures cannot be defended against it. This script does two things:

  prepare  - draws a random, blinded sample for a second rater to score
  analyse  - compares the two sets of scores and reports agreement

Agreement is reported as quadratic weighted Cohen's kappa. The weighting
matters: the rubric is ordinal, so two raters differing by one point have
almost agreed, while differing by four points have not. Unweighted kappa
would treat those as the same disagreement.

Usage (from backend/evaluation/):
    python inter_rater.py prepare        writes second_rater_sheet.csv
    python inter_rater.py analyse        reads it back, reports kappa

The second rater receives the rubric from Section 3.6 and nothing else.
They must not see the model, the retrieval condition, or the first rater's
scores - all three are stripped from the sheet they are given.
"""

import random
import sys

import pandas as pd
from sklearn.metrics import cohen_kappa_score

ANSWERS = "quality_scoring_sheet.csv"   # question + answer text
SCORES = "appendix_e_scores.csv"        # the final scores that were kept
SHEET = "second_rater_sheet.csv"
SAMPLE_FRACTION = 0.20
RANDOM_SEED = 20260916   # fixed so the sample is reproducible and auditable


def prepare() -> None:
    """Draw a fresh blind sample for a second rater.

    The answer text and the final scores live in two different files -
    quality_scoring_sheet.csv was the blank template later scored, and
    appendix_e_scores.csv holds the scores actually reported in Chapter 5 -
    so this joins them on (question_id, model) rather than trusting either
    file alone. There is no retrieval condition to carry, since Appendix E
    was never part of the retrieval ablation (that study was dropped; see
    git history if it needs revisiting).
    """
    # The two files name models differently ("GPT-4o-mini (OpenAI)" vs
    # "gpt"), so the join key is normalised to the short form before merging.
    def short_model(name: str) -> str:
        name = str(name).lower()
        if "gpt" in name:
            return "gpt"
        if "gemini" in name:
            return "gemini"
        return name

    answers = pd.read_csv(ANSWERS)[["question_id", "model", "question", "answer"]]
    answers["model"] = answers["model"].map(short_model)
    scores = pd.read_csv(SCORES)[["question_id", "model", "score_0_5"]]
    scores["model"] = scores["model"].map(short_model)
    df = answers.merge(scores, on=["question_id", "model"], how="inner")
    df = df[df.answer.notna() & ~df.answer.astype(str).str.startswith("[")]
    df = df.drop_duplicates(subset=["question_id", "model"], keep="last")
    scored = df[df.score_0_5.notna()]

    if scored.empty:
        print("Nothing scored yet. Score %s first, then run prepare." % SCORES)
        return

    n = max(12, round(len(scored) * SAMPLE_FRACTION))
    n = min(n, len(scored))
    sample = scored.sample(n=n, random_state=RANDOM_SEED)

    # Shuffle so the order carries no signal about model, and drop every
    # column that would tell the rater what they are looking at.
    sample = sample.sample(frac=1, random_state=RANDOM_SEED + 1).reset_index(drop=True)
    sheet = pd.DataFrame({
        "row_id": range(1, len(sample) + 1),
        "question": sample.question.values,
        "answer": sample.answer.values,
        "score_0_5": "",
        "notes": "",
    })
    sheet.to_csv(SHEET, index=False, encoding="utf-8")

    # The key stays with the first rater, not with the sheet.
    key = pd.DataFrame({
        "row_id": range(1, len(sample) + 1),
        "question_id": sample.question_id.values,
        "model": sample.model.values,
        "rater1_score": sample.score_0_5.values,
    })
    key.to_csv("second_rater_key.csv", index=False, encoding="utf-8")

    print("Wrote %s: %d answers, %.0f%% of the %d scored."
          % (SHEET, len(sheet), 100 * len(sheet) / len(scored), len(scored)))
    print("Wrote second_rater_key.csv - keep this; do not give it to the rater.")
    print()
    print("Give the rater: %s, plus the rubric from Section 3.6." % SHEET)
    print("They fill in score_0_5 only. Then run:  python inter_rater.py analyse")


def analyse() -> None:
    sheet = pd.read_csv(SHEET)
    key = pd.read_csv("second_rater_key.csv")

    merged = key.merge(sheet[["row_id", "score_0_5"]], on="row_id")
    merged = merged.rename(columns={"score_0_5": "rater2_score"})
    merged = merged[merged.rater2_score.notna()]

    if merged.empty:
        print("%s has no second-rater scores yet." % SHEET)
        return

    r1 = pd.to_numeric(merged.rater1_score, errors="coerce")
    r2 = pd.to_numeric(merged.rater2_score, errors="coerce")
    ok = r1.notna() & r2.notna()
    r1, r2 = r1[ok].astype(int), r2[ok].astype(int)

    kappa = cohen_kappa_score(r1, r2, weights="quadratic")
    exact = (r1 == r2).mean()
    within_one = (abs(r1 - r2) <= 1).mean()
    ac1, _ = gwet_ac1(r1, r2)
    p_e = kappa_chance_agreement(r1, r2)

    print("Inter-rater reliability")
    print("=" * 23)
    print("  answers double-scored : %d" % len(r1))
    print("  rater 1 mean          : %.3f" % r1.mean())
    print("  rater 2 mean          : %.3f" % r2.mean())
    print("  exact agreement       : %.1f%%" % (100 * exact))
    print("  within one point      : %.1f%%" % (100 * within_one))
    print("  mean absolute diff    : %.3f" % (abs(r1 - r2)).mean())
    print("  quadratic weighted k  : %.3f  (%s)" % (kappa, interpret(kappa)))
    print("  Gwet's AC1            : %.3f  (%s)" % (ac1, interpret(ac1)))
    print()
    if p_e > 0.7:
        print("  Note: both raters concentrated on a narrow band of the scale, so")
        print("  kappa's chance-agreement term is %.3f. Dividing by 1 - %.3f makes" % (p_e, p_e))
        print("  kappa unstable here; AC1 and the raw percentages are the honest")
        print("  figures to report alongside it. See Feinstein and Cicchetti (1990).")
        print()
    disagreements = merged[abs(r1 - r2) >= 2]
    if len(disagreements):
        print("  Answers differing by 2 or more (worth re-reading together):")
        for _, row in disagreements.iterrows():
            # The retrieval column is absent when the sample is drawn from
            # Appendix E, which predates the retrieval condition.
            cond = ("  retrieval=%s" % row.retrieval
                    if "retrieval" in merged.columns else "")
            print("    q%-3s %-7s%s  rater1=%s rater2=%s"
                  % (row.question_id, row.model, cond,
                     row.rater1_score, row.rater2_score))
    else:
        print("  No answer differed by 2 or more points.")


def gwet_ac1(r1, r2) -> tuple[float, float]:
    """Gwet's AC1, plus kappa's own chance-agreement term for comparison.

    Cohen's kappa misbehaves when both raters concentrate on one category:
    the chance-agreement term approaches 1, the denominator approaches 0, and
    kappa can go negative despite high raw agreement. That is this dataset -
    most answers score 4 or 5. AC1 uses a chance term that does not inflate
    with prevalence, so it is the appropriate companion statistic rather than
    a more flattering substitute for an inconvenient number. Both are
    reported. See Feinstein and Cicchetti (1990), and Gwet (2008).
    """
    import numpy as np
    cats = sorted(set(r1) | set(r2))
    n, q = len(r1), len(cats)
    if q < 2:
        return 1.0, 1.0
    p_a = (r1 == r2).mean()
    pi = {c: ((r1 == c).sum() + (r2 == c).sum()) / (2 * n) for c in cats}
    p_e = sum(pi[c] * (1 - pi[c]) for c in cats) / (q - 1)
    return (p_a - p_e) / (1 - p_e), p_e


def kappa_chance_agreement(r1, r2) -> float:
    """The expected-agreement term inside quadratic weighted kappa.

    Reported because it is what explains a negative kappa here: when it
    approaches 1, kappa divides by a vanishing denominator.
    """
    import numpy as np
    import pandas as _pd
    cats = sorted(set(r1) | set(r2))
    q = len(cats)
    if q < 2:
        return 1.0
    o = _pd.crosstab(r1, r2).reindex(index=cats, columns=cats,
                                     fill_value=0).values
    n = o.sum()
    w = np.array([[1 - ((i - j) ** 2) / ((q - 1) ** 2) for j in range(q)]
                  for i in range(q)])
    return float((w * np.outer(o.sum(1) / n, o.sum(0) / n)).sum())


def interpret(k: float) -> str:
    """Landis and Koch (1977) bands, the convention for reporting kappa."""
    if k < 0.00:
        return "poor"
    if k < 0.21:
        return "slight"
    if k < 0.41:
        return "fair"
    if k < 0.61:
        return "moderate"
    if k < 0.81:
        return "substantial"
    return "almost perfect"


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "prepare":
        prepare()
    elif command == "analyse":
        analyse()
    else:
        print(__doc__)
