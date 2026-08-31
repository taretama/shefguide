/**
 * ShefGuide API client.
 *
 * Ported from the original frontend's assets/app.js so the request/response
 * contract with the FastAPI backend stays identical: same token storage keys,
 * same guest-session recovery, same error shaping.
 */

// In a production build the app is served by FastAPI itself, so the API lives on
// the same origin and relative URLs are correct everywhere: localhost, a LAN IP,
// or a tunnel. The old build guessed `<host>:8000`, which broke behind a tunnel
// because the tunnel publishes 443, not 8000.
//
// The Vite dev server runs on its own port, so there we still point at the
// backend explicitly (CORS is already open).
export const API_BASE = (() => {
  if (!import.meta.env.DEV) return "";
  if (typeof window === "undefined") return "http://localhost:8000";
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "") {
    return "http://localhost:8000";
  }
  return `${window.location.protocol}//${host}:8000`;
})();

const TOKEN_KEY = "shefguide_token";
const DISCLOSURE_KEY = "shefguide_disclosure";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(DISCLOSURE_KEY);
}
export function isLoggedIn(): boolean {
  return !!getToken();
}

function decodeTokenPayload(): Record<string, unknown> | null {
  const token = getToken();
  if (!token) return null;
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part));
  } catch {
    return null;
  }
}

/** Only used as a local storage key, never for anything security-sensitive. */
export function getUserId(): string | null {
  const payload = decodeTokenPayload();
  return (payload?.sub as string) ?? null;
}

/**
 * Guest mode: a visitor can use the AI chat without registering. The backend
 * hands out a real (anonymous) session token, so every authenticated call works
 * as it does for a registered user — the difference is a small message
 * allowance and a few account-only features.
 */
export function isGuest(): boolean {
  return decodeTokenPayload()?.guest === true;
}

