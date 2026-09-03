/**
 * ShefGuide design reminder: the workspace is a stable student field guide — cobalt navigation, paper-tone context, clear escape routes.
 *
 * The sidebar has three states rather than one:
 *   - desktop expanded: full labels, the default
 *   - desktop collapsed: an icon rail, so a chat or checklist can use the full
 *     width of the screen. The choice is remembered between visits.
 *   - mobile: an off-canvas drawer. Below `lg` the rail is hidden entirely, so
 *     without this the workspace had no navigation at all on a phone.
 */
import { Brand } from "@/components/Brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStatus } from "@/hooks/useAuth";
import { getProfile, isLoggedIn, logout, type Profile } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  BookOpenCheck,
  ChevronDown,
  Clock3,
  House,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Home", icon: House },
  { href: "/chat", label: "Ask ShefGuide", icon: Sparkles },
  { href: "/checklist", label: "Your checklist", icon: BookOpenCheck },
  { href: "/community", label: "Community Q&A", icon: UsersRound },
  { href: "/history", label: "Chat history", icon: Clock3 },
];

const COLLAPSE_KEY = "shefguide:sidebar-collapsed";

/**
 * Remembers whether the rail is collapsed. Storage can throw (private windows,
 * blocked site data), so every access is guarded and simply falls back to the
 * expanded default.
 */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* the preference just does not persist */
    }
  }, [collapsed]);

  return [collapsed, setCollapsed] as const;
}

/**
 * The collapse preference belongs to the desktop rail only. Inside the mobile
 * drawer the panel is always full width, so a remembered "collapsed" must not
 * shrink the wordmark or the account card there.
 */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) =>
      setIsDesktop(event.matches);
    query.addEventListener("change", onChange);
    setIsDesktop(query.matches);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

/**
 * Loads the signed-in student's profile. A guest has no profile row worth
 * showing, so it is skipped rather than rendering empty fields.
 */
function useProfile() {
  const { loggedIn, guest } = useAuthStatus();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!loggedIn || guest) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    getProfile()
      .then(data => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        /* header falls back to the generic label */
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn, guest]);

  return profile;
}

/** Initial shown in the topbar avatar. */
function initialFor(profile: Profile | null, guest: boolean) {
  if (guest || !profile?.email) return "G";
  return profile.email.charAt(0).toUpperCase();
}

