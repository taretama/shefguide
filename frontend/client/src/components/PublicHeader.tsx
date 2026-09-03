/**
 * ShefGuide design reminder: the public shell sits directly on the page — no
 * card, no chrome. Navigation is marked by a cobalt rule that wipes in on hover,
 * which is the same orientation cue the rest of the guide uses.
 */
import { Brand } from "@/components/Brand";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuthStatus } from "@/hooks/useAuth";
import { Menu } from "lucide-react";
import { Link } from "wouter";

const sections = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "What’s inside" },
  { href: "#field-notes", label: "Field notes" },
];

const navLink =
  "focus-ring relative -my-1.5 py-1.5 transition-colors hover:text-brand " +
  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 " +
  "after:bg-brand after:transition-transform after:duration-200 after:ease-out " +
  "hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-reduce:after:transition-none";

export function PublicHeader() {
  const { loggedIn, guest } = useAuthStatus();
  // A guest counts as signed-out here: converting them is the point of the CTA.
  const hasAccount = loggedIn && !guest;

  return (
    <header className="relative z-30 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between py-2">
        <Brand />
        <nav className="hidden items-center gap-7 t-label font-medium text-ink-muted md:flex">
          {sections.map(section => (
            <a key={section.href} href={section.href} className={navLink}>
              {section.label}
            </a>
          ))}
          <Link href="/community" className={navLink}>
            Community
          </Link>
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          {hasAccount ? (
            <>
              <Link
                href="/history"
                className="px-4 py-2.5 t-label text-ink transition hover:bg-[#F1EDE5]"
              >
                Your chats
              </Link>
              <Link
                href="/chat"
                className="bg-brand px-5 py-2.5 t-label text-white shadow-[0_8px_18px_rgba(23,76,207,0.23)] transition hover:-translate-y-0.5 hover:bg-brand-deep active:scale-[0.97]"
              >
                Open workspace
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="px-4 py-2.5 t-label text-ink transition hover:bg-[#F1EDE5]"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="bg-brand px-5 py-2.5 t-label text-white shadow-[0_8px_18px_rgba(23,76,207,0.23)] transition hover:-translate-y-0.5 hover:bg-brand-deep active:scale-[0.97]"
              >
                Save your route
              </Link>
            </>
          )}
        </div>
        <Sheet>
          <SheetTrigger
            className="focus-ring grid size-11 place-items-center bg-[#F4F0E8] text-ink transition active:scale-[.95] sm:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[300px] border-l-[#DFD7C8] bg-[#FFFCF6] p-6"
          >
            <SheetHeader className="p-0 text-left">
              <SheetTitle className="t-subhead text-ink">Menu</SheetTitle>
              <SheetDescription className="t-body-sm text-ink-muted">
                Jump to a section, or open your workspace.
              </SheetDescription>
            </SheetHeader>
            <nav className="mt-8 flex flex-col divide-y divide-[#EAE3D7] border-y border-[#EAE3D7] t-title text-ink">
              {sections.map(section => (
                <SheetClose asChild key={section.href}>
                  <a
                    href={section.href}
                    className="py-4 transition hover:text-brand"
                  >
                    {section.label}
                  </a>
                </SheetClose>
              ))}
              <SheetClose asChild>
                <Link
                  href="/community"
                  className="py-4 transition hover:text-brand"
                >
                  Community
                </Link>
              </SheetClose>
            </nav>
            <div className="mt-8 flex flex-col gap-3">
              <SheetClose asChild>
                <Link
                  href={hasAccount ? "/chat" : "/sign-up"}
                  className="bg-brand px-5 py-3 text-center t-label text-white transition active:scale-[.97]"
                >
                  {hasAccount ? "Open workspace" : "Save your route"}
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href={hasAccount ? "/history" : "/sign-in"}
                  className="border border-[#DFD7C8] px-5 py-3 text-center t-label text-ink transition active:scale-[.97]"
                >
                  {hasAccount ? "Your chats" : "Sign in"}
                </Link>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
