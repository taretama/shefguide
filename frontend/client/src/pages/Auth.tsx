/**
 * ShefGuide design reminder: authentication should read like a welcoming point of arrival, with calm, editorial hierarchy and clear guest access.
 */
import { Brand } from "@/components/Brand";
import { notifyAuthChanged } from "@/hooks/useAuth";
import {
  getChecklist,
  login,
  register,
  setToken,
  startGuest,
} from "@/lib/api";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Link, useLocation, useSearch } from "wouter";

const fieldClass =
  "w-full border border-[#DCD4C7] bg-white px-4 py-3.5 t-input outline-none transition placeholder:text-ink-soft focus:border-[#174CCF] focus:ring-4 focus:ring-[#174CCF]/10";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block t-label text-[#3F4A61]">{label}</span>
      {children}
    </label>
  );
}

function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const isSignup = mode === "signup";

  const params = new URLSearchParams(search);
  // Set when a guest is bounced off an account-only page, so we can explain why.
  const why = params.get("why");
  // Present when the student was bounced off a page they asked for. That
  // intent outranks anything we would pick for them, so it is kept as-is.
  const next = params.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [university, setUniversity] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [programme, setProgramme] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [busy, setBusy] = useState<"form" | "guest" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // A toast disappears; a rejected sign-in needs to stay next to the form it
  // belongs to, so the reason is still on screen when the student retries.
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Where a signed-in student should land.
   *
   * The checklist is the part of ShefGuide that says what to do; chat is the
   * part that waits to be asked. Sending an arriving student to an empty chat
   * box asks them to already know their own question, so they go to the
   * checklist until it is finished and to chat once it is.
   *
   * An empty response means the account has no checklist yet — a student who
   * has just registered — and that is the case that most needs the checklist,
   * which the page generates on arrival. Any failure falls through to chat:
   * a routing preference must never be able to block a successful sign-in.
   */
  const landingRoute = async () => {
    try {
      const { sections } = await getChecklist();
      const tasks = (sections ?? []).flatMap((section) => section.tasks ?? []);
      return tasks.every((task) => task.completed) && tasks.length > 0
        ? "/chat"
        : "/checklist";
    } catch {
      return "/chat";
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFormError(null);
    setBusy("form");
    try {
      if (isSignup) {
        // Registering while holding a guest token upgrades that account in
        // place, so the visitor's existing chats carry over.
        const data = await register({
          email: email.trim(),
          password,
          university: university.trim(),
          home_country: homeCountry.trim(),
          programme: programme.trim(),
          arrival_date: arrivalDate || undefined,
        });
        setToken(data.token);
        notifyAuthChanged();
        toast.success(
          data.upgraded_from_guest
            ? "Account created. Your guest conversations were kept."
            : "Account created. Welcome to ShefGuide."
        );
      } else {
        const data = await login(email.trim(), password);
        setToken(data.token);
        notifyAuthChanged();
        toast.success("Signed in.");
      }
      navigate(next ?? (await landingRoute()));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const continueAsGuest = async () => {
    if (busy) return;
    setBusy("guest");
    try {
      await startGuest();
      notifyAuthChanged();
      // Guests have no checklist to route to — it needs the profile that only
      // registration collects — so they always start in chat.
      navigate("/chat");
    } catch {
      toast.error("Could not start a guest session.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#F6F3EC] p-4 sm:p-6">
      <div className="grid min-h-[calc(100vh-2rem)] overflow-hidden border border-[#DED6C8] bg-[#FFFCF6] shadow-[0_30px_80px_rgba(30,42,66,.12)] lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-[#12224A] p-10 text-white lg:flex lg:flex-col xl:p-14">
          {/* Opacity is measured, not chosen by eye: at 0.45 over this navy the
              brightest pixel in the photograph still clears 4.5:1 against the
              lightest text on the panel (white/70). Raising either value breaks it. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[url('/images/campus-dusk.jpg')] bg-cover bg-center opacity-45"
          />
          <div className="absolute inset-0 opacity-20 paper-noise" />
          <Link
            href="/"
            className="relative z-10 inline-flex items-center gap-2 t-label text-white/85 hover:text-white"
          >
            <ChevronLeft className="size-4" /> Back to home
          </Link>
          <div className="relative z-10 my-auto max-w-[510px]">
            <h1 className="mt-2 text-balance t-display">
              One place to find your footing.
            </h1>
            <p className="mt-6 max-w-[52ch] text-pretty t-lead t-on-dark text-white/85">
              Get clear on academic expectations and the practical steps around
              starting life at a UK university.
            </p>
            <div className="mt-10 space-y-4 border-l border-white/15 pl-5">
              {[
                "Plain-language guidance, grounded in trusted sources",
                "A checklist built around your arrival date",
                "A route to a real person when you need one",
              ].map(line => (
                <div
                  className="flex items-center gap-3 t-body-sm t-on-dark text-white/85"
                  key={line}
                >
                  <span className="grid size-6 place-items-center rounded-full bg-[#FADFDA] text-[#C24036]">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {line}
                </div>
              ))}
            </div>
          </div>
          <p className="relative z-10 max-w-[62ch] text-pretty t-caption t-on-dark text-white/75">
            ShefGuide is an academic and practical support tool. It does not
            give medical, immigration, legal, financial or mental-health advice.
          </p>
        </section>
        <section className="flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16">
          <div className="flex items-center justify-between lg:hidden">
            <Brand />
            <Link href="/" className="t-label text-brand">
              Home
            </Link>
          </div>
          <div className="mx-auto w-full max-w-[410px] py-10 lg:py-0">
            <p className="t-kicker text-signal">
              {isSignup ? "Start your guide" : "Welcome back"}
            </p>
            <h2 className="mt-3 text-balance t-section text-ink">
              {isSignup
                ? "A few details and you are set."
                : "Pick up where you left off."}
            </h2>
            <p className="mt-3 max-w-[52ch] text-pretty t-body-sm text-ink-muted">
              {isSignup
                ? "Create an account to keep your chats, checklist and questions in one place."
                : "Sign in to revisit your support plan and previous conversations."}
            </p>

            {why && (
              <p className="mt-5 border border-[#F0D7D1] bg-[#FFF7F4] px-4 py-3 text-pretty t-body-sm text-[#8F352D]">
                You need an account to {why}.
              </p>
            )}

            <form onSubmit={submit} className="mt-8 space-y-4">
              <Field label="Email address">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className={fieldClass}
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Password">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={isSignup ? 8 : undefined}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    className={`${fieldClass} pr-12`}
                    placeholder={
                      isSignup ? "At least 8 characters" : "••••••••"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(current => !current)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    className="focus-ring absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-ink-muted transition hover:bg-[#F1EDE5] hover:text-ink"
                  >
                    {showPassword ? (
                      <EyeOff className="size-[18px]" />
                    ) : (
                      <Eye className="size-[18px]" />
                    )}
                  </button>
                </div>
              </Field>

              {isSignup && (
                // The checklist is generated from these, so they are required
                // rather than optional profile decoration.
                <div className="space-y-4 border border-[#E4DCCF] bg-[#FBF8F2] p-4">
                  <p className="t-kicker text-ink-soft">
                    Used to build your checklist
                  </p>
                  <Field label="University">
                    <input
                      required
                      value={university}
                      onChange={event => setUniversity(event.target.value)}
                      className={fieldClass}
                      placeholder="e.g. University of Sheffield"
                    />
                  </Field>
                  <Field label="Home country">
                    <input
                      required
                      value={homeCountry}
                      onChange={event => setHomeCountry(event.target.value)}
                      className={fieldClass}
                      placeholder="e.g. Nigeria"
                    />
                  </Field>
                  <Field label="Programme of study">
                    <input
                      required
                      value={programme}
                      onChange={event => setProgramme(event.target.value)}
                      className={fieldClass}
                      placeholder="e.g. MSc Computer Science"
                    />
                  </Field>
                  <Field label="Expected arrival date">
                    <input
                      type="date"
                      value={arrivalDate}
                      onChange={event => setArrivalDate(event.target.value)}
                      className={fieldClass}
                    />
                  </Field>
                </div>
              )}

              {formError && (
                <p
                  role="alert"
                  className="border border-[#F0D7D1] bg-[#FFF7F4] px-4 py-3 text-pretty t-body-sm text-[#8F352D]"
                >
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={busy !== null}
                className="mt-2 flex w-full items-center justify-center gap-2 bg-[#174CCF] px-5 py-3.5 t-label text-white shadow-[0_10px_20px_rgba(23,76,207,.22)] transition hover:-translate-y-0.5 hover:bg-brand-deep active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {busy === "form" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />{" "}
                    {isSignup ? "Creating your account…" : "Signing in…"}
                  </>
                ) : (
                  <>
                    {isSignup ? "Create my account" : "Sign in to ShefGuide"}
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 t-caption text-ink-soft">
              <span className="h-px flex-1 bg-[#E3DCCE]" />
              or
              <span className="h-px flex-1 bg-[#E3DCCE]" />
            </div>
            <button
              onClick={continueAsGuest}
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-2 border border-[#174CCF]/25 bg-[#EEF2FF] px-5 py-3.5 t-label text-brand transition hover:bg-[#E4EBFF] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "guest" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Starting…
                </>
              ) : (
                "Try the guest workspace"
              )}
            </button>
            <p className="mt-7 text-center t-body-sm text-ink-muted">
              {isSignup ? "Already have an account?" : "New to ShefGuide?"}{" "}
              <Link
                href={isSignup ? "/sign-in" : "/sign-up"}
                className="font-semibold text-brand hover:underline"
              >
                {isSignup ? "Sign in" : "Create one"}
              </Link>
            </p>
          </div>
          <p className="text-center t-caption text-ink-soft">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy notice
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

export function SignIn() {
  return <AuthPage mode="signin" />;
}
export function SignUp() {
  return <AuthPage mode="signup" />;
}
