/**
 * ShefGuide arrival plan.
 *
 * The plan is a route with a few stops rather than one long list: the student
 * picks the stop that matches where they actually are, and only that stop's
 * steps are on screen. A margin note keeps the single next step in view, so the
 * page answers "what do I do now" without the reader scanning everything.
 *
 * The stop tones are darkened from the design's coral and moss, which sit at
 * 3.45:1 and 3.84:1 against the paper: too faint for small label text. Every
 * stop also states its status in words, so nothing rides on colour alone.
 */
import { WorkspaceShell } from "@/components/WorkspaceSidebar";
import { useRequireAccount } from "@/hooks/useAuth";
import {
  generateChecklist,
  getChecklist,
  toggleChecklistTask,
  type ChecklistSection,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  CircleHelp,
  ListChecks,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const STOP_TONES = ["#174CCF", "#B23F33", "#41694A"];

function stopTone(index: number) {
  return STOP_TONES[index % STOP_TONES.length];
}

/** "01", "02" … padded so a stop with ten or more steps still reads correctly. */
function stepNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

export default function Checklist() {
  const authState = useRequireAccount("view your personalised checklist");
  const [sections, setSections] = useState<ChecklistSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<Set<string>>(
    () => new Set()
  );
  const [activeStop, setActiveStop] = useState(0);
  const [stopChosen, setStopChosen] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (authState !== "ready") return;
    let cancelled = false;

    (async () => {
      try {
        let data = await getChecklist();
        // A newly registered student has no checklist yet — generate it on
        // first visit rather than showing an empty page.
        if (!data.sections?.length) {
          if (!cancelled) setGenerating(true);
          data = await generateChecklist();
        }
        if (!cancelled) setSections(data.sections ?? []);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not load your checklist."
          );
        }
      } finally {
        if (!cancelled) {
          setGenerating(false);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  const allTasks = useMemo(
    () => sections.flatMap(section => section.tasks),
    [sections]
  );
  const total = allTasks.length;
  const completedCount = allTasks.filter(task => task.completed).length;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const nextTask = allTasks.find(task => !task.completed);
  const nextStopIndex = sections.findIndex(section =>
    section.tasks.some(task => task.id === nextTask?.id)
  );

  // Open on the stop the student has actually reached, then leave their choice
  // alone once they have picked one themselves.
  useEffect(() => {
    if (stopChosen || nextStopIndex < 0) return;
    setActiveStop(nextStopIndex);
  }, [nextStopIndex, stopChosen]);

  const toggle = async (taskId: string) => {
    if (pendingTasks.has(taskId)) return;
    setPendingTasks(current => new Set(current).add(taskId));
    // Optimistic flip so the tick feels immediate, reconciled with the server
    // response below.
    setSections(current =>
      current.map(section => ({
        ...section,
        tasks: section.tasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ),
      }))
    );
    try {
      const data = await toggleChecklistTask(taskId);
      setSections(data.sections ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update that step."
      );
      // Roll the optimistic change back.
      setSections(current =>
        current.map(section => ({
          ...section,
          tasks: section.tasks.map(task =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
          ),
        }))
      );
    } finally {
      setPendingTasks(current => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
    }
  };

  /**
   * Tabs are only tabs if the keyboard agrees. Arrow keys move between stops,
   * Home and End jump to the ends, and focus follows selection.
   */
  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = sections.length - 1;
    let target = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      target = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      target = index === 0 ? last : index - 1;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = last;
    else return;
    event.preventDefault();
    setActiveStop(target);
    setStopChosen(true);
    tabRefs.current[target]?.focus();
  };

  if (authState !== "ready" || loading) {
    return (
      <WorkspaceShell title="Your arrival plan" eyebrow="Your first weeks">
        {/* Skeleton in the shape of the real page rather than a spinner in empty
            space. Generating a plan takes real time, so that path keeps an
            explicit line of text saying what is happening. */}
        <main
          aria-busy="true"
          className="mx-auto max-w-[1190px] p-4 sm:p-6 lg:p-8"
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_260px] lg:items-start">
            <div>
              <span className="block h-9 w-3/4 animate-pulse bg-[#EDE8DF]" />
              <span className="mt-3 block h-9 w-2/3 animate-pulse bg-[#EDE8DF]" />
              <p className="mt-5 flex items-center gap-2 t-label text-ink-muted">
                <Loader2 className="size-4 animate-spin text-brand" />
                {generating
                  ? "Building your personalised plan…"
                  : "Loading your plan…"}
              </p>
            </div>
            <div className="border border-[#E0D9CC] p-5">
              <span className="block h-3 w-24 animate-pulse bg-[#F1ECE4]" />
              <span className="mt-3 block h-8 w-20 animate-pulse bg-[#EDE8DF]" />
              <span className="mt-4 block h-2 w-full animate-pulse bg-[#E7E2D9]" />
            </div>
          </div>
          <div className="mt-10 border border-[#E0D9CC] bg-[#FFFCF6]">
            <div className="grid border-b border-[#EAE3D7] sm:grid-cols-3">
              {[0, 1, 2].map(stop => (
                <div
                  key={stop}
                  className="border-[#EAE3D7] p-5 sm:border-r sm:last:border-r-0"
                >
                  <span className="block size-7 animate-pulse rounded-full bg-[#EDE8DF]" />
                  <span className="mt-3 block h-3 w-20 animate-pulse bg-[#F1ECE4]" />
                  <span className="mt-2 block h-4 w-28 animate-pulse bg-[#EDE8DF]" />
                </div>
              ))}
            </div>
            <div className="p-6 sm:p-8">
              {[0, 1, 2].map(row => (
                <div
                  key={row}
                  className="flex gap-4 border-b border-[#EFE9DE] py-5 last:border-0"
                >
                  <span className="size-6 shrink-0 animate-pulse rounded-full bg-[#EDE8DF]" />
                  <div className="min-w-0 flex-1">
                    <span className="block h-4 w-1/2 animate-pulse bg-[#EDE8DF]" />
                    <span className="mt-2.5 block h-3 w-4/5 animate-pulse bg-[#F1ECE4]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </WorkspaceShell>
    );
  }

  const stop = sections[activeStop];
  const stopDone = stop ? stop.tasks.filter(task => task.completed).length : 0;
  const nextStopTitle =
    nextStopIndex >= 0 ? sections[nextStopIndex]?.title : null;

  return (
    <WorkspaceShell title="Your arrival plan" eyebrow="Your first weeks">
      <main className="mx-auto max-w-[1190px] p-4 sm:p-6 lg:p-8">
        {/* Header: the message on the left, progress as a small panel on the
            right rather than a full-width bar, so the number reads as a status
            rather than the headline. */}
        <div className="grid gap-8 lg:grid-cols-[1fr_260px] lg:items-start">
          <header>
            <h2 className="text-balance t-display text-ink">
              Start with the next step.
            </h2>
            <p className="mt-4 max-w-[68ch] text-pretty t-body text-ink-muted">
              This is your practical starting plan for UK university life. Work
              through the phase that applies to you, then return whenever you
              need it.
            </p>
          </header>

          <div className="relative border border-[#DCD4C7] bg-[#FFFCF6] p-5">
            <span
              aria-hidden
              className="absolute -top-1.5 left-5 size-2.5 rounded-full bg-[#E35D4F]"
            />
            <p className="t-kicker text-[#3E4A60]">Ground covered</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="t-metric text-ink">{progress}%</p>
              <p className="pb-1 t-caption t-num text-[#566175]">
                {completedCount} of {total} steps
              </p>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${completedCount} of ${total} steps completed`}
              className="mt-4 h-2 overflow-hidden bg-[#E7E2D9]"
            >
              <div
                className="h-full bg-[#5E8B62] transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="mt-10 border border-[#E0D9CC] bg-[#FFFCF6] p-10 text-center">
            <p className="t-title text-[#22314D]">No plan yet.</p>
            <p className="mx-auto mt-2 max-w-[52ch] t-body-sm text-ink-muted">
              We could not build one from your profile. Ask ShefGuide directly
              and it can help you work out the first steps.
            </p>
            <Link
              href="/chat"
              className="mt-5 inline-flex items-center gap-2 bg-[#174CCF] px-4 py-3 t-label text-white transition hover:bg-brand-deep"
            >
              Ask ShefGuide <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <section className="mt-10 overflow-hidden border border-[#E0D9CC] bg-[#FFFCF6]">
            {/* Stop selector. Real tabs, so arrow keys and screen readers behave
                the way the control looks. */}
            <div
              role="tablist"
              aria-label="Arrival stops"
              className="grid border-b border-[#EAE3D7] sm:grid-cols-3"
            >
              {sections.map((section, index) => {
                const done = section.tasks.filter(
                  task => task.completed
                ).length;
                const isActive = index === activeStop;
                const isComplete =
                  section.tasks.length > 0 && done === section.tasks.length;
                const tone = stopTone(index);
                // The label states where this stop stands. It used to read
                // "Arrival stop" on all three, which told the reader nothing
                // and left the tone colour carrying meaning on its own.
                const status = isComplete
                  ? "Covered"
                  : index === nextStopIndex
                    ? "You are here"
                    : done > 0
                      ? "Started"
                      : "Ahead of you";
                return (
                  <button
                    key={section.title}
                    ref={node => {
                      tabRefs.current[index] = node;
                    }}
                    role="tab"
                    id={`stop-tab-${index}`}
                    aria-selected={isActive}
                    aria-controls={`stop-panel-${index}`}
                    tabIndex={isActive ? 0 : -1}
                    onKeyDown={event => onTabKeyDown(event, index)}
                    onClick={() => {
                      setActiveStop(index);
                      setStopChosen(true);
                    }}
                    className={cn(
                      "focus-ring-inset relative border-[#EAE3D7] p-5 text-left transition focus-visible:z-10 sm:border-r sm:last:border-r-0",
                      isActive
                        ? "bg-[#FFFCF6]"
                        : "bg-[#FAF7F1] hover:bg-[#F6F2EA]"
                    )}
                  >
                    {/* The selected stop is marked by a rule, not by colour alone. */}
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-0.5 bg-[#174CCF]"
                      />
                    )}
                    <span className="flex items-center gap-3">
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full border text-[.6875rem] font-bold t-num",
                          isComplete
                            ? "border-[#5E8B62] bg-[#5E8B62] text-white"
                            : isActive
                              ? "border-[#174CCF] bg-[#EEF2FF] text-brand"
                              : "border-[#DCD4C7] bg-[#FFFCF6] text-[#5B6472]"
                        )}
                      >
                        {isComplete ? (
                          <Check className="size-3.5" strokeWidth={3} />
                        ) : (
                          stepNumber(index)
                        )}
                      </span>
                      {/* Connector to the next stop, drawn only between cards. */}
                      {index < sections.length - 1 && (
                        <span
                          aria-hidden
                          className="hidden h-px flex-1 bg-[repeating-linear-gradient(to_right,#D6D0C5_0_3px,transparent_3px_7px)] sm:block"
                        />
                      )}
                    </span>
                    <span
                      className="mt-3 block t-kicker"
                      style={{ color: tone }}
                    >
                      {status}
                    </span>
                    <span className="mt-1 flex items-baseline justify-between gap-3">
                      <span className="t-title text-ink-title">
                        {section.title}
                      </span>
                      <span className="shrink-0 t-caption t-num text-[#5B6472]">
                        {done}/{section.tasks.length}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid lg:grid-cols-[1fr_300px]">
              <div
                role="tabpanel"
                id={`stop-panel-${activeStop}`}
                aria-labelledby={`stop-tab-${activeStop}`}
                className="p-6 sm:p-8"
              >
                <h3 className="t-subhead text-ink">{stop?.title}</h3>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="max-w-[60ch] text-pretty t-body-sm text-ink-muted">
                    {stop?.tasks.length === 0
                      ? "Nothing listed for this stop."
                      : "A few practical details that make this part of arriving less hectic."}
                  </p>
                  <p className="t-caption t-num text-[#5B6472]">
                    {stopDone} of {stop?.tasks.length ?? 0} covered
                  </p>
                </div>

                <ul className="mt-6">
                  {stop?.tasks.map((task, index) => {
                    const isDone = task.completed;
                    const isNext = task.id === nextTask?.id;
                    const isBusy = pendingTasks.has(task.id);
                    return (
                      <li
                        key={task.id}
                        className="group flex gap-4 border-b border-[#EFE9DE] py-5 last:border-0"
                      >
                        <button
                          onClick={() => toggle(task.id)}
                          disabled={isBusy}
                          role="checkbox"
                          aria-checked={isDone}
                          className={cn(
                            "focus-ring mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border transition disabled:cursor-wait",
                            isDone
                              ? "border-[#5E8B62] bg-[#5E8B62] text-white"
                              : isNext
                                ? "border-[#174CCF] text-transparent hover:bg-[#EEF2FF]"
                                : "border-[#8B93A0] text-transparent hover:border-[#174CCF]"
                          )}
                          aria-label={`Mark ${task.title} ${isDone ? "incomplete" : "complete"}`}
                        >
                          {isBusy ? (
                            <Loader2 className="size-3.5 animate-spin text-brand" />
                          ) : (
                            <Check className="size-3.5" strokeWidth={3} />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <p className="flex min-w-0 items-baseline gap-3">
                              <span
                                className={cn(
                                  "t-title",
                                  isDone
                                    ? "text-[#5F6E66] line-through decoration-[#A4C0A6]"
                                    : "text-ink-title"
                                )}
                              >
                                {task.title}
                              </span>
                            </p>
                            {/* Always visible, per the design. A hover-reveal
                                would hide it entirely on touch and give the
                                reader no hint the shortcut exists. */}
                            <Link
                              href={`/chat?q=${encodeURIComponent(task.title)}`}
                              className="focus-ring inline-flex shrink-0 items-center gap-1.5 px-1 py-1.5 -my-1 t-label text-brand transition hover:gap-2"
                            >
                              <MessageCircle className="size-3.5" /> Ask
                            </Link>
                          </div>
                          {task.description && (
                            <p className="mt-1.5 max-w-[68ch] text-pretty t-body-sm text-ink-muted">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Margin note: the single next step, kept in view so the page
                  answers "what now" without re-reading the list. */}
              <aside className="flex flex-col border-t border-[#EAE3D7] bg-[#FAF7F1] p-6 lg:border-l lg:border-t-0">
                <span className="grid size-9 place-items-center border border-[#E2DACB] bg-[#FFFCF6] text-brand">
                  <ListChecks className="size-4" />
                </span>
                <p className="mt-4 t-kicker text-[#B23F33]">Up next</p>
                {nextTask ? (
                  <>
                    <p className="mt-2 t-title text-ink-title">
                      {nextTask.title}
                    </p>
                    {nextStopTitle && (
                      <p className="mt-2 t-body-sm text-ink-muted">
                        This belongs in{" "}
                        <span className="font-semibold text-[#3E4A60]">
                          {nextStopTitle}
                        </span>
                        .
                      </p>
                    )}
                    <Link
                      href={`/chat?q=${encodeURIComponent(nextTask.title)}`}
                      className="mt-4 inline-flex items-center gap-2 bg-[#174CCF] px-4 py-2.5 t-label text-white transition hover:-translate-y-0.5 hover:bg-brand-deep active:translate-y-0"
                    >
                      Talk it through <ArrowRight className="size-3.5" />
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="mt-2 t-title text-ink-title">
                      Every step is covered.
                    </p>
                    <p className="mt-2 t-body-sm text-ink-muted">
                      Come back whenever your situation changes and the plan
                      still applies.
                    </p>
                  </>
                )}

                <p className="mt-8 flex gap-2 border-t border-[#E2DACB] pt-4 t-caption text-[#5B6472] lg:mt-auto">
                  <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-[#B23F33]" />
                  This is a guide, not a deadline. Your university may have
                  different processes and dates.
                </p>
              </aside>
            </div>
          </section>
        )}

        <section className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-[#B23F33]" />
            <div>
              <h3 className="t-title text-ink">
                Not sure which phase applies to you?
              </h3>
              <p className="mt-1 max-w-[68ch] text-pretty t-body-sm text-ink-muted">
                Tell ShefGuide where you are in your arrival journey and it can
                help you decide what matters next.
              </p>
            </div>
          </div>
          <Link
            href="/chat"
            className="py-1.5 -my-1.5 inline-flex shrink-0 items-center gap-2 t-label text-brand transition hover:gap-3"
          >
            Ask ShefGuide <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
    </WorkspaceShell>
  );
}
