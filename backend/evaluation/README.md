# Evaluation scripts

Everything reported in Chapter 5 was produced by a script in this folder, and
every script writes its output to a file that is kept alongside it. This
README maps each claim in the dissertation to the code and the data behind
it, so any number can be traced or re-run.

Run everything from this directory, with the project virtualenv active:

```bash
cd backend/evaluation
../../.venv/Scripts/python.exe <script>.py      # Windows
../../.venv/bin/python <script>.py              # macOS / Linux
```

`backend/.env` must exist with `OPENAI_API_KEY` and `GEMINI_API_KEY` set —
copy `backend/.env.example` and fill it in. Scripts that call a provider are
marked below; the rest work offline against the CSVs already collected.

---

## Reproducing each claim

| Dissertation | Claim | Script | Output |
|---|---|---|---|
| §4.10 | Similarity threshold: in-scope 0.202–0.710, out-of-scope 0.144–0.390, margin 0.010 | `verify_threshold.py` | `threshold_distribution.csv` |
| §5.3 | Prompt injection: 16 of 16 held, both models | `prompt_injection_test.py` ² | `prompt_injection_results.csv` |
| §5.4 | Answer quality, GPT 4.67 vs Gemini 4.20 | `test_existing_scores.py` | `appendix_e_statistics.txt` |
| §5.4 | Significance: W = 7.0, p = 0.018, r = +0.79 | `test_existing_scores.py` | `appendix_e_statistics.txt` |
| §5.5 | Server-side latency per question | `run_latency_test.py` ² | `latency_results.csv` |
| §5.6 | Run-to-run consistency across three runs | `consistency_check.py` ² | `consistency_results.csv` |
| §5.7 | Inter-rater: κ = −0.174, AC1 = 0.347, 91.7% within one point | `inter_rater.py analyse` | `inter_rater_results.txt` |

² calls a live LLM provider and costs quota. The Gemini free tier allows
20 requests per project per model per day, which is why the collection
scripts below are resumable.

**The quickest check** is `test_existing_scores.py`. It needs no API key and
no rescoring — it reads the 60 scores already in Appendix E and reproduces
every significance figure in §5.4 in about a second.

---

## The scripts, by purpose

### Collecting answers

| Script | Purpose |
|---|---|
| `test_questions.py` | The 30-question evaluation set. Imported by the collectors rather than run directly. |
| `collect_answers_for_scoring.py` | Collects the answer set used for quality scoring, writing `quality_scoring_sheet.csv`. |
| `resume_answers_collection.py` | Continues a collection interrupted by a daily quota limit. |

### Measuring

| Script | Purpose |
|---|---|
| `verify_threshold.py` | Measures cosine similarity for all 30 questions against the knowledge base, and reports where the 0.40 threshold actually falls. This is the script that showed the margin is 0.010, not the comfortable gap originally claimed. |
| `run_latency_test.py`, `resume_latency_test.py` | Server-side generation time per question. |
| `consistency_check.py`, `retry_consistency_gemini_q27.py` | Repeats questions three times and measures how far the answers drift. |
| `prompt_injection_test.py` | Runs eight injection attacks against both models. |

### Scoring and statistics

| Script | Purpose |
|---|---|
| `test_existing_scores.py` | Wilcoxon signed-rank tests with rank-biserial effect sizes, on the 60 scores already in Appendix E. No new scoring required. |
| `inter_rater.py` | `prepare` draws a blind 20% sample for a second rater from `quality_scoring_sheet.csv` + `appendix_e_scores.csv`; `analyse` reads `second_rater_sheet.csv` + `second_rater_key.csv` (already scored) and reports quadratic weighted Cohen's κ, Gwet's AC1, and raw agreement. `analyse` needs no rescoring to reproduce the §5.7 figures. |

---

## Why AC1 sits beside kappa in `inter_rater.py`

Cohen's kappa misbehaves when both raters concentrate on a narrow band of the
scale: the chance-agreement term approaches 1, the denominator approaches 0,
and kappa can turn negative despite high raw agreement. That is exactly this
dataset — almost every answer scores 4 or 5, and kappa's chance term reaches
0.840. Gwet's AC1 uses a chance term that does not inflate with prevalence.

Both are reported, never one alone. Reporting only AC1 would be picking the
flattering statistic; reporting only kappa would misrepresent the data in the
other direction. §5.7 explains the divergence. See Feinstein and Cicchetti
(1990) and Gwet (2008).
