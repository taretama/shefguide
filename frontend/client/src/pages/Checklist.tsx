/**
 * ShefGuide Interactive Arrival Checklist & Task Flow.
 *
 * A modern, responsive, tactile To-Do and Arrival Checklist application.
 * Highlights the current active step and automatically transitions focus
 * to the next step when a task is completed, with smooth animations,
 * custom task creation, and authentic ShefGuide editorial styling.
 */
import { WorkspaceShell } from "@/components/WorkspaceSidebar";
import { useRequireAccount } from "@/hooks/useAuth";
import {
  generateChecklist,
  getChecklist,
  toggleChecklistTask,
  type ChecklistSection,
  type ChecklistTask,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  Compass,
  Filter,
  Flame,
  LayoutList,
  ListChecks,
  Loader2,
  MessageCircle,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const CUSTOM_TASKS_KEY = "shefguide:custom_checklist_tasks";

interface CustomTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority?: "high" | "normal";
  createdAt: number;
}

export default function Checklist() {
  const authState = useRequireAccount("view your personalised arrival checklist");

  const [sections, setSections] = useState<ChecklistSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<Set<string>>(
    () => new Set()
  );

  // Custom student tasks (stored persistently in localStorage)
  const [customTasks, setCustomTasks] = useState<CustomTask[]>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_TASKS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // New task input state
  const [newCustomTaskTitle, setNewCustomTaskTitle] = useState("");
  const [newCustomTaskDesc, setNewCustomTaskDesc] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);

  // View, filter & search states
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"roadmap" | "focus">("roadmap");

  // Active highlighted task (auto-tracks the current next task or user selection)
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  // Save custom tasks
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(customTasks));
    } catch {
      /* ignore */
    }
  }, [customTasks]);

  // Load server checklist
  useEffect(() => {
    if (authState !== "ready") return;
    let cancelled = false;

    (async () => {
      try {
        let data = await getChecklist();
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

  // Combined tasks list (server tasks + custom student tasks)
  const allServerTasks = useMemo(
    () => sections.flatMap(section => section.tasks),
    [sections]
  );

  const allCombinedTasks = useMemo(() => {
    const customAsTasks: ChecklistTask[] = customTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority || "normal",
      completed: t.completed,
    }));
    return [...allServerTasks, ...customAsTasks];
  }, [allServerTasks, customTasks]);

  const totalTasks = allCombinedTasks.length;
  const completedTasksCount = allCombinedTasks.filter(t => t.completed).length;
  const activeTasksCount = totalTasks - completedTasksCount;
  const progressPercent =
    totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;

  // Identify the immediate next pending task
  const currentNextTask = useMemo(
    () => allCombinedTasks.find(t => !t.completed),
    [allCombinedTasks]
  );

  /**
   * Ticking a task moves the focus highlight to the next one, but the page
   * used to stay where it was, so the student had to hunt for what had just
   * become current. These refs let the list carry them along: to the next
   * section heading when the next task begins a new phase, to the task itself
   * when it is in the same phase, and back to the top once nothing is left.
   */
  const taskRefs = useRef(new Map<string, HTMLElement>());
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const topRef = useRef<HTMLDivElement>(null);

  const registerTask = (id: string) => (el: HTMLElement | null) => {
    if (el) taskRefs.current.set(id, el);
    else taskRefs.current.delete(id);
  };
  const registerSection = (title: string) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(title, el);
    else sectionRefs.current.delete(title);
  };

  const sectionTitleOf = (taskId: string) => {
    if (customTasks.some(t => t.id === taskId)) return "My Personal Tasks";
    return sections.find(s => s.tasks.some(t => t.id === taskId))?.title ?? null;
  };

  /**
   * Scrolls after the tick has been painted. Framer Motion animates the row's
   * layout on completion, so measuring immediately would aim at the position
   * the row is leaving rather than the one it settles into.
   */
  const scrollAfterToggle = (completedId: string) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth";

    // Order of the list as the student sees it, with the just-ticked task
    // treated as done so it is never chosen as its own "next".
    const ordered = allCombinedTasks.map(t =>
      t.id === completedId ? { ...t, completed: true } : t
    );
    const from = ordered.findIndex(t => t.id === completedId);
    const after = ordered.slice(from + 1).find(t => !t.completed);
    const wrapped = after ?? ordered.find(t => !t.completed);

    window.setTimeout(() => {
      if (!wrapped) {
        // Whole checklist finished: back to the very top of the page, not just
        // the top of the list, so the completed progress summary is what the
        // student lands on.
        window.scrollTo({ top: 0, behavior });
        return;
      }
      const fromSection = sectionTitleOf(completedId);
      const toSection = sectionTitleOf(wrapped.id);
      const crossesSection = !!toSection && toSection !== fromSection;

      // A new phase always pulls the student to its heading, so the change of
      // section is legible.
      if (crossesSection) {
        const header = sectionRefs.current.get(toSection!);
        (header ?? topRef.current)?.scrollIntoView({ behavior, block: "start" });
        return;
      }

      // Within a phase, only move if the next task is low in the viewport or
      // below it. Re-centring one that is already comfortably in view would
      // scroll backwards, which reads as the page fighting the student.
      const el = taskRefs.current.get(wrapped.id);
      if (!el) return;
      const { top } = el.getBoundingClientRect();
      if (top > window.innerHeight * 0.72) {
        el.scrollIntoView({ behavior, block: "center" });
      }
    }, 260);
  };

  // Find the section corresponding to the current next task
  const currentNextSectionTitle = useMemo(() => {
    if (!currentNextTask) return null;
    const isCustom = customTasks.some(t => t.id === currentNextTask.id);
    if (isCustom) return "My Personal Tasks";
    const sec = sections.find(s =>
      s.tasks.some(t => t.id === currentNextTask.id)
    );
    return sec ? sec.title : null;
  }, [currentNextTask, customTasks, sections]);

  // Auto-focus current next task on initial load or if focused task was completed
  useEffect(() => {
    if (!focusedTaskId && currentNextTask) {
      setFocusedTaskId(currentNextTask.id);
    }
  }, [currentNextTask, focusedTaskId]);

  // Handle checking/toggling a task with smooth auto-transition to the next one
  const handleToggle = async (taskId: string) => {
    if (pendingTasks.has(taskId)) return;

    // Only advance the page when a task is being ticked off. Un-ticking one
    // should leave the student where they are rather than jumping them away.
    const wasCompleted =
      allCombinedTasks.find(t => t.id === taskId)?.completed ?? false;
    if (!wasCompleted) scrollAfterToggle(taskId);

    // Check if it is a custom task
    const isCustom = customTasks.some(t => t.id === taskId);
    if (isCustom) {
      setCustomTasks(prev => {
        const next = prev.map(t =>
          t.id === taskId ? { ...t, completed: !t.completed } : t
        );
        // Find next pending task after this one
        const nextPending = next.find(t => !t.completed);
        if (nextPending) {
          setFocusedTaskId(nextPending.id);
        } else {
          // If no custom pending, find next server pending
          const nextServer = allServerTasks.find(t => !t.completed);
          if (nextServer) setFocusedTaskId(nextServer.id);
        }
        return next;
      });
      toast.success("Task updated!", { duration: 1500 });
      return;
    }

    // Server task
    setPendingTasks(prev => new Set(prev).add(taskId));

    // Optimistic toggle
    setSections(prev => {
      const updated = prev.map(section => ({
        ...section,
        tasks: section.tasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ),
      }));

      // Find the next task to automatically transition focus to
      const allUpdatedTasks = updated.flatMap(s => s.tasks);
      const nextPending =
        allUpdatedTasks.find(t => !t.completed && t.id !== taskId) ||
        customTasks.find(t => !t.completed);

      if (nextPending) {
        setFocusedTaskId(nextPending.id);
      }

      return updated;
    });

    try {
      const data = await toggleChecklistTask(taskId);
      setSections(data.sections ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update task."
      );
      // Rollback
      setSections(prev =>
        prev.map(section => ({
          ...section,
          tasks: section.tasks.map(task =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
          ),
        }))
      );
    } finally {
      setPendingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // Add a personal student task
  const handleAddCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newCustomTaskTitle.trim();
    if (!title) return;

    const newTask: CustomTask = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      description: newCustomTaskDesc.trim(),
      completed: false,
      priority: "normal",
      createdAt: Date.now(),
    };

    setCustomTasks(prev => [newTask, ...prev]);
    setNewCustomTaskTitle("");
    setNewCustomTaskDesc("");
    setIsAddingTask(false);
    setFocusedTaskId(newTask.id);
    toast.success("Personal task added!");
  };

  const handleDeleteCustomTask = (id: string) => {
    setCustomTasks(prev => prev.filter(t => t.id !== id));
    toast.success("Task deleted.");
  };

  // Refresh server roadmap
  const handleRegenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const data = await generateChecklist();
      setSections(data.sections ?? []);
      toast.success("Arrival roadmap updated!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not refresh checklist."
      );
    } finally {
      setGenerating(false);
    }
  };

  // Filtered sections and custom tasks
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return sections
      .filter(section => {
        if (selectedPhase !== "all" && section.title !== selectedPhase) {
          return false;
        }
        return true;
      })
      .map(section => {
        const tasks = section.tasks.filter(task => {
          if (filter === "active" && task.completed) return false;
          if (filter === "completed" && !task.completed) return false;
          if (q) {
            const matchTitle = task.title.toLowerCase().includes(q);
            const matchDesc = (task.description || "").toLowerCase().includes(q);
            return matchTitle || matchDesc;
          }
          return true;
        });
        return { ...section, tasks };
      })
      .filter(section => {
        if (searchQuery.trim() || filter !== "all") {
          return section.tasks.length > 0;
        }
        return true;
      });
  }, [sections, searchQuery, filter, selectedPhase]);

  // Filtered custom tasks
  const filteredCustomTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (selectedPhase !== "all" && selectedPhase !== "custom") return [];

    return customTasks.filter(t => {
      if (filter === "active" && t.completed) return false;
      if (filter === "completed" && !t.completed) return false;
      if (q) {
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = (t.description || "").toLowerCase().includes(q);
        return matchTitle || matchDesc;
      }
      return true;
    });
  }, [customTasks, searchQuery, filter, selectedPhase]);

  // Active focused task object
  const focusedTask = useMemo(() => {
    if (!focusedTaskId) return currentNextTask || null;
    return allCombinedTasks.find(t => t.id === focusedTaskId) || currentNextTask || null;
  }, [focusedTaskId, allCombinedTasks, currentNextTask]);

  if (authState !== "ready" || loading) {
    return (
      <WorkspaceShell title="Arrival Checklist" eyebrow="Sheffield Roadmap">
        <main
          aria-busy="true"
          className="mx-auto max-w-[1080px] p-4 sm:p-6 lg:p-8 space-y-6"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="h-8 w-64 animate-pulse bg-[#EDE8DF]" />
              <div className="h-4 w-96 animate-pulse bg-[#EDE8DF]" />
            </div>
            <div className="h-10 w-28 animate-pulse bg-[#EDE8DF]" />
          </div>
          <div className="h-24 border border-[#E0D9CC] bg-[#FFFCF6] animate-pulse" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-32 border border-[#E0D9CC] bg-[#FFFCF6] animate-pulse"
              />
            ))}
          </div>
        </main>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title="Arrival Checklist" eyebrow="Sheffield Roadmap">
      <main className="mx-auto max-w-[1080px] p-4 sm:p-6 lg:p-8 space-y-7">
        {/* =========================================================================
            TOP HEADER & ACTION BAR
            ========================================================================= */}
        <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4 border-b border-[#E0D9CC] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="t-kicker text-brand flex items-center gap-1">
                <Compass className="size-3.5" />
                Sheffield Orientation Guide
              </span>
              <span className="text-[#C4B9A6]">•</span>
              <span className="t-caption text-ink-soft">
                Interactive To-Do Flow
              </span>
            </div>
            <h1 className="mt-2 t-display text-ink">Arrival Checklist</h1>
            <p className="mt-1 max-w-[60ch] t-body text-ink-muted">
              Complete each arrival checkpoint in order. When you tick an item done,
              your focus automatically advances to the next step.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start">
            <button
              onClick={() => setIsAddingTask(true)}
              className="focus-ring inline-flex items-center gap-1.5 bg-[#174CCF] px-3.5 py-2 t-label text-white hover:bg-brand-deep transition shadow-xs"
            >
              <Plus className="size-4" />
              <span>Add Custom Task</span>
            </button>
            <button
              onClick={handleRegenerate}
              disabled={generating}
              title="Refresh from student profile"
              className="focus-ring inline-flex items-center gap-1.5 border border-[#DCD4C7] bg-[#FFFCF6] px-3 py-2 t-label text-ink hover:bg-[#FAF7F1] transition disabled:opacity-50"
            >
              <RotateCw
                className={cn(
                  "size-3.5 text-brand",
                  generating && "animate-spin"
                )}
              />
              <span className="hidden sm:inline">Sync</span>
            </button>
          </div>
        </header>

        {/* =========================================================================
            DYNAMIC PROGRESS & ACTIVE STEP SPOTLIGHT (AUTO-TRANSITION FLOW)
            ========================================================================= */}
        <section className="grid gap-5 lg:grid-cols-[1.3fr_1fr] items-stretch">
          {/* Active Step Spotlight Card */}
          <div className="relative border-2 border-[#174CCF] bg-[#FFFCF6] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <span
              aria-hidden
              className="absolute -top-2 left-6 border border-[#174CCF] bg-[#174CCF] px-2 py-0.5 t-badge text-white flex items-center gap-1 shadow-xs"
            >
              <Zap className="size-3 fill-white" />
              Current Active Step
            </span>

            <div>
              {focusedTask ? (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-kicker text-brand">
                      {currentNextSectionTitle || "Next on your list"}
                    </span>
                    {focusedTask.completed && (
                      <span className="border border-[#BBF7D0] bg-[#DCFCE7] px-2 py-0.5 t-badge text-[#2B6A3B]">
                        Completed ✓
                      </span>
                    )}
                  </div>

                  <h2 className="t-subhead text-ink text-xl sm:text-2xl font-bold">
                    {focusedTask.title}
                  </h2>

                  {focusedTask.description && (
                    <p className="t-body-sm text-ink-muted text-sm sm:text-base leading-relaxed">
                      {focusedTask.description}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-3 space-y-1">
                  <h2 className="t-subhead text-[#41694A] text-xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="size-6 text-[#41694A]" />
                    All items complete!
                  </h2>
                  <p className="t-body-sm text-ink-muted">
                    You have successfully cleared every arrival milestone. Safe travels!
                  </p>
                </div>
              )}
            </div>

            {/* Spotlight Actions Bar */}
            {focusedTask && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#EAE3D7] pt-4">
                <button
                  onClick={() => handleToggle(focusedTask.id)}
                  disabled={pendingTasks.has(focusedTask.id)}
                  className={cn(
                    "focus-ring inline-flex items-center gap-2 px-4 py-2.5 t-label font-bold transition shadow-xs cursor-pointer",
                    focusedTask.completed
                      ? "border border-[#DCD4C7] bg-[#FAF7F1] text-ink hover:bg-[#F2ECE1]"
                      : "bg-[#41694A] text-white hover:bg-[#34553B]"
                  )}
                >
                  <Check className="size-4" strokeWidth={3} />
                  <span>
                    {focusedTask.completed
                      ? "Mark Incomplete"
                      : "Done → Next Step"}
                  </span>
                </button>

                <Link
                  href={`/chat?q=${encodeURIComponent(focusedTask.title)}`}
                  className="focus-ring inline-flex items-center gap-1.5 border border-[#174CCF]/30 bg-[#EEF2FF] px-3.5 py-2 t-label text-brand hover:bg-[#E0E7FF] transition"
                >
                  <MessageCircle className="size-4" />
                  <span>Ask ShefGuide About This</span>
                </Link>
              </div>
            )}
          </div>

          {/* Overall Ground Covered Progress Card */}
          <div className="border border-[#E0D9CC] bg-[#FFFCF6] p-5 sm:p-6 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <p className="t-kicker text-ink-soft">Roadmap Readiness</p>
                <span className="t-badge border border-[#E0D9CC] bg-[#FAF7F1] px-2 py-0.5 text-ink-soft">
                  {completedTasksCount} of {totalTasks} steps
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="t-metric text-ink">{progressPercent}%</span>
                <span className="t-caption text-ink-muted">
                  {activeTasksCount} remaining
                </span>
              </div>

              {/* Progress Bar */}
              <div
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-3 h-2.5 overflow-hidden bg-[#EAE3D7]"
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={cn(
                    "h-full",
                    progressPercent === 100 ? "bg-[#41694A]" : "bg-[#174CCF]"
                  )}
                />
              </div>
            </div>

            {/* Quick Status Pill Filters */}
            <div className="mt-6 flex items-center justify-between border-t border-[#EAE3D7] pt-4">
              <div className="flex items-center gap-1 border border-[#DCD4C7] bg-[#FAF7F1] p-0.5 w-full justify-between">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={cn(
                    "flex-1 py-1.5 text-center t-label transition",
                    filter === "all"
                      ? "bg-[#174CCF] text-white shadow-xs"
                      : "text-ink-muted hover:text-ink"
                  )}
                >
                  All ({totalTasks})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("active")}
                  className={cn(
                    "flex-1 py-1.5 text-center t-label transition",
                    filter === "active"
                      ? "bg-[#174CCF] text-white shadow-xs"
                      : "text-ink-muted hover:text-ink"
                  )}
                >
                  To Do ({activeTasksCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("completed")}
                  className={cn(
                    "flex-1 py-1.5 text-center t-label transition",
                    filter === "completed"
                      ? "bg-[#174CCF] text-white shadow-xs"
                      : "text-ink-muted hover:text-ink"
                  )}
                >
                  Done ({completedTasksCount})
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            MODAL / DRAWER TO ADD CUSTOM PERSONAL TASK
            ========================================================================= */}
        <AnimatePresence>
          {isAddingTask && (
            <motion.form
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleAddCustomTask}
              className="border-2 border-[#174CCF] bg-[#FFFCF6] p-5 sm:p-6 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#EAE3D7] pb-3">
                <h3 className="t-title font-bold text-ink flex items-center gap-2">
                  <Plus className="size-4 text-brand" />
                  Add a Personal Sheffield Task
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddingTask(false)}
                  className="p-1 text-ink-soft hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block t-caption font-semibold text-ink-title">
                    Task Title *
                  </label>
                  <input
                    ref={newTaskInputRef}
                    type="text"
                    required
                    value={newCustomTaskTitle}
                    onChange={e => setNewCustomTaskTitle(e.target.value)}
                    placeholder="e.g., Collect keys from Endcliffe reception, Buy UK power adapter..."
                    className="focus-ring mt-1 w-full border border-[#DCD4C7] bg-[#FAF7F1] px-3.5 py-2 t-input text-ink focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block t-caption font-semibold text-ink-title">
                    Notes or Details (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCustomTaskDesc}
                    onChange={e => setNewCustomTaskDesc(e.target.value)}
                    placeholder="e.g., Reception open until 8pm, bring passport and tenancy confirmation"
                    className="focus-ring mt-1 w-full border border-[#DCD4C7] bg-[#FAF7F1] px-3.5 py-2 t-input text-ink focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingTask(false)}
                  className="border border-[#DCD4C7] px-3.5 py-2 t-label text-ink hover:bg-[#FAF7F1] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#174CCF] px-4 py-2 t-label text-white hover:bg-brand-deep transition"
                >
                  Save Task
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* =========================================================================
            SEARCH & PHASE SWITCHER
            ========================================================================= */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border border-[#E0D9CC] bg-[#FFFCF6] p-3.5 sm:p-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search checklist (e.g. GP, bank, BRP)..."
              className="focus-ring w-full border border-[#DCD4C7] bg-[#FAF7F1] py-1.5 pl-8 pr-7 t-body-sm text-ink placeholder:text-ink-soft focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-ink-soft hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Phase Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedPhase("all")}
              className={cn(
                "px-2.5 py-1 t-caption font-semibold border transition",
                selectedPhase === "all"
                  ? "border-[#174CCF] bg-[#EEF2FF] text-brand"
                  : "border-[#E0D9CC] bg-[#FAF7F1] text-ink-muted hover:bg-[#F2ECE1]"
              )}
            >
              All Phases
            </button>
            {sections.map(sec => (
              <button
                key={sec.title}
                onClick={() => setSelectedPhase(sec.title)}
                className={cn(
                  "px-2.5 py-1 t-caption font-semibold border transition",
                  selectedPhase === sec.title
                    ? "border-[#174CCF] bg-[#EEF2FF] text-brand"
                    : "border-[#E0D9CC] bg-[#FAF7F1] text-ink-muted hover:bg-[#F2ECE1]"
                )}
              >
                {sec.title}
              </button>
            ))}
            {customTasks.length > 0 && (
              <button
                onClick={() => setSelectedPhase("custom")}
                className={cn(
                  "px-2.5 py-1 t-caption font-semibold border transition",
                  selectedPhase === "custom"
                    ? "border-[#174CCF] bg-[#EEF2FF] text-brand"
                    : "border-[#E0D9CC] bg-[#FAF7F1] text-ink-muted hover:bg-[#F2ECE1]"
                )}
              >
                Personal ({customTasks.length})
              </button>
            )}
          </div>
        </section>

        {/* =========================================================================
            CHECKLIST TODO TASK SECTIONS
            ========================================================================= */}
        <div className="space-y-6">
          {/* Anchor for the return-to-top scroll once the list is finished. */}
          <div ref={topRef} aria-hidden="true" className="scroll-mt-6" />

          {/* Custom Student Tasks Section (If Any) */}
          {filteredCustomTasks.length > 0 && (
            <section className="border border-[#E0D9CC] bg-[#FFFCF6] overflow-hidden shadow-2xs">
              <div className="flex items-center justify-between border-b border-[#EAE3D7] bg-[#FAF7F1] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Bookmark className="size-4 text-brand" />
                  <h2 className="t-subhead text-ink text-lg font-bold">
                    My Personal Tasks
                  </h2>
                </div>
                <span className="t-caption t-num font-semibold text-ink-muted">
                  {filteredCustomTasks.filter(t => t.completed).length} of{" "}
                  {filteredCustomTasks.length} done
                </span>
              </div>

              <ul className="divide-y divide-[#EFE9DE] px-4 sm:px-5">
                {filteredCustomTasks.map(task => {
                  const isDone = task.completed;
                  const isFocused = focusedTaskId === task.id;

                  return (
                    <motion.li
                      key={task.id}
                      ref={registerTask(task.id)}
                      layout
                      className={cn(
                        "flex items-start gap-3.5 py-4 scroll-mt-24 transition-colors",
                        isFocused && !isDone && "bg-[#EEF2FF]/40 -mx-4 px-4 sm:-mx-5 sm:px-5 border-l-2 border-[#174CCF]",
                        isDone && "opacity-65"
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggle(task.id)}
                        role="checkbox"
                        aria-checked={isDone}
                        className={cn(
                          "focus-ring mt-0.5 grid size-6 shrink-0 place-items-center border transition cursor-pointer",
                          isDone
                            ? "border-[#41694A] bg-[#41694A] text-white"
                            : isFocused
                              ? "border-[#174CCF] bg-white text-transparent hover:border-[#174CCF]"
                              : "border-[#8B93A0] bg-white text-transparent hover:border-[#174CCF]"
                        )}
                      >
                        <Check
                          className={cn(
                            "size-3.5",
                            isDone ? "opacity-100" : "opacity-0"
                          )}
                          strokeWidth={3}
                        />
                      </button>

                      {/* Content */}
                      <div
                        onClick={() => setFocusedTaskId(task.id)}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span
                            className={cn(
                              "t-title text-base font-semibold transition select-none",
                              isDone
                                ? "text-[#5F6E66] line-through decoration-[#86A789] decoration-2"
                                : "text-ink hover:text-brand"
                            )}
                          >
                            {task.title}
                          </span>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteCustomTask(task.id);
                            }}
                            title="Delete personal task"
                            className="text-ink-soft hover:text-signal p-1 transition"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        {task.description && (
                          <p className="mt-1 t-body-sm text-sm text-ink-muted">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Official Roadmap Sections */}
          {filteredSections.map((section, secIdx) => {
            const original = sections.find(s => s.title === section.title);
            const doneCount =
              original?.tasks.filter(t => t.completed).length ?? 0;
            const totalSec = original?.tasks.length ?? 0;
            const isAllDone = totalSec > 0 && doneCount === totalSec;

            return (
              <section
                key={section.title}
                ref={registerSection(section.title)}
                className={cn(
                  "scroll-mt-6 border border-[#E0D9CC] bg-[#FFFCF6] overflow-hidden shadow-2xs transition-all",
                  isAllDone && "border-[#BBF7D0]"
                )}
              >
                {/* Section Header */}
                <div
                  className={cn(
                    "flex items-center justify-between border-b border-[#EAE3D7] px-4 sm:px-5 py-3.5",
                    isAllDone ? "bg-[#F0FDF4]" : "bg-[#FAF7F1]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center text-xs font-bold border t-num",
                        isAllDone
                          ? "border-[#41694A] bg-[#41694A] text-white"
                          : "border-[#174CCF] bg-[#EEF2FF] text-brand"
                      )}
                    >
                      {isAllDone ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : (
                        secIdx + 1
                      )}
                    </span>
                    <h2 className="t-subhead text-ink text-lg font-bold">
                      {section.title}
                    </h2>
                    {isAllDone && (
                      <span className="border border-[#BBF7D0] bg-[#DCFCE7] px-2 py-0.2 t-badge text-[#2B6A3B]">
                        Completed
                      </span>
                    )}
                  </div>

                  <span className="t-caption t-num font-semibold text-ink-muted">
                    {doneCount} of {totalSec} done
                  </span>
                </div>

                {/* Task List */}
                <ul className="divide-y divide-[#EFE9DE] px-4 sm:px-5">
                  {section.tasks.map(task => {
                    const isDone = task.completed;
                    const isBusy = pendingTasks.has(task.id);
                    const isFocused = focusedTaskId === task.id;
                    const isHigh =
                      task.priority?.toLowerCase() === "high" ||
                      task.priority?.toLowerCase() === "urgent";

                    return (
                      <motion.li
                        key={task.id}
                        ref={registerTask(task.id)}
                        layout
                        className={cn(
                          "group relative flex items-start gap-3.5 py-4.5 scroll-mt-24 transition-all",
                          isFocused && !isDone && "bg-[#EEF2FF]/40 -mx-4 px-4 sm:-mx-5 sm:px-5 border-l-3 border-[#174CCF]",
                          isDone && "opacity-65"
                        )}
                      >
                        {/* Checkbox with smooth animated tick */}
                        <button
                          type="button"
                          onClick={() => handleToggle(task.id)}
                          disabled={isBusy}
                          role="checkbox"
                          aria-checked={isDone}
                          aria-label={`Mark "${task.title}" as ${isDone ? "incomplete" : "complete"}`}
                          className={cn(
                            "focus-ring mt-0.5 grid size-6 shrink-0 place-items-center border transition cursor-pointer disabled:cursor-wait",
                            isDone
                              ? "border-[#41694A] bg-[#41694A] text-white"
                              : isFocused
                                ? "border-[#174CCF] bg-white text-transparent hover:border-[#174CCF] ring-2 ring-brand/15"
                                : "border-[#8B93A0] bg-white text-transparent hover:border-[#174CCF]"
                          )}
                        >
                          {isBusy ? (
                            <Loader2 className="size-3 animate-spin text-brand" />
                          ) : (
                            <Check
                              className={cn(
                                "size-3.5 transition-opacity",
                                isDone ? "opacity-100" : "opacity-0"
                              )}
                              strokeWidth={3}
                            />
                          )}
                        </button>

                        {/* Task Information */}
                        <div
                          onClick={() => setFocusedTaskId(task.id)}
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "t-title text-base font-semibold transition select-none",
                                  isDone
                                    ? "text-[#5F6E66] line-through decoration-[#86A789] decoration-2"
                                    : "text-ink hover:text-brand"
                                )}
                              >
                                {task.title}
                              </span>

                              {isHigh && !isDone && (
                                <span className="border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.2 t-badge text-[#B23F33]">
                                  Priority
                                </span>
                              )}
                              {isFocused && !isDone && (
                                <span className="border border-[#C7D7FE] bg-[#EEF2FF] px-1.5 py-0.2 t-badge text-brand">
                                  Current Focus
                                </span>
                              )}
                            </div>

                            {/* Ask ShefGuide Shortcut */}
                            <Link
                              href={`/chat?q=${encodeURIComponent(task.title)}`}
                              title="Ask ShefGuide about this step"
                              onClick={e => e.stopPropagation()}
                              className="focus-ring inline-flex shrink-0 items-center gap-1 border border-[#DCD4C7] bg-[#FAF7F1] px-2.5 py-1 t-caption font-semibold text-brand hover:bg-[#EEF2FF] hover:border-[#174CCF] transition"
                            >
                              <MessageCircle className="size-3.5" />
                              <span>Ask Guide</span>
                            </Link>
                          </div>

                          {task.description && (
                            <p
                              className={cn(
                                "mt-1.5 max-w-[75ch] text-pretty t-body-sm text-sm leading-relaxed",
                                isDone ? "text-[#717E77]" : "text-ink-muted"
                              )}
                            >
                              {task.description}
                            </p>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        {/* =========================================================================
            BOTTOM PEER ASSISTANCE BANNER
            ========================================================================= */}
        <footer className="border border-[#E0D9CC] bg-[#FAF7F1] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="t-title text-ink text-base font-semibold">
              Have questions about an arrival step?
            </h3>
            <p className="t-body-sm text-sm text-ink-muted">
              ShefGuide provides advice on visa compliance, GP registration, BRP
              collection, and university IT enrolment.
            </p>
          </div>
          <Link
            href="/chat"
            className="focus-ring inline-flex shrink-0 items-center gap-2 bg-[#174CCF] px-5 py-2.5 t-label text-white hover:bg-brand-deep transition shadow-xs"
          >
            <span>Ask ShefGuide</span>
            <ArrowRight className="size-4" />
          </Link>
        </footer>
      </main>
    </WorkspaceShell>
  );
}
