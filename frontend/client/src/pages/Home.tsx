/**
 * ShefGuide home design: an editorial arrivals desk.
 *
 * Meticulously balanced typography, aligned max-width containers (1280px),
 * symmetrical card grids, equalized visual heights, and harmonious spacing.
 */
import { Brand } from "@/components/Brand";
import { HowItWorks } from "@/components/HowItWorks";
import { PublicHeader } from "@/components/PublicHeader";
import {
  ArrowRight,
  Check,
  ChevronRight,
  MapPinned,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";

const guides = [
  {
    title: "Decode what your course is asking of you.",
    text: "Seminars, marking bands, critical evaluation, referencing. Explained in plain terms for international students.",
    href: "/chat",
    image: "/images/academic-culture.jpg",
    isHero: true,
  },
  {
    title: "Get the first few weeks onto one page.",
    text: "A personalised checklist for the things you actually have to do before and after arriving in Sheffield.",
    href: "/checklist",
    image: "/images/practical-start.jpg",
    isHero: false,
  },
  {
    title: "Add context when another student might help.",
    text: "Search what other students have already asked, and answer the questions you know from lived experience.",
    href: "/community",
    image: "/images/shared-questions.jpg",
    isHero: false,
  },
];

const notes = [
  {
    kicker: "Academic Culture",
    title: "What does ‘critically evaluate’ really mean?",
    body: "Start with the verbs in your brief and learn what a strong academic response needs to do in UK university assessments.",
    tags: ["Assessment Verbs", "Critical Synthesis", "Marking Bands"],
    tone: "#174CCF",
    border: "#C7D7FE",
    bg: "#EEF2FF",
  },
  {
    kicker: "Seminars & Discussion",
    title: "How do seminars work when you are new to them?",
    body: "How to prepare, what contributing actually looks like, and how to ask questions confidently when you have lost the thread.",
    tags: ["Class Participation", "Seminar Etiquette", "Group Speaking"],
    tone: "#B23F33",
    border: "#FECACA",
    bg: "#FEF2F2",
  },
  {
    kicker: "Arrival Essentials",
    title: "Which arrival tasks are actually urgent?",
    body: "Separate first-week essentials like GP and BRP from the things that can wait until you have settled into accommodation.",
    tags: ["GP Registration", "BRP Collection", "First 48 Hours"],
    tone: "#41694A",
    border: "#BBF7D0",
    bg: "#F0FDF4",
  },
];

export default function Home() {
  const [, navigate] = useLocation();
  const [question, setQuestion] = useState("");

  const openChat = (event: FormEvent) => {
    event.preventDefault();
    navigate(
      question.trim() ? `/chat?q=${encodeURIComponent(question)}` : "/chat"
    );
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F4F1E9] text-ink">
      {/* Campus-map linework printed across the whole sheet. Absolute rather
          than fixed, so it travels with the page and the surface reads as one
          continuous printed paper instead of a static backdrop. Sits under the
          content (z-0) and never intercepts a click. */}
      <div
        aria-hidden="true"
        className="paper-map pointer-events-none absolute inset-0 z-0 opacity-[0.5] mix-blend-multiply"
      />

      <div className="relative z-10">
        <PublicHeader />
      <main>
        {/* =========================================================================
            HERO SECTION
            ========================================================================= */}
        <section className="px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pb-16">
          <div className="mx-auto grid max-w-[1280px] items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
            <div>
              <p className="t-kicker text-signal">
                Academic support for international students
              </p>
              <h1 className="mt-4 text-balance t-hero text-ink">
                A calm place to work things out.
              </h1>
              <p className="mt-5 max-w-[50ch] text-pretty t-lead text-ink-muted">
                Clear support for UK university life, from academic expectations
                to the practical steps of starting somewhere new.
              </p>

              {/* Action Form */}
              <form onSubmit={openChat} className="mt-8 max-w-[500px]">
                <label
                  htmlFor="hero-question"
                  className="block t-label text-ink-soft"
                >
                  Ask a question
                </label>
                <div className="mt-2 flex items-stretch border border-[#C4B9A6] bg-[#FFFCF6] transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                  <input
                    id="hero-question"
                    value={question}
                    onChange={event => setQuestion(event.target.value)}
                    placeholder="How do UK seminars work?"
                    className="min-w-0 flex-1 bg-transparent px-4 py-3.5 t-input text-ink outline-none placeholder:text-[#6B7181]"
                  />
                  <button className="inline-flex shrink-0 items-center gap-2 bg-brand px-5 t-label text-white transition hover:bg-brand-deep active:bg-brand-deep cursor-pointer">
                    Ask <Send className="size-3.5" />
                  </button>
                </div>
              </form>
            </div>

            {/* The source file already carries its own parchment ground, map
                linework and tape marks, so a border, panel and drop shadow only
                fought it — they drew a hard rectangle around artwork that was
                meant to sit on the page. Frame removed and the edges feathered
                instead, so the image reads as printed on the same sheet. */}
            <figure className="relative aspect-[16/10]">
              <img
                src="/images/hero-students.jpg"
                width={1408}
                height={768}
                fetchPriority="high"
                decoding="async"
                className="edge-blend size-full object-cover"
                alt="Two students sitting together at a desk, tracing a route on a printed campus map beside an open laptop and notebooks"
              />
            </figure>
          </div>
        </section>

        {/* =========================================================================
            CHECKPOINTS / TRUST STRIP
            ========================================================================= */}
        {/* Translucent rather than solid: the band still lifts off the
            parchment, but the map linework runs through it instead of stopping
            dead at the border. */}
        <section className="border-y border-[#D9D1C3] bg-[#FFFCF6]/70 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="max-w-[34ch] text-balance t-subhead text-ink text-base sm:text-lg">
              A starting point for the questions that build up before you arrive.
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-2.5">
              {[
                "Academic expectations",
                "Practical arrival steps",
                "Course material in context",
                "Real human signposting",
              ].map(item => (
                <span
                  className="inline-flex items-center gap-2 border border-[#E8E1D5] bg-[#F4F0E8] px-3 py-1.5 t-caption font-semibold text-[#526078]"
                  key={item}
                >
                  <Check className="size-3.5 text-[#5E8B62]" strokeWidth={3} />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================================
            HOW IT WORKS SECTION
            ========================================================================= */}
        <HowItWorks />

        {/* =========================================================================
            FEATURES / WHAT'S INSIDE SECTION
            ========================================================================= */}
        <section
          id="features"
          className="border-y border-[#D6DED6] bg-[#EAEFEA] px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="mx-auto max-w-[1280px]">
            <div className="max-w-[58ch]">
              <p className="t-kicker text-signal">What’s inside</p>
              <h2 className="mt-2 text-balance t-section text-ink">
                Keep the right kind of help within reach.
              </h2>
              <p className="mt-3 text-pretty t-body text-[#525C74]">
                Move effortlessly between an answer, your arrival checklist, and what
                other students have asked.
              </p>
            </div>

            {/* Symmetrical Feature Grid: Top Hero Feature Card + 2 Balanced Lower Cards */}
            <div className="mt-10 space-y-5">
              {/* Top Hero Guide (Horizontal on Desktop) */}
              <article className="overflow-hidden border border-[#D5D2C8] bg-[#FFFCF6] shadow-[0_12px_24px_rgba(35,50,72,.05)] transition hover:-translate-y-0.5 grid lg:grid-cols-[1.15fr_1fr] items-stretch">
                <div className="relative min-h-[220px] sm:min-h-[280px] lg:min-h-full overflow-hidden">
                  <img
                    src={guides[0].image}
                    alt=""
                    className="size-full object-cover transition duration-500 hover:scale-[1.02]"
                  />
                </div>
                <div className="paper-note p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
                  <div>
                    <span className="t-kicker text-brand">Academic Guide</span>
                    <h3 className="mt-2 text-balance t-subhead text-ink text-xl sm:text-2xl">
                      {guides[0].title}
                    </h3>
                    <p className="mt-3 max-w-[46ch] text-pretty t-body text-ink-soft">
                      {guides[0].text}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(guides[0].href)}
                    className="mt-6 inline-flex w-fit items-center gap-2 t-label text-brand transition hover:gap-3 cursor-pointer"
                  >
                    Open this route <ArrowRight className="size-4" />
                  </button>
                </div>
              </article>

              {/* Bottom 2 Balanced Equal-Height Cards */}
              <div className="grid gap-5 md:grid-cols-2 items-stretch">
                {guides.slice(1).map((guide, idx) => (
                  <article
                    key={guide.title}
                    className="overflow-hidden border border-[#D5D2C8] bg-[#FFFCF6] shadow-[0_12px_24px_rgba(35,50,72,.05)] transition hover:-translate-y-0.5 flex flex-col justify-between"
                  >
                    <div className="relative h-48 sm:h-56 overflow-hidden">
                      <img
                        src={guide.image}
                        alt=""
                        className="size-full object-cover transition duration-500 hover:scale-[1.02]"
                      />
                    </div>
                    <div className="paper-note p-6 sm:p-7 flex flex-col justify-between flex-1">
                      <div>
                        <span className="t-kicker text-brand">
                          {idx === 0 ? "Arrival Roadmap" : "Community Knowledge"}
                        </span>
                        <h3 className="mt-2 text-balance t-subhead text-ink text-lg sm:text-xl">
                          {guide.title}
                        </h3>
                        <p className="mt-2.5 max-w-[44ch] text-pretty t-body-sm text-ink-soft">
                          {guide.text}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(guide.href)}
                        className="mt-6 inline-flex w-fit items-center gap-2 t-label text-brand transition hover:gap-3 cursor-pointer"
                      >
                        Open this route <ArrowRight className="size-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            CONVERSATION DETAIL SPLIT SECTION
            ========================================================================= */}
        {/* =========================================================================
            CONVERSATION DETAIL SPLIT SECTION (COMPACT & BALANCED)
            ========================================================================= */}
        <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <div className="mx-auto grid max-w-[1040px] overflow-hidden border border-[#D8D0C1] bg-[#FFFCF6] shadow-[0_8px_24px_rgba(35,50,72,.05)] md:grid-cols-[1fr_1.15fr]">
            {/* Left Column: Full-cover photo frame to eliminate oversized empty margins */}
            <div className="relative min-h-[240px] sm:min-h-[280px] md:min-h-full overflow-hidden bg-[#E7EDF8]">
              <img
                src="/images/chat-context.jpg"
                width={512}
                height={384}
                loading="lazy"
                decoding="async"
                alt="An assignment brief and a notebook of handwritten notes on a desk"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[#174CCF]/5 mix-blend-multiply pointer-events-none" />
            </div>

            {/* Right Column: Proportional editorial typography and crisp feature list */}
            <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
              <span className="t-kicker text-brand flex items-center gap-1.5 mb-1.5">
                <ShieldCheck className="size-3.5 text-[#5E8B62]" />
                Context & Grounding
              </span>
              <h2 className="text-balance t-subhead text-ink text-xl sm:text-2xl">
                Bring the detail into the conversation.
              </h2>
              <p className="mt-2.5 max-w-[46ch] text-pretty t-body-sm text-[#525C74]">
                Attach a brief or a reading when it helps. Pick the mode that
                fits, then decide whether the answer belongs in your notes or on
                the community board.
              </p>
              <div className="mt-5 space-y-3">
                {[
                  [
                    "Two ways to ask",
                    "Switch between a clear quick explanation and a more thorough academic response.",
                  ],
                  [
                    "One answer, more context",
                    "Use your own course material as a reference point for the conversation.",
                  ],
                  [
                    "Where the answers stop",
                    "Get signposted to a real person for medical, legal, financial or wellbeing concerns.",
                  ],
                ].map(([title, body]) => (
                  <div className="flex items-start gap-2.5" key={title}>
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#5E8B62]" />
                    <div>
                      <p className="t-label font-semibold text-[#243453]">{title}</p>
                      <p className="mt-0.5 max-w-[44ch] text-pretty t-caption text-ink-soft">
                        {body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate("/chat")}
                className="focus-ring mt-6 inline-flex w-fit items-center gap-2 bg-brand px-4.5 py-2.5 t-label text-white shadow-xs transition hover:-translate-y-0.5 hover:bg-brand-deep"
              >
                Open the chat workspace <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================================
            HUMAN SIGNPOSTING CALLOUT
            ========================================================================= */}
        <section className="border-y border-[#DED6C8] bg-[#FFFCF6] px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1280px]">
            <div className="mx-auto flex max-w-[840px] flex-col items-center justify-center text-center">
              <span className="grid size-10 place-items-center border border-[#F1C4BD] bg-[#FDF1EF] text-[#C6493D]">
                <MapPinned className="size-5" />
              </span>
              <h2 className="mt-4 text-balance t-section text-ink text-xl sm:text-2xl">
                Some questions should go to a person, not a chatbot.
              </h2>
              <p className="mt-3 max-w-[58ch] text-pretty t-body text-[#525C74] text-sm sm:text-base">
                ShefGuide helps you make sense of student life. For anything
                medical, immigration, legal, financial or mental-health related,
                it points you directly at qualified university and UK services.
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            FIELD NOTES SECTION (SYMMETRICALLY ALIGNED)
            ========================================================================= */}
        <section
          id="field-notes"
          className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="mx-auto max-w-[1280px]">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-[#D8D0C1] pb-4">
              <div>
                <p className="t-kicker text-signal">Common starting points</p>
                <h2 className="mt-1 text-balance t-section text-ink">
                  Three places to begin.
                </h2>
              </div>
              <button
                onClick={() => navigate("/chat")}
                className="py-1 inline-flex items-center gap-2 t-label text-brand transition hover:gap-3 cursor-pointer"
              >
                Ask a different question <ArrowRight className="size-4" />
              </button>
            </div>

            {/* Symmetrical 3-Column Grid with Equalized Heights & No Dead Space */}
            <div className="mt-8 grid gap-6 md:grid-cols-3 items-stretch">
              {notes.map(note => (
                <article
                  key={note.title}
                  className="paper-note group relative flex flex-col justify-between border border-[#D7D1C2] bg-[#FFFCF6] p-6 sm:p-7 transition hover:-translate-y-1 shadow-xs hover:border-brand/40"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="t-kicker font-bold"
                        style={{ color: note.tone }}
                      >
                        {note.kicker}
                      </span>
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: note.tone }}
                      />
                    </div>

                    <h3 className="mt-3 text-balance t-subhead text-ink text-lg sm:text-xl font-bold">
                      {note.title}
                    </h3>

                    <p className="mt-3 text-pretty t-body-sm text-ink-muted leading-relaxed">
                      {note.body}
                    </p>

                    {/* Example Topic Tags */}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {note.tags.map(tag => (
                        <span
                          key={tag}
                          className="border border-[#E5DFD4] bg-[#FAF7F1] px-2 py-0.5 t-caption text-ink-soft"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      navigate(`/chat?q=${encodeURIComponent(note.title)}`)
                    }
                    className="mt-6 pt-4 border-t border-[#EFE9DE] inline-flex w-full items-center justify-between t-label text-brand transition group-hover:text-brand-deep cursor-pointer"
                  >
                    <span>Take this to chat</span>
                    <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================================
            BOTTOM CTA CALLOUT BANNER
            ========================================================================= */}
        <section className="px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
          <div className="relative mx-auto overflow-hidden border border-[#CCD9D3] bg-[#DDE8E2] p-8 sm:p-12 lg:max-w-[1280px] lg:p-14 shadow-xs">
            {/* Cobalt ring, bled off the right edge. A genuinely circular motif
                rather than a rounded rectangle, so it sits inside the
                square-corner lock, and held at 10% so it stays a ground note
                behind the actions rather than competing with them. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 top-1/2 hidden size-[30rem] -translate-y-1/2 rounded-full border-[2.75rem] border-brand/10 sm:block"
            />

            <div className="relative grid gap-6 lg:grid-cols-[1.3fr_auto] lg:items-center">
              <div>
                <h2 className="text-balance t-section text-ink text-2xl sm:text-3xl">
                  Start with the question you have today.
                </h2>
                <p className="mt-3 max-w-[54ch] text-pretty t-body text-ink-muted">
                  You do not need the right words to start. Begin as an anonymous visitor,
                  and save your route when you want to come back to it.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigate("/chat")}
                  className="focus-ring inline-flex items-center gap-2 bg-brand px-5 py-3 t-label text-white shadow-xs transition hover:-translate-y-0.5 hover:bg-brand-deep"
                >
                  Ask ShefGuide <ArrowRight className="size-4" />
                </button>
                <button
                  onClick={() => navigate("/sign-up")}
                  className="inline-flex items-center gap-2 border border-[#B8CABE] bg-[#FFFCF6] px-5 py-3 t-label text-brand transition hover:-translate-y-0.5 cursor-pointer"
                >
                  Save your route <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          FOOTER (MOBILE: EXPLORE & WORKSPACE OPPOSITE, SUPPORT CENTERED UNDERNEATH)
          ========================================================================= */}
      <footer className="relative bg-[#0C1935] px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="paper-grid absolute inset-0 opacity-[.08]" />
        <div className="relative mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[1.4fr_1.8fr]">
          {/* Brand Info */}
          <div>
            <Brand tone="light" />
            <p className="mt-4 max-w-[38ch] text-pretty t-body-sm t-on-dark text-white/75">
              Academic and practical support for international students in UK
              higher education.
            </p>
          </div>

          {/* Links Grid: 2 columns on mobile (Explore & Workspace opposite), Support centered underneath; 3 columns on desktop */}
          <div className="grid grid-cols-2 gap-y-8 gap-x-6 sm:gap-8 lg:grid-cols-3">
            {/* Explore Column */}
            <div>
              <p className="t-kicker text-[#AFC5FF]">Explore</p>
              <div className="mt-3 flex flex-col gap-2.5 t-body-sm t-on-dark text-white/80">
                <a href="#how-it-works" className="hover:text-white transition">
                  How it works
                </a>
                <a href="#features" className="hover:text-white transition">
                  What’s inside
                </a>
                <a href="#field-notes" className="hover:text-white transition">
                  Field notes
                </a>
              </div>
            </div>

            {/* Workspace Column (Opposite Explore on Mobile) */}
            <div>
              <p className="t-kicker text-[#AFC5FF]">Workspace</p>
              <div className="mt-3 flex flex-col gap-2.5 t-body-sm t-on-dark text-white/80">
                <button
                  onClick={() => navigate("/chat")}
                  className="w-fit text-left hover:text-white transition cursor-pointer"
                >
                  Ask ShefGuide
                </button>
                <button
                  onClick={() => navigate("/checklist")}
                  className="w-fit text-left hover:text-white transition cursor-pointer"
                >
                  Your checklist
                </button>
                <button
                  onClick={() => navigate("/community")}
                  className="w-fit text-left hover:text-white transition cursor-pointer"
                >
                  Community Q&A
                </button>
              </div>
            </div>

            {/* Support Column (Centered in the middle underneath on mobile) */}
            <div className="col-span-2 flex flex-col items-center text-center lg:col-span-1 lg:items-start lg:text-left">
              <p className="t-kicker text-[#AFC5FF]">Support</p>
              <div className="mt-3 flex flex-col items-center lg:items-start gap-2.5 t-body-sm t-on-dark text-white/80">
                <a href="/policy" className="hover:text-white transition">
                  Privacy & Safety
                </a>
                <a href="/sign-in" className="hover:text-white transition">
                  Sign in
                </a>
                <a href="/sign-up" className="hover:text-white transition">
                  Register
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="relative mx-auto mt-10 flex max-w-[1280px] flex-col gap-3 border-t border-white/10 pt-6 t-caption t-on-dark text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <span>ShefGuide · Built for international students in the UK.</span>
          <span>Academic support, not specialist legal or medical advice.</span>
        </div>
      </footer>
      </div>
    </div>
  );
}
