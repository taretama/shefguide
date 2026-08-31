/**
 * ShefGuide design reminder: the not-found route remains a helpful piece of wayfinding, with the same warm paper and confident navigation cues.
 */
import { Brand } from "@/components/Brand";
import { ArrowRight, MapPinned } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F6F3EC] p-5">
      <section className="w-full max-w-[720px] border border-[#DED6C8] bg-[#FFFCF6] p-8 text-center shadow-[0_24px_70px_rgba(35,50,72,.1)] sm:p-14">
        <div className="flex justify-center">
          <Brand />
        </div>
        <span className="mx-auto mt-12 grid size-16 place-items-center bg-[#EEF2FF] text-brand">
          <MapPinned className="size-7" />
        </span>
        <h1 className="mt-8 text-balance t-display text-ink">
          This page is off the map.
        </h1>
        <p className="mx-auto mt-5 max-w-[56ch] text-pretty t-body text-ink-muted">
          The link may have moved, or the page never existed. Either way, we can
          guide you back to somewhere useful.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#174CCF] px-5 py-3.5 t-label text-white transition hover:-translate-y-0.5 hover:bg-brand-deep active:scale-[.97]"
          >
            Return to ShefGuide <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 border border-[#DCD4C7] px-5 py-3.5 t-label text-ink transition hover:border-brand hover:text-brand active:scale-[.97]"
          >
            Ask a question instead
          </Link>
        </div>
      </section>
    </main>
  );
}
