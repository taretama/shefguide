/**
 * ShefGuide design reminder: policy pages use the same calm guidebook hierarchy, presenting boundaries in plain, human language.
 */
import { Brand } from "@/components/Brand";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const privacySections = [
  [
    "The information we use",
    "ShefGuide is designed to keep only the information needed to provide your workspace, including account details, chat history and checklist choices. We do not ask you to share sensitive personal details in chat.",
  ],
  [
    "How chat guidance works",
    "ShefGuide’s responses use a curated knowledge base alongside the chosen AI model. It is not a replacement for university staff or specialist services. We make support boundaries clear when a concern falls outside academic and practical student guidance.",
  ],
  [
    "Your choices",
    "You can review your conversations, use guest access to try the service, and contact support if you need help with your account. Policies should be read alongside your university’s own data and support information.",
  ],
];
const termsSections = [
  [
    "Using ShefGuide",
    "Use ShefGuide to explore academic expectations, practical settling-in steps and student-life questions. Keep any account information private and use the community space respectfully.",
  ],
  [
    "Where we draw the line",
    "ShefGuide cannot provide medical, immigration, legal, financial or mental-health advice. When a question needs specialist support, we will encourage you to contact the appropriate person or service.",
  ],
  [
    "Community participation",
    "Posts should be useful, respectful and free of identifying sensitive information. Community answers are peer experience, not professional advice.",
  ],
];
export default function Policy({
  type = "privacy",
}: {
  type?: "privacy" | "terms";
}) {
  const sections = type === "privacy" ? privacySections : termsSections;
  const title =
    type === "privacy"
      ? "Privacy, written plainly."
      : "Terms for a supportive space.";

  return (
    <main className="min-h-screen bg-[#F6F3EC] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[1040px]">
        <header className="flex items-center justify-between">
          <Brand />
          <Link
            href="/"
            className="py-1.5 -my-1.5 inline-flex items-center gap-1.5 t-label text-brand hover:underline"
          >
            <ChevronLeft className="size-4" /> Back to home
          </Link>
        </header>

        <article className="mt-12 border border-[#E0D8CB] bg-[#FFFCF6] px-6 py-10 shadow-[0_20px_55px_rgba(35,50,72,.07)] sm:px-12 sm:py-14">
          <span className="inline-flex items-center gap-2 t-kicker text-signal">
            <ShieldCheck className="size-4" />{" "}
            {type === "privacy" ? "Privacy notice" : "Terms of use"}
          </span>
          <h1 className="mt-4 max-w-[18ch] text-balance t-display text-ink">
            {title}
          </h1>
          <p className="mt-6 max-w-[68ch] text-pretty t-body text-ink-muted">
            This is a clear frontend policy summary for the ShefGuide product
            concept. A production service should publish final, jurisdictionally
            appropriate policies before collecting personal data.
          </p>

          {/* These are topics, not steps, so they carry no sequence numbers. */}
          <div className="mt-12 divide-y divide-[#EAE3D7] border-t border-[#EAE3D7]">
            {sections.map(([heading, body]) => (
              <section
                className="grid gap-3 py-8 sm:grid-cols-[190px_1fr] sm:gap-8"
                key={heading}
              >
                <h2 className="text-balance t-subhead text-ink">{heading}</h2>
                <p className="max-w-[68ch] text-pretty t-body text-ink-muted">
                  {body}
                </p>
              </section>
            ))}
          </div>
        </article>

        <footer className="flex flex-wrap justify-center gap-x-5 gap-y-2 py-8 t-label text-ink-muted">
          <Link href="/privacy" className="py-1.5 -my-1.5 hover:text-brand">
            Privacy
          </Link>
          <Link href="/terms" className="py-1.5 -my-1.5 hover:text-brand">
            Terms
          </Link>
          <Link href="/sign-in" className="py-1.5 -my-1.5 hover:text-brand">
            Sign in
          </Link>
        </footer>
      </div>
    </main>
  );
}
