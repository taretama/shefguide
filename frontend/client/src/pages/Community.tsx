/**
 * ShefGuide design reminder: community is a set of curated study notes — individual voices and AI context stay visibly distinct and calm.
 */
import { useDisclosure } from "@/components/DisclosureGate";
import { WorkspaceShell } from "@/components/WorkspaceSidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStatus } from "@/hooks/useAuth";
import {
  createPost,
  generatePostAiAnswer,
  isGuest,
  isLoggedIn,
  listPosts,
  replyToPost,
  timeAgo,
  type Post,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  Bot,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Send,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

/**
 * Board answers come back as markdown. The card renders them as plain text, so
 * "**bold**" and list syntax would otherwise show up literally.
 */
function plainText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "academic", label: "Academic" },
  { id: "arrival", label: "Arrival" },
  { id: "technology", label: "Tech & AI" },
  { id: "general", label: "General" },
];

export default function Community() {
  // The board is deliberately readable without an account — only posting and
  // replying need one.
  const { guest } = useAuthStatus();
  const { ensureDisclosure, disclosureDialog } = useDisclosure();
  const [, navigate] = useLocation();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [posting, setPosting] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const load = async () => {
    try {
      const data = await listPosts();
      setPosts(data.posts ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load the board."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return posts.filter(post => {
      const matchesCategory =
        category === "all" || (post.category ?? "").toLowerCase() === category;
      const matchesQuery =
        !term || (post.question ?? "").toLowerCase().includes(term);
      return matchesCategory && matchesQuery;
    });
  }, [posts, query, category]);

  const requireAccount = (action: string) => {
    if (!isLoggedIn() || isGuest()) {
      navigate(`/sign-up?why=${encodeURIComponent(action)}&next=/community`);
      return false;
    }
    return true;
  };

  const submitQuestion = async () => {
    const text = question.trim();
    if (!text) {
      toast.error("Write a question first.");
      return;
    }
    if (!requireAccount("post a question on the board")) return;

    setPosting(true);
    try {
      const created = await createPost(
        text,
        category === "all" ? "general" : category
      );
      setQuestion("");
      setAsking(false);
      toast.success(created.message ?? "Your question is on the board.");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not post your question."
      );
    } finally {
      setPosting(false);
    }
  };

  const requestAiAnswer = async (postId: string) => {
    if (!requireAccount("get a ShefGuide answer")) return;
    try {
      await ensureDisclosure();
    } catch {
      return;
    }
    setAnsweringId(postId);
    try {
      await generatePostAiAnswer(postId);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not generate an answer."
      );
    } finally {
      setAnsweringId(null);
    }
  };

  const submitReply = async (postId: string) => {
    const text = replyText.trim();
    if (!text) return;
    if (!requireAccount("reply to a question")) return;
    try {
      await replyToPost(postId, text);
      setReplyText("");
      setReplyingId(null);
      toast.success("Reply added.");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add your reply."
      );
    }
  };

  return (
    <WorkspaceShell title="Community Q&A" eyebrow="Ask and answer">
      {disclosureDialog}
      <main className="mx-auto max-w-[1220px] p-4 sm:p-6 lg:p-8">
        <section className="relative overflow-hidden border border-[#DED6C8] bg-[#FFFCF6] p-6 sm:p-8">
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 hidden w-[46%] bg-[url('/images/community-room.jpg')] bg-cover bg-center opacity-90 lg:block"
            style={{
              // Without this the photograph stops at a hard vertical line
              // partway across the card; the fade lets it settle into the paper.
              maskImage: "linear-gradient(to right, transparent, #000 42%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, #000 42%)",
            }}
          />
          <div className="relative max-w-[680px]">
            <h2 className="text-balance t-display text-ink">
              A shared notebook for the questions that travel well.
            </h2>
            <p className="mt-5 max-w-[64ch] text-pretty t-body text-ink-muted">
              Search first, then add your own question. Every post can get a
              source-aware ShefGuide answer; fellow students can add their own
              experience below.
            </p>
            <button
              onClick={() => setAsking(true)}
              className="mt-6 inline-flex items-center gap-2 bg-[#174CCF] px-4 py-3 t-label text-white shadow-[0_8px_16px_rgba(23,76,207,.18)] transition hover:-translate-y-0.5 hover:bg-brand-deep"
            >
              <Plus className="size-4" /> Ask the community
            </button>
          </div>
        </section>

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_245px]">
          <section>
            {guest && (
              <div className="mb-4 flex items-start gap-3 border border-[#F0E2C9] bg-[#FDF6E7] p-3.5">
                <UsersRound className="mt-0.5 size-4 shrink-0 text-[#8A6516]" />
                <div>
                  <p className="t-label text-[#8A6516]">
                    You are browsing as a guest.
                  </p>
                  <p className="mt-1 t-body-sm text-[#7A5912]">
                    Reading is open to everyone. Posting and replying need a
                    free account.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#616875]" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  className="w-full border border-[#DDD5C7] bg-[#FFFCF6] py-3 pl-10 pr-4 t-input outline-none placeholder:text-ink-soft focus:border-[#174CCF] focus:ring-4 focus:ring-[#174CCF]/10"
                  placeholder="Search questions before posting"
                  aria-label="Search community questions"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setCategory(item.id)}
                    aria-pressed={category === item.id}
                    className={cn(
                      "px-3 py-2 t-label transition",
                      category === item.id
                        ? "bg-[#174CCF] text-white"
                        : "border border-[#DDD5C7] bg-[#FFFCF6] text-[#526078] hover:border-[#174CCF]"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {loading ? (
                <div
                  aria-busy="true"
                  aria-label="Loading the board"
                  className="space-y-4"
                >
                  {[0, 1, 2].map(card => (
                    <div
                      key={card}
                      className="border border-[#E0D9CC] bg-[#FFFCF6] p-5"
                    >
                      <div className="flex gap-2">
                        <span className="block h-5 w-20 animate-pulse bg-[#EDE8DF]" />
                        <span className="block h-5 w-16 animate-pulse bg-[#F1ECE4]" />
                      </div>
                      <span className="mt-3 block h-4 w-2/3 animate-pulse bg-[#EDE8DF]" />
                      <span className="mt-4 block h-16 w-full animate-pulse bg-[#F1ECE4]" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {visible.map(item => (
                    <article
                      className="relative overflow-hidden border border-[#E0D9CC] bg-[#FFFCF6] p-5 shadow-[0_6px_16px_rgba(35,50,72,.04)]"
                      key={item._id}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-[#EEF2FF] px-2.5 py-1 t-badge text-brand">
                          {item.category || "general"}
                        </span>
                        <span className="t-caption text-[#616875]">
                          {timeAgo(item.created_at)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-pretty t-title text-ink-title">
                        {item.question}
                      </h3>

                      {item.ai_answer?.text ? (
                        <div className="mt-4 border border-[#D3DEFA] bg-[#F4F7FF] p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 t-kicker text-brand">
                            <span className="flex items-center gap-2">
                              <Bot className="size-3.5" /> ShefGuide&rsquo;s
                              first answer
                            </span>
                            {item.ai_answer.model_used && (
                              <span className="t-caption normal-case text-[#5A6B8E]">
                                {item.ai_answer.model_used}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 max-w-[68ch] whitespace-pre-wrap t-body-sm text-[#41516F]">
                            {plainText(item.ai_answer.text)}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => requestAiAnswer(item._id)}
                          disabled={answeringId === item._id}
                          className="mt-4 inline-flex items-center gap-2 border border-dashed border-[#B6C7F3] bg-[#F7F9FF] px-3.5 py-2.5 t-label text-brand transition hover:border-[#174CCF] disabled:opacity-60"
                        >
                          {answeringId === item._id ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />{" "}
                              Asking ShefGuide…
                            </>
                          ) : (
                            <>
                              <Bot className="size-3.5" /> Get a ShefGuide
                              answer
                            </>
                          )}
                        </button>
                      )}

                      {item.replies?.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-[#EAE3D7] pt-3">
                          {item.replies.map((reply, replyIndex) => (
                            <div key={replyIndex} className="bg-[#F7F4EE] p-3">
                              <p className="max-w-[68ch] text-pretty t-body-sm text-[#41516F]">
                                {reply.text}
                              </p>
                              <p className="mt-1.5 t-caption text-[#616875]">
                                A student · {timeAgo(reply.created_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <button
                          onClick={() =>
                            setReplyingId(
                              replyingId === item._id ? null : item._id
                            )
                          }
                          className="py-1.5 -my-1.5 inline-flex items-center gap-1.5 t-label text-[#536078] hover:text-brand"
                        >
                          <MessageCircle className="size-4" />{" "}
                          {item.replies?.length ?? 0} student{" "}
                          {(item.replies?.length ?? 0) === 1
                            ? "reply"
                            : "replies"}
                        </button>
                      </div>

                      {replyingId === item._id && (
                        <div className="mt-3 flex items-end gap-2">
                          <textarea
                            value={replyText}
                            onChange={event => setReplyText(event.target.value)}
                            autoFocus
                            rows={2}
                            className="flex-1 resize-none border border-[#DCD4C7] bg-white p-3 t-input outline-none placeholder:text-ink-soft focus:border-[#174CCF] focus:ring-4 focus:ring-[#174CCF]/10"
                            placeholder="Share what helped you…"
                          />
                          <button
                            onClick={() => submitReply(item._id)}
                            className="grid size-10 shrink-0 place-items-center bg-[#174CCF] text-white transition hover:bg-brand-deep"
                            aria-label="Send reply"
                          >
                            <Send className="size-4" />
                          </button>
                        </div>
                      )}
                    </article>
                  ))}

                  {visible.length === 0 && (
                    <div className="border border-dashed border-[#CFC6B8] p-10 text-center">
                      <Search className="mx-auto size-6 text-[#616875]" />
                      <p className="mt-3 t-title text-[#34425C]">
                        Nothing matches that yet.
                      </p>
                      <p className="mt-1 t-body-sm text-ink-muted">
                        You could be the first person to ask.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <aside className="paper-note h-fit border border-[#D9D1C3] bg-[#F4F0E8] p-5 text-ink">
            <Sparkles className="size-5 text-[#E35D4F]" />
            <p className="mt-4 t-kicker text-[#C0432F]">Board boundary</p>
            <h3 className="mt-2 text-balance t-subhead">
              A place for context, not diagnosis.
            </h3>
            <p className="mt-3 text-pretty t-body-sm text-[#4E5B70]">
              The board is for academic and everyday university-life questions.
              If a post needs specialised help, ShefGuide will help point to a
              real person or service instead.
            </p>
            {/* This looked like a link but was a plain div. The board rules live in
                the "Community participation" section of the terms page. */}
            <Link
              href="/terms"
              className="mt-5 block border-t border-[#D6CFC2] pt-4 t-label text-brand hover:underline"
            >
              Community guidelines{" "}
              <ArrowUpRight className="ml-1 inline size-3.5" />
            </Link>
          </aside>
        </div>

        {/* Radix dialog rather than a bare fixed div: this gets the focus trap,
            Escape handling, scroll lock and aria wiring the hand-rolled overlay
            was missing. */}
        <Dialog open={asking} onOpenChange={setAsking}>
          <DialogContent className="border-[#DED6C8] bg-[#FFFCF6] p-6">
            <DialogHeader className="text-left">
              <DialogTitle className="t-subhead text-ink">
                What would you like help with?
              </DialogTitle>
              <DialogDescription className="max-w-[62ch] text-pretty t-body-sm text-ink-muted">
                Please do not share personal medical, immigration, legal,
                financial or mental-health details here.
              </DialogDescription>
            </DialogHeader>
            <label className="sr-only" htmlFor="community-question">
              Your question
            </label>
            <textarea
              id="community-question"
              value={question}
              onChange={event => setQuestion(event.target.value)}
              autoFocus
              className="min-h-32 w-full border border-[#DCD4C7] bg-white p-4 t-input outline-none placeholder:text-ink-soft focus:border-[#174CCF] focus:ring-4 focus:ring-[#174CCF]/10"
              placeholder="For example: I’m unsure what tutors expect in a seminar…"
            />
            <button
              onClick={submitQuestion}
              disabled={posting}
              className="inline-flex w-full items-center justify-center gap-2 bg-[#174CCF] py-3.5 t-label text-white transition hover:bg-brand-deep active:scale-[.99] disabled:opacity-60"
            >
              {posting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Posting…
                </>
              ) : (
                <>
                  <Send className="size-4" /> Post question
                </>
              )}
            </button>
          </DialogContent>
        </Dialog>
      </main>
    </WorkspaceShell>
  );
}