export function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getToken()}`,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/** FastAPI returns validation errors as an array of objects, not a string. */
function buildApiError(res: Response, data: any): ApiError {
  let message = `Request failed (${res.status})`;
  if (data) {
    if (typeof data.detail === "string") {
      message = data.detail;
    } else if (Array.isArray(data.detail)) {
      message = data.detail
        .map((d: any) => d?.msg ?? JSON.stringify(d))
        .join(", ");
    } else if (typeof data.detail === "object" && data.detail !== null) {
      message = data.detail.msg ?? JSON.stringify(data.detail);
    } else if (typeof data.message === "string") {
      message = data.message;
    }
  }
  return new ApiError(message, res.status, data);
}

type ApiOptions = RequestInit & { retried?: boolean };

export async function api<T = any>(
  path: string,
  opts: ApiOptions = {}
): Promise<T> {
  const { retried, ...init } = opts;
  const res = await fetch(API_BASE + path, init);

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }

  if (!res.ok) {
    if (res.status === 401 && isLoggedIn()) {
      // A guest token lasts 6 hours and carries no password to log back in
      // with, so bouncing to sign-in reads as "you need an account" to someone
      // who never had one. Start a fresh guest session and retry once instead.
      if (isGuest() && !retried) {
        try {
          const fresh = await fetch(`${API_BASE}/auth/guest`, {
            method: "POST",
          }).then(r => r.json());
          setToken(fresh.token);
          localStorage.removeItem(DISCLOSURE_KEY);
          const retryInit: RequestInit = { ...init };
          const headers = retryInit.headers as
            Record<string, string> | undefined;
          if (headers?.Authorization) {
            retryInit.headers = {
              ...headers,
              Authorization: `Bearer ${fresh.token}`,
            };
          }
          return api<T>(path, { ...retryInit, retried: true });
        } catch {
          /* falls through to the same clear + redirect as any other 401 */
        }
      }
      clearToken();
      window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw buildApiError(res, data);
  }

  return data as T;
}

/** Starts an anonymous session so a visitor can chat without registering. */
export async function startGuest(): Promise<{
  token: string;
  messages_allowed: number;
}> {
  const data = await api<{ token: string; messages_allowed: number }>(
    "/auth/guest",
    { method: "POST" }
  );
  setToken(data.token);
  localStorage.removeItem(DISCLOSURE_KEY);
  return data;
}

export function logout() {
  clearToken();
  window.location.href = "/";
}

// ── Cloud disclosure ────────────────────────────────────────────────────────
// The backend gates /chat and /posts/{id}/ai-answer behind require_disclosure(),
// so this has to be accepted before any AI call.

export function hasAcceptedDisclosure(): boolean {
  return localStorage.getItem(DISCLOSURE_KEY) === "accepted";
}

export async function acceptDisclosure(): Promise<void> {
  await api("/consent/cloud-disclosure", {
    method: "POST",
    headers: authHeaders(),
  });
  localStorage.setItem(DISCLOSURE_KEY, "accepted");
}

// ── Typed endpoint wrappers ─────────────────────────────────────────────────

export type ChatModel = "gpt" | "gemini";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  session_id: string;
  latency: number;
  model_used: string;
  sources: string[];
  pii_redacted: boolean;
  is_guest: boolean;
  messages_remaining: number | null;
}

export function sendChat(
  messages: ChatMessage[],
  model: ChatModel,
  sessionId?: string | null
) {
  const body: Record<string, unknown> = { messages, model };
  if (sessionId) body.session_id = sessionId;
  return api<ChatResponse>("/chat", {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
}

export interface Profile {
  email: string | null;
  university: string | null;
  home_country: string | null;
  programme: string | null;
  arrival_date?: string | null;
  is_guest?: boolean;
}

export function getProfile() {
  return api<Profile>("/me", { headers: authHeaders() });
}

export interface SessionSummary {
  _id: string;
  title: string;
  preview: string;
  model_used: string | null;
  latency_sec: number | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export function listSessions() {
  return api<{ sessions: SessionSummary[] }>("/sessions", {
    headers: authHeaders(),
  });
}

export function getSession(id: string) {
  return api<{
    _id: string;
    title?: string;
    messages: ChatMessage[];
    model_used?: string;
  }>(`/sessions/${id}`, { headers: authHeaders() });
}

export function deleteSession(id: string) {
  return api(`/sessions/${id}`, { method: "DELETE", headers: authHeaders() });
}

export interface ChecklistTask {
  id: string;
  title: string;
  description: string;
  priority: string;
  completed: boolean;
}

export interface ChecklistSection {
  title: string;
  icon?: string;
  tasks: ChecklistTask[];
}

export function getChecklist() {
  return api<{ sections: ChecklistSection[] }>("/api/checklist", {
    headers: authHeaders(),
  });
}

export function generateChecklist() {
  return api<{ sections: ChecklistSection[] }>("/checklist/generate", {
    method: "POST",
    headers: authHeaders(true),
  });
}

export function toggleChecklistTask(taskId: string) {
  return api<{ sections: ChecklistSection[] }>("/checklist/toggle", {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({ task_id: taskId }),
  });
}

export interface AiAnswer {
  text: string;
  model_used?: string;
  latency_sec?: number;
  generated_at?: string;
}

export interface Post {
  _id: string;
  question: string;
  category: string;
  ai_answer: AiAnswer | null;
  replies: { user_id: string; text: string; created_at: string }[];
  reply_count?: number;
  created_at: string;
}

export function listPosts(category?: string) {
  const q =
    category && category !== "all"
      ? `?category=${encodeURIComponent(category)}`
      : "";
  return api<{ posts: Post[] }>(`/posts${q}`);
}

export function createPost(question: string, category = "general") {
  return api<{
    post_id: string;
    question: string;
    ai_answer?: AiAnswer | null;
    message?: string;
  }>("/posts", {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({ question, category }),
  });
}

export function generatePostAiAnswer(postId: string, model: ChatModel = "gpt") {
  return api<{ ai_answer?: AiAnswer; answer?: string; cached?: boolean }>(
    `/posts/${postId}/ai-answer`,
    {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ model }),
    }
  );
}

export function replyToPost(postId: string, text: string) {
  return api(`/posts/${postId}/reply`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({ text }),
  });
}

export function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return api<{ filename?: string; chunks?: number; message?: string }>(
    "/document/upload",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }
  );
}

export function removeDocument() {
  return api("/document/remove", { method: "POST", headers: authHeaders() });
}

export function register(body: {
  email: string;
  password: string;
  university: string;
  home_country: string;
  programme: string;
  arrival_date?: string;
}) {
  // Sending the existing token lets the backend upgrade a guest account in
  // place, so their history and attached document carry over.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (isLoggedIn()) headers.Authorization = `Bearer ${getToken()}`;
  return api<{ token: string; upgraded_from_guest?: boolean }>(
    "/auth/register",
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }
  );
}

export function login(email: string, password: string) {
  return api<{ token: string }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

/** Relative time for history and community timestamps. */
export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
