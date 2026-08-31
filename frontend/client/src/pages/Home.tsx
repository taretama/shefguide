/**
 * ShefGuide home design reminder: an editorial arrivals desk, not a SaaS landing page.
 * Ink and paper carry major surfaces; cobalt only marks a route, action or guide signal.
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
    text: "Seminars, marking bands, critical evaluation, referencing. Explained in plain terms.",
    href: "/chat",
    image: "/images/academic-culture.jpg",
    span: "lg:col-span-2",
  },
  {
    title: "Get the first few weeks onto one page.",
    text: "A personalised checklist for the things you actually have to do.",
    href: "/checklist",
    image: "/images/practical-start.jpg",
    span: "",
  },
  {
    title: "Add context when another student might help.",
    text: "Search what other students have already asked, and answer the ones you know.",
    href: "/community",
    image: "/images/shared-questions.jpg",
    span: "",
  },
];

const notes = [
  [
    "What does ‘critically evaluate’ really mean?",
    "Start with the verbs in your brief and learn what a strong academic response needs to do.",
  ],
  [
    "How do seminars work when you are new to them?",
    "How to prepare, what contributing actually looks like, and how to ask when you have lost the thread.",
  ],
  [
    "Which arrival tasks are actually urgent?",
    "Separate first-week essentials from the things that can wait until you have settled.",
  ],
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
    <div className="min-h-screen overflow-x-hidden bg-[#F4F1E9] text-ink">
      <PublicHeader />
      <main>
        {/* Hero. Light paper rather than the old navy slab: the photograph
          already carries the navy accents and the map linework, so the page
          lets it do that work instead of competing with it. */}
        <section className="px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pb-16">
          <div className="mx-auto grid max-w-[1240px] items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
            <div>
              <p className="t-kicker text-signal">
                Academic support for international students
              </p>
              <h1 className="mt-5 text-balance t-hero text-ink">
                A calm place to work things out.
              </h1>
              <p className="mt-6 max-w-[52ch] text-pretty t-lead text-ink-muted">
                Clear support for UK university life, from academic expectations
                to the practical steps of starting somewhere new.
              </p>

              {/* The one action in the hero. Asking is the product, so the field is
                the call to action rather than a link that leads to another field.
                Submitting empty still opens the chat, which is what the old
                "Start with a question" link did. */}
              <form onSubmit={openChat} className="mt-10 max-w-[520px]">
                <label
                  htmlFor="hero-question"
                  className="block t-label text-ink-soft"
                >
                  Ask a question
                </label>
                <div className="mt-2.5 flex items-stretch border border-[#C4B9A6] bg-[#FFFCF6] transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                  <input
                    id="hero-question"
                    value={question}
                    onChange={event => setQuestion(event.target.value)}
                    placeholder="How do UK seminars work?"
                    className="min-w-0 flex-1 bg-transparent px-4 py-3.5 t-input text-ink outline-none placeholder:text-[#6B7181]"
                  />
                  <button className="inline-flex shrink-0 items-center gap-2 bg-brand px-5 t-label text-white transition hover:bg-brand-deep active:bg-brand-deep">
                    Ask <Send className="size-3.5" />
                  </button>
                </div>
              </form>
            </div>

            {/* The asset is a composited graphic: the photograph is pasted onto a
              cream map-linework board with navy tape wedges at the corners. The
              frame crops to the photograph itself, so the mounting board and the
              decorative tape stay out of the hero and the picture reads as one
              image rather than a pinned cut-out. */}
            <figure className="relative aspect-[16/9] overflow-hidden">
              <img
                src="/images/hero-students.jpg"
                width={1408}
                height={768}
                fetchPriority="high"
                decoding="async"
                className="absolute left-1/2 top-1/2 w-[164%] max-w-none -translate-x-[55.75%] -translate-y-[48.2%]"
                alt="Two students sitting together at a desk, tracing a route on a printed campus map beside an open laptop and notebooks"
              />
            </figure>
          </div>
        </section>

        <section className="border-y border-[#D9D1C3] bg-[#FFFCF6] px-4 py-6 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1370px] flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <p className="max-w-[34ch] text-balance t-subhead text-ink">
              A starting point for the questions that build up before you
              arrive.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {[
                "Academic expectations",
                "Practical arrival steps",
                "Course material in context",
                "Real human signposting",
              ].map(item => (
                <span
                  className="inline-flex items-center gap-2 bg-[#F4F0E8] px-3 py-2 t-caption text-[#526078]"
                  key={item}
                >
                  <Check className="size-3.5 text-[#5E8B62]" strokeWidth={3} />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <HowItWorks />

        <section
          id="features"
          className="border-y border-[#D6DED6] bg-[#EAEFEA] px-4 py-20 sm:px-6 lg:px-10 lg:py-28"
        >
          <div className="mx-auto max-w-[1370px]">
            <div className="max-w-[62ch]">
              <h2 className="text-balance t-section text-ink">
                Keep the right kind of help within reach.
              </h2>
              <p className="mt-5 text-pretty t-body text-[#525C74]">
                Move between an answer, your checklist, and what other students
                have asked.
              </p>
            </div>
            <div className="mt-12 grid gap-4 lg:grid-cols-2">
              {guides.map((guide, index) => (
                <article
                  key={guide.title}
                  className={`overflow-hidden border border-[#D5D2C8] bg-[#FFFCF6] shadow-[0_14px_28px_rgba(35,50,72,.06)] transition hover:-translate-y-1 ${guide.span}`}
                >
                  <div className="relative h-44 overflow-hidden sm:h-56 lg:h-80">
                    <img
                      src={guide.image}
                      alt=""
                      className="size-full object-cover transition duration-500 hover:scale-[1.03]"
                    />
                  </div>
                  <div className="paper-note p-6">
                    <h3 className="max-w-[26ch] text-balance t-subhead text-ink">
                      {guide.title}
                    </h3>
                    <p className="mt-3 max-w-[46ch] text-pretty t-body-sm text-ink-soft">
                      {guide.text}
                    </p>
                    <button
                      onClick={() => navigate(guide.href)}
                      className="py-1.5 -my-1.5 mt-5 inline-flex items-center gap-2 t-label text-brand transition hover:gap-3"
                    >
                      Open this route <ArrowRight className="size-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="mx-auto grid max-w-[1370px] overflow-hidden border border-[#D8D0C1] bg-[#FFFCF6] lg:grid-cols-[1.05fr_.95fr]">
            {/* The panel used to hold a chat UI built out of divs: a fake header, a fake question and a fake answer. It has been replaced by the photograph that was already here, buried in the corner. The real chat lives at /chat; a hand-built imitation of it only drifts out of date. */}
            <div className="flex min-h-[420px] items-center justify-center bg-[#E7EDF8] p-6 sm:p-10">
              <img
                src="/images/chat-context.jpg"
                width={512}
                height={384}
                loading="lazy"
                decoding="async"
                alt="An assignment brief and a notebook of handwritten notes on a desk"
                className="w-full max-w-[480px] shadow-[0_18px_36px_rgba(31,61,130,.14)]"
              />
            </div>
            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
              <h2 className="max-w-[16ch] text-balance t-section text-ink">
                Bring the detail into the conversation.
              </h2>
              <p className="mt-5 max-w-[52ch] text-pretty t-body text-[#525C74]">
                Attach a brief or a reading when it helps. Pick the mode that
                fits, then decide whether the answer belongs in your notes or on
                the community board.
              </p>
              <div className="mt-7 space-y-4">
                {[
                  [
                    "Two ways to ask",
                    "Switch between a clear explanation and a more thorough response.",
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
                  <div className="flex gap-3" key={title}>
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#5E8B62]" />
                    <div>
                      <p className="t-title text-[#243453]">{title}</p>
                      <p className="mt-1.5 max-w-[50ch] text-pretty t-body-sm text-ink-soft">
                        {body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate("/chat")}
                className="mt-8 inline-flex w-fit items-center gap-2 bg-[#174CCF] px-5 py-3.5 t-label text-white transition hover:-translate-y-0.5"
              >
                Open the chat workspace <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="border-y border-[#DED6C8] bg-[#FFFCF6] px-4 py-14 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-center text-center">
            <span className="grid size-10 place-items-center border border-[#F1C4BD] bg-[#FDF1EF] text-[#C6493D]">
              <MapPinned className="size-5" />
            </span>
            <h2 className="mt-6 max-w-[22ch] text-balance t-section text-ink">
              Some questions should go to a person, not a chatbot.
            </h2>
            <p className="mt-5 max-w-[62ch] text-pretty t-body text-[#525C74]">
              ShefGuide helps you make sense of student life. For anything
              medical, immigration, legal, financial or mental-health related,
              it points you at someone qualified instead.
            </p>
          </div>
        </section>

        <section
          id="field-notes"
          className="px-4 py-20 sm:px-6 lg:px-10 lg:py-28"
        >
          <div className="mx-auto max-w-[1370px]">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-balance t-section text-ink">
                  Three places to begin.
                </h2>
              </div>
              <button
                onClick={() => navigate("/chat")}
                className="py-1.5 -my-1.5 inline-flex items-center gap-2 t-label text-brand transition hover:gap-3"
              >
                Ask a different question <ArrowRight className="size-4" />
              </button>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <article className="paper-note group relative flex min-h-[320px] flex-col border border-[#9DB7F2] bg-[#EEF2FF] p-8 transition hover:-translate-y-1">
                <h3 className="max-w-[18ch] text-balance t-subhead text-ink">
                  {notes[0][0]}
                </h3>
                <p className="mt-4 max-w-[46ch] text-pretty t-body text-ink-muted">
                  {notes[0][1]}
                </p>
                <button
                  onClick={() =>
                    navigate(`/chat?q=${encodeURIComponent(notes[0][0])}`)
                  }
                  className="py-1.5 -my-1.5 mt-auto inline-flex w-fit items-center gap-2 t-label text-brand transition group-hover:gap-3"
                >
                  Take this to chat <ArrowRight className="size-4" />
                </button>
              </article>
              <div className="grid gap-4">
                {notes.slice(1).map(([title, body]) => (
                  <article
                    key={title}
                    className="paper-note group relative flex flex-col border border-[#D7D1C2] bg-[#FFFCF6] p-6 transition hover:-translate-y-1"
                  >
                    <h3 className="max-w-[26ch] text-balance t-title text-[#172947]">
                      {title}
                    </h3>
                    <p className="mt-2.5 max-w-[42ch] text-pretty t-body-sm text-ink-soft">
                      {body}
                    </p>
                    <button
                      onClick={() =>
                        navigate(`/chat?q=${encodeURIComponent(title)}`)
                      }
                      className="py-1.5 -my-1.5 mt-auto pt-4 inline-flex w-fit items-center gap-2 t-label text-brand transition group-hover:gap-3"
                    >
                      Take this to chat <ArrowRight className="size-4" />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-10 sm:px-6 lg:px-10 lg:pb-14">
          <div className="relative mx-auto overflow-hidden border border-[#CCD9D3] bg-[#DDE8E2] px-7 py-12 sm:px-12 lg:max-w-[1370px] lg:px-16 lg:py-16">
            <div className="absolute -right-20 -top-24 size-[360px] rounded-full border-[28px] border-[#174CCF]/10" />
            <div className="relative grid gap-8 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
              <div>
                <h2 className="max-w-[18ch] text-balance t-section text-ink">
                  Start with the question you have today.
                </h2>
                <p className="mt-5 max-w-[56ch] text-pretty t-body text-ink-muted">
                  You do not need the right words to start. Begin as a guest,
                  and save your route when you want to come back to it.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <button
                  onClick={() => navigate("/chat")}
                  className="inline-flex items-center gap-2 bg-[#174CCF] px-5 py-3.5 t-label text-white transition hover:-translate-y-0.5"
                >
                  Ask ShefGuide <ArrowRight className="size-4" />
                </button>
                <button
                  onClick={() => navigate("/sign-up")}
                  className="inline-flex items-center gap-2 border border-[#B8CABE] bg-[#FFFCF6] px-5 py-3.5 t-label text-brand transition hover:-translate-y-0.5"
                >
                  Save your route <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="relative bg-[#0C1935] px-4 py-12 text-white sm:px-6 lg:px-10">
        <div className="paper-grid absolute inset-0 opacity-[.08]" />
        <div className="relative mx-auto grid max-w-[1370px] gap-10 lg:grid-cols-[1.35fr_.65fr_.65fr_.65fr]">
          <div>
            <Brand tone="light" />
            <p className="mt-5 max-w-[42ch] text-pretty t-body-sm t-on-dark text-white/75">
              Academic and practical support for international students in UK
              higher education.
            </p>
          </div>
          <div>
            <p className="t-kicker text-[#AFC5FF]">Explore</p>
            <div className="mt-4 flex flex-col gap-3 t-body-sm t-on-dark text-white/80">
              <a href="#how-it-works" className="hover:text-white">
                How it works
              </a>
              <a href="#features" className="hover:text-white">
                What’s inside
              </a>
              <a href="#field-notes" className="hover:text-white">
                Field notes
              </a>
            </div>
          </div>
          <div>
            <p className="t-kicker text-[#AFC5FF]">Workspace</p>
            <div className="mt-4 flex flex-col gap-3 t-body-sm t-on-dark text-white/80">
              <button
                onClick={() => navigate("/chat")}
                className="w-fit text-left hover:text-white"
              >
                Ask ShefGuide
              </button>
              <button
                onClick={() => navigate("/checklist")}
                className="w-fit text-left hover:text-white"
              >
                Your checklist
              </button>
              <button
                onClick={() => navigate("/community")}
                className="w-fit text-left hover:text-white"
              >
                Community Q&A
              </button>
            </div>
          </div>
          <div>
            <p className="t-kicker text-[#AFC5FF]">Support</p>
            <div className="mt-4 flex flex-col gap-3 t-body-sm t-on-dark text-white/80">
              <a href="/privacy" className="hover:text-white">
                Privacy
              </a>
              <a href="/terms" className="hover:text-white">
                Terms
              </a>
              <a href="/sign-in" className="hover:text-white">
                Sign in
              </a>
            </div>
          </div>
        </div>
        <div className="relative mx-auto mt-10 flex max-w-[1370px] flex-col gap-4 border-t border-white/10 pt-6 t-caption t-on-dark text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <span>ShefGuide · Built for international students in the UK.</span>
          <span>Academic support, not specialist advice.</span>
        </div>
      </footer>
    </div>
  );
}
