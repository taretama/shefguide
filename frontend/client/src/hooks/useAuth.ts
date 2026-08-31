/**
 * Auth/route-guard hooks.
 *
 * Mirrors requireAuth() / requireAccount() from the original frontend:
 *   - requireAuth  → any signed-in state, including an anonymous guest
 *   - requireAccount → a full registered account only
 *
 * Chat and History are guest-friendly: a visitor with no token at all gets an
 * anonymous session started for them rather than being bounced to sign-in.
 * The checklist is not, since it is generated from profile details a guest has
 * never given.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { isGuest, isLoggedIn, startGuest } from "@/lib/api";

export type AuthState = "checking" | "ready" | "redirecting";

/**
 * Ensures some session exists. If the visitor has no token, an anonymous guest
 * session is started in place so guest-friendly pages work on first visit.
 */
export function useRequireAuth(): AuthState {
  const [state, setState] = useState<AuthState>(
    isLoggedIn() ? "ready" : "checking"
  );
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoggedIn()) {
      setState("ready");
      return;
    }
    let cancelled = false;
    startGuest()
      .then(() => {
        if (!cancelled) setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setState("redirecting");
        navigate("/sign-in");
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return state;
}

/**
 * For pages a guest cannot use at all. Sends them to registration with a
 * reason, rather than to a dead end.
 */
export function useRequireAccount(reason?: string): AuthState {
  const [state, setState] = useState<AuthState>("checking");
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isLoggedIn() || isGuest()) {
      setState("redirecting");
      const params = new URLSearchParams({ next: location });
      if (reason) params.set("why", reason);
      navigate(`/sign-up?${params.toString()}`);
      return;
    }
    setState("ready");
  }, [location, navigate, reason]);

  return state;
}

/** Re-renders when the token changes (sign in, sign out, guest upgrade). */
export function useAuthStatus() {
  const [status, setStatus] = useState(() => ({
    loggedIn: isLoggedIn(),
    guest: isGuest(),
  }));

  useEffect(() => {
    const sync = () => setStatus({ loggedIn: isLoggedIn(), guest: isGuest() });
    window.addEventListener("storage", sync);
    window.addEventListener("shefguide:auth", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("shefguide:auth", sync);
    };
  }, []);

  return status;
}

/** Fired after any token change so headers update without a reload. */
export function notifyAuthChanged() {
  window.dispatchEvent(new Event("shefguide:auth"));
}
