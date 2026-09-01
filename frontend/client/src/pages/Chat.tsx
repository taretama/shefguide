/**
 * ShefGuide design reminder: chat is an uncluttered reading canvas, paired with a tactile utility panel and safety boundaries that stay visible.
 */
import { useDisclosure } from "@/components/DisclosureGate";
import { WorkspaceShell } from "@/components/WorkspaceSidebar";
import { useAuthStatus, useRequireAuth } from "@/hooks/useAuth";
import {
  ApiError,
  createPost,
  getSession,
  removeDocument,
  sendChat,
  uploadDocument,
  type ChatMessage,
  type ChatModel,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Check,
  FileText,
  Loader2,
  Paperclip,
  Send,
  ShieldAlert,
  Sparkles,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";

const suggestions = [
  "What does ‘critically evaluate’ mean?",
  "How are seminars different from lectures?",
  "How does UK marking work?",
  "Help me plan my first week",
];

const MODELS: { id: ChatModel; label: string; blurb: string }[] = [
  { id: "gpt", label: "GPT-4o-mini", blurb: "Clear & quick" },
  { id: "gemini", label: "Gemini 3.5 Flash", blurb: "More thorough" },
];

export default function Chat() {
  const authState = useRequireAuth();
  const { guest } = useAuthStatus();
  const { ensureDisclosure, disclosureDialog } = useDisclosure();
  const search = useSearch();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<ChatModel>("gpt");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attachedName, setAttachedName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sharedIndexes, setSharedIndexes] = useState<Set<number>>(
    () => new Set()
  );
  const [remaining, setRemaining] = useState<number | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  // A failed request must not enter `messages`: that array is replayed to the
  // model as conversation history, so a stored error would be sent back as if
  // ShefGuide had actually said it. Kept alongside instead.
  const [failure, setFailure] = useState<{
    question: string;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const seededRef = useRef(false);

  // ?q= from the landing page hero, ?session= from history.
  const params = new URLSearchParams(search);
  const initialQuestion = params.get("q");
  const resumeSessionId = params.get("session");

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  // A long question should stay readable while it is being written, rather than
  // scrolling inside a one-line box. Reset first so the field also shrinks back.
  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 168)}px`;
  }, [input]);

  // Resuming a saved conversation from the history page.
  useEffect(() => {
    if (!resumeSessionId || authState !== "ready" || seededRef.current) return;
    seededRef.current = true;
    getSession(resumeSessionId)
      .then(data => {
        setMessages(data.messages ?? []);
        setSessionId(resumeSessionId);
      })
      .catch(() => toast.error("Could not open that conversation."));
  }, [resumeSessionId, authState]);

  // A question typed into the landing hero is sent as soon as the session is up.
  useEffect(() => {
    if (!initialQuestion || authState !== "ready" || seededRef.current) return;
    seededRef.current = true;
    void send(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, authState]);

  const send = async (question = input) => {
    const cleaned = question.trim();
    if (!cleaned || sending) return;

    try {
      await ensureDisclosure();
    } catch {
      return; // student declined the cloud notice
    }

    const history: ChatMessage[] = [
      ...messages,
      { role: "user", content: cleaned },
    ];
    setMessages(history);
    setInput("");
    setFailure(null);
    setSending(true);

    try {
      const result = await sendChat(history, model, sessionId);
      setMessages([...history, { role: "assistant", content: result.reply }]);
      setSessionId(result.session_id);
      setSources(result.sources ?? []);
      if (result.messages_remaining !== null)
        setRemaining(result.messages_remaining);
      if (result.pii_redacted) {
        toast.info(
          "Some personal details were removed from your message before sending."
        );
      }
    } catch (error) {
      // The question stays in the transcript so it is not lost; the failure is
      // held separately so it can be retried rather than retyped.
      // A network-level failure surfaces as "Failed to fetch", which means
      // nothing to a student. Only the backend's own messages are worth showing.
      const message =
        error instanceof ApiError
          ? error.message
          : "Could not reach ShefGuide. Check your connection and try again.";
      setFailure({ question: cleaned, message });
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const retry = () => {
    if (!failure) return;
    const { question } = failure;
    setFailure(null);
    setMessages(current => current.slice(0, -1));
    void send(question);
  };

  const shareToCommunity = async (index: number) => {
    const question = messages[index - 1]?.content;
    if (!question) return;
    try {
      await createPost(question, "academic");
      setSharedIndexes(current => new Set(current).add(index));
      toast.success("Shared to the Community board.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not share this question."
      );
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(file);
      setAttachedName(file.name);
      toast.success("Document added. Answers can now draw on it.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not read that document."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const detachDocument = async () => {
    try {
      await removeDocument();
      setAttachedName(null);
      toast.info("Document removed.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not remove the document."
      );
    }
  };

  if (authState !== "ready") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F6F3EC]">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <WorkspaceShell title="Ask ShefGuide" eyebrow="Questions about your course">
      {disclosureDialog}
      <main className="mx-auto grid max-w-[1530px] gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:p-8">
        <section className="flex min-h-[calc(100vh-140px)] flex-col overflow-hidden border border-[#E0D9CC] bg-[#FFFCF6] shadow-[0_12px_34px_rgba(35,50,72,.06)]">
          <div className="flex items-center justify-between border-b border-[#EAE3D7] px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="size-9 shrink-0 overflow-hidden rounded-full border border-[#DCE4FA] bg-[#EEF2FF] shadow-sm">
                <img
                  src="/images/chatbot-avatar.png"
                  alt="ShefGuide Bot"
                  className="size-full object-cover"
                />
              </div>
              <div>
                <p className="t-title text-ink">
                  {sessionId ? "Saved conversation" : "New conversation"}
                </p>
                <p className="mt-0.5 t-caption text-[#646E82]">
                  Grounded academic guidance
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setMessages([]);
                setSessionId(null);
                setSources([]);
              }}
              className="px-3 py-2 t-label text-[#536078] hover:bg-[#F3EFE7]"
            >
              Clear chat
            </button>
          </div>

          {guest && remaining !== null && (
            <div className="flex items-center justify-between gap-4 border-b border-[#F0E2C9] bg-[#FDF6E7] px-5 py-2.5 t-caption sm:px-7">
              <span className="font-semibold text-[#8A6516]">
                Guest session · {remaining} free{" "}
                {remaining === 1 ? "question" : "questions"} remaining
              </span>
              <Link
                href="/sign-up"
                className="font-bold text-brand hover:underline"
              >
                Save your route →
              </Link>
            </div>
          )}

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-9"
          >
            {messages.length === 0 ? (
              <div className="mx-auto flex max-w-[720px] flex-col items-start py-4 sm:py-12">
                <div className="size-16 shrink-0 overflow-hidden rounded-2xl border border-[#DCE4FA] bg-[#EEF2FF] p-1.5 shadow-[0_10px_24px_rgba(23,76,207,.18)]">
                  <img
                    src="/images/chatbot-avatar.png"
                    alt="ShefGuide Bot"
                    className="size-full object-contain"
                  />
                </div>
                <p className="mt-7 t-kicker text-[#C0432F]">
                  Start where you are
                </p>
                <h2 className="mt-2 text-balance t-display text-ink">
                  Ask the question you were not sure how to phrase.
                </h2>
                <p className="mt-5 max-w-[64ch] text-pretty t-body text-ink-muted">
                  ShefGuide explains UK university life in plain language, using
                  its curated knowledge base. Choose a prompt or write your own.
                </p>
                <div className="mt-8 flex flex-wrap gap-2.5">
                  {suggestions.map(item => (
                    <button
                      onClick={() => send(item)}
                      className="border border-[#DCD4C7] bg-white px-4 py-2.5 text-left t-label font-medium text-[#42506A] transition hover:-translate-y-0.5 hover:border-[#174CCF] hover:text-brand"
                      key={item}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="mx-auto max-w-[760px] space-y-7"
                aria-live="polite"
                aria-busy={sending}
              >
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn(
                      "flex items-end gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="size-9 shrink-0 overflow-hidden rounded-full border border-[#DCE4FA] bg-[#EEF2FF] shadow-sm">
                        <img
                          src="/images/chatbot-avatar.png"
                          alt="ShefGuide Bot"
                          className="size-full object-cover"
                        />
                      </div>
                    )}
                    <div
                      className={cn(
                        "relative max-w-[84%] px-5 py-4 sm:max-w-[68ch]",
                        message.role === "user"
                          ? "chat-bubble-user t-message-invert bg-[#174CCF] text-white"
                          : "chat-bubble-assistant t-message border border-[#E4DCD0] bg-white text-[#243453]"
                      )}
                    >
                      <p className="whitespace-pre-wrap text-pretty">
                        {message.content}
                      </p>
                      {message.role === "assistant" && (
                        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#EDE7DC] pt-3">
                          <button
                            onClick={() => shareToCommunity(index)}
                            disabled={sharedIndexes.has(index)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 t-label transition",
                              sharedIndexes.has(index)
                                ? "bg-[#EEF6EF] text-[#467A4A]"
                                : "text-brand hover:bg-[#EEF2FF] active:scale-[.98]"
                            )}
                          >
                            <UsersRound className="size-3.5" />
                            {sharedIndexes.has(index) ? (
                              <>
                                <Check className="size-3.5" /> Shared to
                                Community
                              </>
                            ) : (
                              "Share to Community"
                            )}
                          </button>
                          <span className="t-caption text-[#5F6A80]">
                            Post this helpful answer for other students.
                          </span>
                        </div>
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#174CCF] text-xs font-bold text-white shadow-sm">
                        You
                      </div>
                    )}
                  </div>
                ))}
                {failure && (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center gap-3 border border-[#F0D7D1] bg-[#FFF7F4] px-4 py-3.5 sm:px-5"
                  >
                    <ShieldAlert className="size-4 shrink-0 text-[#C6493D]" />
                    <p className="min-w-0 flex-1 max-w-[68ch] text-pretty t-body-sm text-[#8F352D]">
                      {failure.message}
                    </p>
                    <button
                      onClick={retry}
                      className="border border-[#DCC0BA] bg-white px-3 py-2 t-label text-[#8F352D] transition hover:bg-[#FBEFEC] active:scale-[.98]"
                    >
                      Try again
                    </button>
                  </div>
                )}
                {sending && (
                  <div className="flex items-end justify-start gap-3">
                    <div className="size-9 shrink-0 overflow-hidden rounded-full border border-[#DCE4FA] bg-[#EEF2FF] shadow-sm">
                      <img
                        src="/images/chatbot-avatar.png"
                        alt="ShefGuide Bot"
                        className="size-full object-cover animate-pulse"
                      />
                    </div>
                    <div className="chat-bubble-thinking flex items-center gap-3 border border-[#E4DCD0] bg-white px-5 py-3.5 text-[#646E82]">
                      <div className="flex items-center gap-1.5 py-0.5">
                        <span className="loading-dot-1 size-2.5 rounded-full bg-brand" />
                        <span className="loading-dot-2 size-2.5 rounded-full bg-brand" />
                        <span className="loading-dot-3 size-2.5 rounded-full bg-brand" />
                      </div>
                      <span className="t-body-sm font-medium text-[#536078]">
                        ShefGuide is thinking…
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[#EAE3D7] bg-[#FFFDF9] p-3 sm:p-5">
            <div className="mx-auto max-w-[860px]">
              <div className="flex items-end gap-2 border border-[#D7D0C3] bg-white p-2 shadow-[0_5px_18px_rgba(20,37,65,.05)] focus-within:border-[#174CCF] focus-within:ring-4 focus-within:ring-[#174CCF]/10">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={event => handleFile(event.target.files?.[0])}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={cn(
                    "focus-ring grid size-11 shrink-0 place-items-center transition",
                    attachedName
                      ? "bg-[#E7F2E7] text-[#467A4A]"
                      : "text-[#677187] hover:bg-[#F4F0E8]"
                  )}
                  aria-label="Attach document"
                >
                  {uploading ? (
                    <Loader2 className="size-[19px] animate-spin" />
                  ) : (
                    <Paperclip className="size-[19px]" />
                  )}
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  className="min-h-10 max-h-[168px] flex-1 resize-none bg-transparent px-1 py-2.5 t-input outline-none placeholder:text-ink-soft"
                  placeholder="Ask about your course, an assignment or your first week…"
                  rows={1}
                />
                <button
                  onClick={() => send()}
                  disabled={sending || !input.trim()}
                  className="focus-ring grid size-11 shrink-0 place-items-center bg-brand text-white transition hover:bg-brand-deep active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="size-[17px] animate-spin" />
                  ) : (
                    <Send className="size-[17px]" />
                  )}
                </button>
              </div>
              <p className="mt-2 max-w-[74ch] px-2 text-pretty t-caption text-[#5F6A80]">
                ShefGuide can help with academic and settling-in questions. It
                will direct you to human support for medical, immigration,
                legal, financial and mental-health concerns.
              </p>
            </div>
          </div>
        </section>

        <aside className="space-y-5 xl:pt-0">
          <section className="paper-note border border-[#D8D0C1] bg-[#FFFCF6] p-5 shadow-[0_7px_18px_rgba(35,50,72,.05)]">
            <div className="flex items-center gap-2 t-kicker text-[#C0432F]">
              <Sparkles className="size-3.5" /> Choose your guide
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {MODELS.map(item => (
                <button
                  onClick={() => setModel(item.id)}
                  key={item.id}
                  className={cn(
                    "border px-3 py-3 text-left transition",
                    model === item.id
                      ? "border-[#174CCF] bg-[#EEF2FF] text-brand"
                      : "border-[#E2DBCF] bg-white text-[#536078] hover:border-[#9DB8F8]"
                  )}
                >
                  <span className="block t-label">{item.label}</span>
                  <span className="mt-1.5 block t-caption font-normal">
                    {item.blurb}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-4 border-t border-[#E5DED3] pt-3 t-body-sm text-ink-muted">
              Current route:{" "}
              <span className="font-semibold text-ink">
                {MODELS.find(m => m.id === model)?.label}
              </span>
              . Both options draw on ShefGuide&rsquo;s curated guidance.
            </p>
          </section>

          {sources.length > 0 && (
            <section className="border border-[#E0D9CC] bg-[#FFFCF6] p-5">
              <div className="flex items-center gap-2 t-title text-ink">
                <FileText className="size-4 text-brand" /> Drawn from
              </div>
              <ul className="mt-3 space-y-1.5">
                {sources.map(source => (
                  <li key={source} className="t-body-sm text-ink-muted">
                    · {source}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="border border-[#E0D9CC] bg-[#FFFCF6] p-5">
            <div className="flex items-center gap-2 t-title text-ink">
              <FileText className="size-4 text-[#C0432F]" /> Course material
              context
            </div>
            <p className="mt-2 text-pretty t-body-sm text-ink-muted">
              Attach a reading, brief or notes so you can ask with your material
              in view.
            </p>
            {attachedName ? (
              <div className="mt-4 flex items-center gap-3 border border-dashed border-[#8FB196] bg-[#F1F7EF] p-3">
                <FileText className="size-5 shrink-0 text-[#467A4A]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate t-label text-[#2D6140]">
                    {attachedName}
                  </p>
                  <p className="mt-0.5 t-caption text-[#3F6B4C]">
                    Ready for this chat
                  </p>
                </div>
                <button
                  onClick={detachDocument}
                  className="focus-ring grid size-11 shrink-0 place-items-center text-[#3F6B4C] hover:bg-[#E2EFE3]"
                  aria-label="Remove document"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-4 flex w-full items-center justify-center gap-2 border border-dashed border-[#CFC6B7] bg-[#FCFAF5] px-3 py-5 t-label text-brand transition hover:border-[#174CCF] hover:bg-[#EEF2FF] disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Reading…
                  </>
                ) : (
                  <>
                    <Upload className="size-4" /> Add a PDF or document
                  </>
                )}
              </button>
            )}
          </section>

          <section className="border border-[#F0D7D1] bg-[#FFF7F4] p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-[#C6493D]" />
              <div>
                <h3 className="t-title text-[#8F352D]">
                  A clear line on advice
                </h3>
                <p className="mt-1.5 text-pretty t-body-sm text-[#7E4E48]">
                  For urgent or specialist concerns, the safest answer is real
                  human help. We&rsquo;ll show you where to go.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </main>
    </WorkspaceShell>
  );
}
