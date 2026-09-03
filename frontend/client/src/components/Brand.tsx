/**
 * ShefGuide design reminder: contemporary editorial wayfinding — warm paper, atlas cobalt, and tactile guide cues.
 */
import { Link } from "wouter";

export function Brand({
  compact = false,
  tone = "ink",
}: {
  compact?: boolean;
  tone?: "ink" | "light";
}) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-3 group"
      aria-label="ShefGuide home"
    >
      <span className="relative grid size-10 place-items-center transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105">
        <svg
          viewBox="0 0 48 48"
          className="relative z-10 size-8"
          aria-hidden="true"
        >
          <path
            d="M6 11.5 18 7l12 4.5L42 7v27.5L30 39l-12-4.5L6 39V11.5Z"
            fill="#174CCF"
          />
          <path
            d="M18 7v27.5M30 11.5V39"
            fill="none"
            stroke={tone === "light" ? "#0C1935" : "#EEF2FF"}
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path
            d="m6 11.5 12 4.5 12-4.5L42 7"
            fill="none"
            stroke={tone === "light" ? "#FFFFFF" : "#12224A"}
            strokeWidth="1.45"
            strokeLinejoin="round"
            opacity=".82"
          />
          <circle
            cx="24"
            cy="21"
            r="5.3"
            fill="#E35D4F"
            stroke={tone === "light" ? "#0C1935" : "#FFFCF6"}
            strokeWidth="2"
          />
        </svg>
      </span>
      {!compact && (
        <span
          className={`font-display text-[1.45rem] tracking-[-0.03em] ${tone === "light" ? "text-[#FFFCF6]" : "text-ink"}`}
        >
          ShefGuide
        </span>
      )}
    </Link>
  );
}