function AccountCard({ collapsed }: { collapsed: boolean }) {
  const { guest } = useAuthStatus();
  const profile = useProfile();

  const name = guest ? "Guest workspace" : (profile?.email ?? "Your account");
  const detail = guest
    ? "Exploring without an account"
    : [profile?.programme, profile?.university].filter(Boolean).join(" · ") ||
      "Signed in";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "focus-ring w-full border border-[#E4DCCF] bg-[#F4F0E8] text-left transition hover:border-[#C9BFAD]",
          collapsed ? "grid h-11 place-items-center px-0" : "p-3"
        )}
        aria-label={collapsed ? `Account: ${name}` : undefined}
        title={collapsed ? name : undefined}
      >
        {collapsed ? (
          <span aria-hidden className="t-label text-ink">
            {initialFor(profile, guest)}
          </span>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate t-label text-ink">{name}</span>
              <ChevronDown className="size-4 shrink-0 text-ink-soft" />
            </div>
            <p className="mt-1 truncate t-caption text-ink-soft">{detail}</p>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-56 border-[#E0D9CC] bg-[#FFFCF6]"
      >
        <DropdownMenuLabel className="t-kicker text-ink-soft">
          {guest ? "Guest session" : "Signed in"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[#EAE3D7]" />
        {guest ? (
          <DropdownMenuItem asChild>
            <Link
              href="/sign-up"
              className="cursor-pointer gap-2 t-label text-brand"
            >
              <UserPlus className="size-4" /> Save your route
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={logout}
            className="cursor-pointer gap-2 t-label text-signal focus:text-signal"
          >
            <LogOut className="size-4" /> Log out
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceSidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapsed: () => void;
}) {
  const [location] = useLocation();
  const isDesktop = useIsDesktop();
  // Only the desktop rail collapses; the drawer always shows the full panel.
  const rail = collapsed && isDesktop;

  return (
    <aside
      id="workspace-nav"
      aria-label="Workspace"
      className={cn(
        // Off-canvas drawer up to `lg`, a static rail from `lg` up.
        "fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 flex-col overflow-y-auto border-r border-[#DFD7C8] bg-[#FFFCF6] px-4 py-5",
        "transition-[transform,width] duration-200 ease-out motion-reduce:transition-none",
        "lg:sticky lg:top-0 lg:z-auto lg:translate-x-0",
        mobileOpen
          ? "translate-x-0 shadow-[0_24px_60px_rgba(35,50,72,.28)]"
          : "-translate-x-full",
        collapsed ? "w-[264px] lg:w-[76px] lg:px-3" : "w-[264px]"
      )}
    >
      {/* Brand and the collapse control share the panel header. In the rail they
          stack, so the control keeps the same place rather than jumping. */}
      <div
        className={cn(
          "flex items-center gap-2",
          rail ? "lg:flex-col lg:gap-4" : "justify-between"
        )}
      >
        <div className={cn(rail ? "lg:px-0" : "px-2")}>
          <Brand compact={rail} />
        </div>
        <button
          onClick={onToggleCollapsed}
          className="focus-ring hidden size-9 shrink-0 place-items-center text-ink-soft transition hover:bg-[#F2EEE5] hover:text-ink lg:grid"
          aria-label={rail ? "Expand navigation" : "Collapse navigation"}
          title={rail ? "Expand navigation" : "Collapse navigation"}
          aria-controls="workspace-nav"
          aria-expanded={!rail}
        >
          {rail ? (
            <PanelLeftOpen className="size-[18px]" />
          ) : (
            <PanelLeftClose className="size-[18px]" />
          )}
        </button>
        <button
          onClick={onCloseMobile}
          className="focus-ring grid size-9 shrink-0 place-items-center text-ink-muted transition hover:bg-[#F2EEE5] hover:text-ink lg:hidden"
          aria-label="Close navigation"
        >
          <X className="size-[18px]" />
        </button>
      </div>

      <div
        className={cn(
          "mt-10 t-kicker text-ink-soft",
          collapsed ? "lg:sr-only" : "px-2"
        )}
      >
        Your guide
      </div>

      <nav className="mt-3 space-y-1.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const active =
            location === item.href ||
            (item.href === "/chat" && location.startsWith("/chat"));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              aria-current={active ? "page" : undefined}
              title={rail ? item.label : undefined}
              className={cn(
                "focus-ring flex items-center gap-3 px-3 py-3 t-label transition",
                collapsed && "lg:justify-center lg:px-0",
                active
                  ? "bg-[#EEF2FF] text-brand"
                  : "text-ink-muted hover:bg-[#F2EEE5] hover:text-ink"
              )}
            >
              <Icon
                className="size-[18px] shrink-0"
                strokeWidth={active ? 2.4 : 2}
              />
              <span className={cn(collapsed && "lg:sr-only")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <Link
          href="/privacy"
          onClick={onCloseMobile}
          title={rail ? "Privacy & support boundaries" : undefined}
          className={cn(
            "focus-ring flex items-center gap-2 px-3 py-2.5 t-label font-medium text-ink-muted hover:bg-[#F2EEE5]",
            collapsed && "lg:justify-center lg:px-0"
          )}
        >
          <ShieldCheck className="size-4 shrink-0" />
          <span className={cn(collapsed && "lg:sr-only")}>
            Privacy &amp; support boundaries
          </span>
        </Link>
        <AccountCard collapsed={rail} />
      </div>
    </aside>
  );
}

function WorkspaceTopbar({
  title,
  eyebrow,
  onOpenMobile,
}: {
  title: string;
  eyebrow?: string;
  onOpenMobile: () => void;
}) {
  const { guest } = useAuthStatus();
  const profile = useProfile();
  const initial = initialFor(profile, guest);

  return (
    <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-3 border-b border-[#E4DCCF] bg-[#FFFCF6]/92 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {/* Opens the drawer on small screens; the desktop collapse control lives in the panel. */}
        <button
          onClick={onOpenMobile}
          className="focus-ring grid size-11 shrink-0 place-items-center border border-[#E5DED2] bg-white text-ink-muted transition hover:border-brand hover:text-brand lg:hidden"
          aria-label="Open navigation"
          aria-controls="workspace-nav"
          aria-expanded={false}
        >
          <Menu className="size-[18px]" />
        </button>
        <div className="flex items-center gap-3 lg:hidden">
          <Brand compact />
          <span className="h-5 w-px bg-[#D6D0C3]" />
        </div>
        <div className="min-w-0">
          {eyebrow && (
            <p className="hidden items-center gap-2 t-kicker text-ink-soft sm:flex">
              <span className="size-1.5 rounded-full bg-[#E35D4F]" /> {eyebrow}
            </p>
          )}
          <h1 className="truncate text-balance t-subhead text-ink">{title}</h1>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="focus-ring grid size-11 shrink-0 place-items-center rounded-full bg-[#C0432F] t-label text-white shadow-[0_5px_12px_rgba(227,93,79,.25)]"
          aria-label="Open account"
        >
          {initial}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 border-[#E0D9CC] bg-[#FFFCF6]"
        >
          <DropdownMenuLabel className="truncate t-label text-ink">
            {guest ? "Guest session" : (profile?.email ?? "Your account")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[#EAE3D7]" />
          {guest || !isLoggedIn() ? (
            <>
              <DropdownMenuItem asChild>
                <Link
                  href="/sign-up"
                  className="cursor-pointer gap-2 t-label text-brand"
                >
                  <UserPlus className="size-4" /> Create an account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/sign-in"
                  className="cursor-pointer t-label text-ink-muted"
                >
                  Sign in
                </Link>
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer gap-2 t-label text-signal focus:text-signal"
            >
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export function WorkspaceShell({
  children,
  title,
  eyebrow,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
}) {
  const [collapsed, setCollapsed] = useCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Escape closes the drawer, and the page behind it should not scroll while
  // it is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-[#F6F3EC] lg:flex">
      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          tabIndex={-1}
          className="fixed inset-0 z-30 bg-[#12224A]/35 backdrop-blur-[2px] lg:hidden"
        />
      )}
      <WorkspaceSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapsed={() => setCollapsed(value => !value)}
      />
      <div className="relative min-w-0 flex-1">
        <WorkspaceTopbar
          title={title}
          eyebrow={eyebrow}
          onOpenMobile={() => setMobileOpen(true)}
        />
        {children}
      </div>
    </div>
  );
}
