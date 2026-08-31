/**
 * ShefGuide design reminder: history should read like an organised desk drawer of useful study notes, clear and reassuring instead of data-heavy.
 */
import { WorkspaceShell } from "@/components/WorkspaceSidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRequireAuth } from "@/hooks/useAuth";
import {
  deleteSession,
  listSessions,
  timeAgo,
  type SessionSummary,
} from "@/lib/api";
import {
  ArrowUpRight,
  MessageSquareText,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

/**
 * Session previews are the raw assistant reply, which is markdown. Rendering it
 * verbatim leaks "**bold**", headings and list syntax into the row, so flatten
 * it to a single readable line.
 */
function plainPreview(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, "$1")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Backend stores the full provider label; the list only needs the family. */
const MODEL_LABEL: Record<string, string> = {
  "GPT-4o-mini (OpenAI)": "GPT-4o-mini",
  "Gemini 3.5 Flash (Google)": "Gemini 3.5 Flash",
};

export default function History() {
  const authState = useRequireAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SessionSummary | null>(
    null
  );

  useEffect(() => {
    if (authState !== "ready") return;
    let cancelled = false;
    listSessions()
      .then(data => {
        if (!cancelled) setSessions(data.sessions ?? []);
      })
      .catch(error => {
        if (!cancelled)
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not load your history."
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authState]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    setPendingDelete(null);
    try {
      await deleteSession(id);
      setSessions(current => current.filter(item => item._id !== id));
      toast.success("Conversation deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete that conversation."
      );
    }
  };

  const visible = sessions.filter(item =>
    `${item.title} ${item.preview}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <WorkspaceShell title="Chat history" eyebrow="Your saved conversations">
      <main className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col gap-5 border border-[#E0D9CC] bg-[#FFFCF6] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="max-w-[590px]">
            <h2 className="text-balance t-display text-ink">
              A record of questions you have already begun to answer.
            </h2>
            <p className="mt-3 max-w-[62ch] text-pretty t-body text-ink-muted">
              Your conversations stay here so you can return to plans,
              explanations and next steps when the time is right.
            </p>
          </div>
          <Link
            href="/chat"
            className="inline-flex shrink-0 items-center justify-center gap-2 bg-[#174CCF] px-4 py-3 t-label text-white transition hover:bg-brand-deep"
          >
            <Sparkles className="size-4" /> Start a new chat
          </Link>
        </section>

        <div className="relative mt-6 max-w-md">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="w-full border border-[#DDD5C7] bg-[#FFFCF6] py-3 pl-10 pr-4 t-input outline-none placeholder:text-ink-soft focus:border-[#174CCF] focus:ring-4 focus:ring-[#174CCF]/10"
            placeholder="Search your chats"
            aria-label="Search your saved conversations"
          />
        </div>

        <section className="mt-4 overflow-hidden border border-[#E0D9CC] bg-[#FFFCF6]">
          {loading || authState !== "ready" ? (
            <div aria-busy="true" aria-label="Loading your conversations">
              {[0, 1, 2].map(row => (
                <div
                  key={row}
                  className="flex gap-4 border-b border-[#ECE6DC] p-5 last:border-0 sm:p-6"
                >
                  <span className="size-10 shrink-0 animate-pulse bg-[#EDE8DF]" />
                  <div className="min-w-0 flex-1">
                    <span className="block h-3.5 w-1/3 animate-pulse bg-[#EDE8DF]" />
                    <span className="mt-2.5 block h-3 w-3/4 animate-pulse bg-[#F1ECE4]" />
                    <span className="mt-3 block h-5 w-24 animate-pulse bg-[#F1ECE4]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {visible.map(session => (
                <div
                  key={session._id}
                  className="group flex gap-4 border-b border-[#ECE6DC] p-5 transition last:border-0 hover:bg-[#F7F4EE] sm:p-6"
                >
                  <Link
                    href={`/chat?session=${session._id}`}
                    className="flex min-w-0 flex-1 gap-4"
                  >
                    <span className="mt-0.5 grid size-10 shrink-0 place-items-center bg-[#EEF2FF] text-brand">
                      <MessageSquareText className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="t-title text-ink-title">
                          {session.title}
                        </h3>
                        <span className="t-caption t-num text-ink-soft">
                          {timeAgo(session.updated_at || session.created_at)}
                        </span>
                      </div>
                      {session.preview && (
                        <p className="mt-1.5 max-w-[68ch] text-pretty t-body-sm text-ink-muted">
                          {plainPreview(session.preview)}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="bg-[#F1EEE8] px-2.5 py-1 t-badge text-ink-muted">
                          {session.message_count} message
                          {session.message_count === 1 ? "" : "s"}
                        </span>
                        {session.model_used && (
                          <span className="bg-[#EEF2FF] px-2.5 py-1 t-badge text-brand">
                            {MODEL_LABEL[session.model_used] ??
                              session.model_used}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-start gap-1 pt-1.5">
                    <button
                      onClick={() => setPendingDelete(session)}
                      className="focus-ring grid size-11 place-items-center text-ink-soft transition hover:bg-[#FBEDEB] hover:text-signal sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
                      aria-label={`Delete ${session.title}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                    <ArrowUpRight className="mt-3.5 size-4 text-ink-soft transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
                  </div>
                </div>
              ))}
              {visible.length === 0 && (
                <div className="p-12 text-center">
                  <p className="t-title text-ink-title">
                    {sessions.length === 0
                      ? "Nothing saved here yet."
                      : "No conversations match that search."}
                  </p>
                  <p className="mx-auto mt-2 max-w-[48ch] text-pretty t-body-sm text-ink-muted">
                    {sessions.length === 0
                      ? "Every chat you start is kept here automatically, so you can pick a question back up later."
                      : "Try a shorter search, or clear it to see everything again."}
                  </p>
                  {sessions.length === 0 && (
                    <Link
                      href="/chat"
                      className="mt-4 inline-flex items-center gap-2 bg-[#174CCF] px-4 py-3 t-label text-white transition hover:bg-brand-deep"
                    >
                      <Sparkles className="size-4" /> Ask your first question
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={open => !open && setPendingDelete(null)}
      >
        <AlertDialogContent className="border-[#DED6C8] bg-[#FFFCF6]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-balance t-subhead text-ink">
              Delete this conversation?
            </AlertDialogTitle>
            <AlertDialogDescription className="max-w-[56ch] text-pretty t-body-sm text-ink-muted">
              The transcript will be removed permanently. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#DCD4C7] bg-white t-label text-ink-muted">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-signal t-label text-white hover:bg-[#8F2F25]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspaceShell>
  );
}
