---
target: frontend/ (index, chat, qa, checklist, auth)
total_score: 19
p0_count: 2
p1_count: 2
timestamp: 2026-07-30T14-44-17Z
slug: frontend-index-chat-qa-checklist-auth
---
Method: dual-agent (A: ab69eb0c60490b770 · B: af906af7cb131fcae)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No typing indicator/skeleton during multi-second GPT-4o-mini/Gemini calls in chat.html or qa.html — only a disabled button |
| 2 | Match System / Real World | 3 | "OpenAI servers (US)" badge injects backend jargon a non-technical international student has no frame for |
| 3 | User Control and Freedom | 2 | Cancelling the disclosure modal silently drops the in-flight message with no retry affordance |
| 4 | Consistency and Standards | 1 | qa.html hardcodes raw hex (#E6F4EA, #148F77, #005142, #F59E0B) instead of the Tailwind tokens already defined in its own config |
| 5 | Error Prevention | 2 | qa.html's post-btn is never disabled during its own async handler — double-click creates duplicate posts |
| 6 | Recognition Rather Than Recall | 3 | wireHeader() correctly sets aria-current and active-link styling everywhere |
| 7 | Flexibility and Efficiency | 2 | No message edit/regenerate, no keyboard-shortcut discoverability |
| 8 | Aesthetic and Minimalist Design | 1 | Decorative blur blobs, pulsing dots, gradient stripes on product screens that should be restrained |
| 9 | Error Recovery | 2 | chat.html has a styled error bubble; qa.html and checklist.html fall back to raw alert() for the same failure class |
| 10 | Help and Documentation | 1 | No FAQ, tooltip, or onboarding anywhere |
| **Total** | | **19/40** | **Poor — major UX issues, core flows work but rough** |

## Anti-Patterns Verdict

**LLM assessment (Assessment A)**: The landing page reads as an unedited AI-SaaS template — hero pill badge, pulsing dot, glow-behind-search-bar, bouncing floating notification cards, avatar-stack social proof, dark hero-metric stats band, and four feature cards each stamped with a giant faded 01/02/03/04 watermark that isn't a real sequence. Nothing distinguishes it as built specifically for Sheffield international students; it would work unchanged for any AI-SaaS product. The app pages are mixed: `auth.html` is plain and passes the product bar; `chat.html`, `qa.html`, and `checklist.html` carry decorative blur/pulse motion and reintroduce the banned side-stripe-accent pattern (a gradient top-bar and an amber left-bar in qa.html) into what should be a restrained product surface.

**Deterministic scan (Assessment B)**: `detect.mjs` found 7 issues across the 5 files — 5× "overused-font" (Inter, warning, one per file) and 1× "numbered-section-markers" (advisory, index.html). Both confirmed as true positives on manual inspection: Inter genuinely carries body/label text everywhere, and the 01–04 numerals sit behind four unordered feature cards with no real sequence. No false positives found.

**Visual overlays**: Not available — no browser automation tool in this session, so no live-page overlay could be injected. This critique is code review + deterministic scan only; treat the visual/interaction findings above as informed by source inspection, not live rendering.

## Overall Impression

The functional core is real and mostly works — auth, dual-model chat, PDF Q&A, community board, AI-personalised checklist all wired to a live backend, with some genuinely thoughtful engineering (query-preservation across the login wall, a real animated progress ring). But the visual layer is unedited Stitch output layered onto that functionality: the landing page is generic AI-SaaS, and the "product" screens inherited the landing page's decorative instincts (blur blobs, pulsing badges, stripe accents) instead of the restraint the product register calls for. The single biggest opportunity: fix the moment where these two failures compound — the chat flow's disclosure-modal-after-the-fact interruption, which turns the app's best feature (query-preserving auth detour) into its worst first impression.

## What's Working

1. **Query-preservation across the auth detour** (`index.html`'s `goAskAI()` → `auth.html?next=...` → `chat.html?q=...` auto-send) — deliberate engineering that respects user intent across a login wall most teams would just drop.
2. **Checklist progress ring** (`checklist.html`) — a real SVG circular progress indicator with eased fill and threshold-based encouragement copy, tied to the emotional arc of "settling in" rather than decoration for its own sake.
3. **Consistent `escapeHtml()` discipline in `app.js`** — every dynamic interpolation across chat, Q&A, replies, and document Q&A routes through the same escaping helper before hitting `innerHTML`.

## Priority Issues

**[P0] Native `alert()` breaks the design system at error moments**
- Why it matters: `qa.html`'s `getAiAnswer()` and `checklist.html`'s `generate-btn` handler fall back to an unstyled, blocking system dialog for the exact same failure class `chat.html` handles with a custom styled bubble — it reads as broken, not designed, at the worst possible moment (a failed AI call).
- Fix: replace both `alert()` calls with the same inline status/toast pattern `qa.html`'s `post-status` already uses.
- Suggested command: `/impeccable harden`

**[P0] No loading feedback during AI latency**
- Why it matters: chat, Q&A AI-answers, and checklist generation only disable a button during multi-second LLM calls with zero typing indicator or skeleton — first-time users will assume the app froze and re-click, compounding the P1 double-post bug below, or abandon.
- Fix: add a typing-indicator bubble in chat, a skeleton AI-answer card in Q&A, and a clearer in-progress state on the checklist generate button.
- Suggested command: `/impeccable polish`

**[P1] Design tokens already diverging + banned stripe-accent pattern reintroduced**
- Why it matters: `qa.html` hardcodes raw hex instead of the tokens defined in its own Tailwind config, and reuses the explicitly-banned colored-side-stripe pattern twice with no shared meaning — the "system" has already drifted within one file.
- Fix: replace inline hex with existing tokens; remove both stripe accents; give AI-generated content a distinct badge treatment instead of a bar.
- Suggested command: `/impeccable audit`

**[P1] Accessibility: unbound labels, no keyboard support on custom controls, unlabeled disclosure dialog**
- Why it matters: every `<label>` in `auth.html` lacks a `for`/`id` pairing (screen readers announce unlabeled fields at registration — the very first task); several inputs across chat/qa are placeholder-only with no label at all; the header avatar (`data-role="avatar"`, wired in `app.js`) has a click handler but no `role`, `tabindex`, or keyboard handler, making it unreachable by keyboard; the disclosure consent modal — the one legally-relevant screen in the app — is a plain `<div>` with no `role="dialog"`, no focus trap, and no focus return.
- Fix: bind every label via `for`/`id`; add `role="button" tabindex="0"` + Enter/Space handling to the avatar; give the disclosure modal proper dialog semantics and a focus trap.
- Suggested command: `/impeccable harden`

**[P2] Decorative motion/blur bleeding from brand into product surfaces**
- Why it matters: `chat.html` and `checklist.html` carry blurred gradient blobs and pulsing badges into authenticated task screens, and no page anywhere respects `prefers-reduced-motion` — this adds noise around actual task content on the two busiest screens and offers no motion opt-out.
- Fix: strip decorative blur/pulse from the three product pages; add a global reduced-motion rule.
- Suggested command: `/impeccable quieter`

## Persona Red Flags

**Jordan (first-timer international student)**: Registering, `home_country`/`programme` aren't marked `required`, so Jordan can submit and get an error only after the fact. Landing in `chat.html?q=...` with an auto-sent question, the user bubble renders *before* the disclosure modal appears — the question looks already sent, then Jordan is unexpectedly asked to consent to sending it, which reads backwards for someone already anxious about data privacy around visa/academic content. If Jordan clicks Cancel (a reasonable first reaction), the message is silently dropped with zero explanation — exactly the break in the primary "ask a question → get an answer" flow this critique was asked to trace.

**Sam (accessibility/screen reader/keyboard-only)**: Cannot reliably register — no label is programmatically bound to any input in `auth.html`. The category picker and model toggle communicate selection purely via background-color class swaps, with no `aria-pressed`/`aria-selected`, so Sam has no way to know what's currently selected. The disclosure consent overlay has no dialog semantics or focus trap — the single most legally important screen in the app is also the least accessible.

**Riley (stress tester)**: `qa.html`'s post button isn't disabled during its own async handler, so rapid double-clicks create duplicate posts. A failed PDF upload just rewrites the hint text in the same gray styling — no red state, no icon — so repeated bad uploads get progressively less noticeable, not more.

## Minor Observations

- Tailwind CDN + a full inline JIT config duplicated verbatim across all 5 HTML files — already drifting (qa.html's hardcoded hex), and a real maintenance liability.
- Two separate near-identical color tokens (`primary` #002444 and `deep-navy` #1A3A5C) used interchangeably for headline text — risk of unintentional drift.
- "About" nav/footer links point at `index.html` itself; there is no About page — a dead promise in the IA.
- Inconsistent `<title>` tag formatting across pages.
- No documented z-index scale; values assigned ad hoc per component.
- Checklist "done" state lives only in `localStorage` despite the checklist being server-generated — clearing storage or switching devices silently wipes progress with no warning.
- Global `::-webkit-scrollbar{display:none}` re-enabled with a custom thin scrollbar only in specific containers — a two-tier custom scrollbar system (a banned "reinvented standard affordance").
- The disclosure modal in `app.js` is the one hand-rolled component using raw inline styles/hex instead of the Tailwind token system used everywhere else.
- Contrast: `teal-accent` text/labels and white-on-teal button text measure ~4.02:1, under the 4.5:1 body-text threshold (not large/bold enough for the 3:1 exception); placeholder text color (`outline` #73777f) measures ~4.29–4.49:1, just under threshold.
- All images (10/10 non-auth) are hot-linked to `lh3.googleusercontent.com`; `checklist.html`'s footer logo is additionally missing `alt` entirely (the only image on any page without one).
- chat.html/qa.html/checklist.html each load two separate, overlapping Material Symbols font requests — a redundant blocking round-trip.
- `qa.html`'s `submitReply()` does an unguarded `querySelector` that could throw if the post list re-renders between click and read.

## Questions to Consider

- If every decorative blur blob, floating bounce card, and numbered feature card were stripped from `index.html`, would anything distinctly "ShefGuide" remain?
- Why does the single riskiest moment in the product — sending visa letters and personal academic questions to a third-party LLM — get a one-time, easily-forgotten consent checkbox instead of persistent, unmissable framing in the surface where it actually happens?
- Should the "AI Answer" block in Community Q&A visually resemble a peer reply at all, given it's a cached LLM generation triggered by a button click?
- What breaks if the three authenticated pages' duplicated header/auth logic and three different error-handling patterns were consolidated into one shared layer instead of three independently hand-edited Stitch exports?
