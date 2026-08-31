/**
 * ShefGuide "how it works".
 *
 * The message holds the left, the three steps run down the right as ruled rows.
 * The numbers stay because this genuinely is an ordered sequence and the order
 * is the point; they are not decoration borrowed from other landing pages.
 *
 * Motion is deliberately restrained per DESIGN.md (one understated entrance,
 * 160-240ms, 8-12px rise). The stagger is motivated: the content is a sequence,
 * so it arrives as a sequence.
 */
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const steps = [
  {
    n: "01",
    title: "Ask it plainly",
    body: "Start with the question that feels obvious, confusing, or too small to take to a tutor.",
  },
  {
    n: "02",
    title: "Find your next marker",
    body: "Turn an answer into a useful step, whether it is academic, social, or about arrival.",
  },
  {
    n: "03",
    title: "Keep moving with context",
    body: "Bring course material, revisit a conversation, or let the community add lived perspective.",
  },
];

export function HowItWorks() {
  const reduce = useReducedMotion();

  return (
    <section id="how-it-works" className="px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
      <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
        <header className="lg:pt-2">
          <p className="t-kicker text-signal">How it works</p>
          <h2 className="mt-4 text-balance t-section text-ink">
            Three small steps. One clearer start.
          </h2>
          <p className="mt-5 max-w-[46ch] text-pretty t-body text-ink-muted">
            You do not need to know exactly what to ask. Start where you are,
            then let ShefGuide help you find the next useful move.
          </p>
          <Link
            href="/chat"
            className="py-1.5 -my-1.5 mt-7 inline-flex items-center gap-2 t-label text-brand transition hover:gap-3"
          >
            Ask your first question <ArrowRight className="size-4" />
          </Link>
        </header>

        <ol className="border-y border-[#DCD4C7]">
          {steps.map((step, index) => (
            <motion.li
              key={step.n}
              className="border-t border-[#DCD4C7] first:border-t-0"
              // Opacity is deliberately untouched: the steps are readable before
              // the observer fires, so a renderer that never scrolls (crawler,
              // print, background tab, full-page capture) still gets all three.
              // The reveal only closes a 12px rise.
              initial={reduce ? false : { y: 12 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: 0.24,
                delay: index * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <Link
                href="/chat"
                className="group grid grid-cols-[auto_1fr_auto] items-start gap-5 py-6 transition sm:gap-7"
              >
                <span className="t-subhead t-num text-brand">{step.n}</span>
                <span className="min-w-0">
                  <span className="block t-title text-ink-title">
                    {step.title}
                  </span>
                  <span className="mt-1.5 block max-w-[62ch] text-pretty t-body-sm text-ink-muted">
                    {step.body}
                  </span>
                </span>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-brand" />
              </Link>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
