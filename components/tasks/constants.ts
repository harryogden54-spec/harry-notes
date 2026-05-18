import { PRIORITY_COLOR, getTodayStr, getTomorrowStr } from "@/lib/utils";
import type { Task, Priority } from "@/lib/TasksContext";

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: PRIORITY_COLOR.urgent },
  high:   { label: "High",   color: PRIORITY_COLOR.high },
  medium: { label: "Medium", color: PRIORITY_COLOR.medium },
  low:    { label: "Low",    color: PRIORITY_COLOR.low },
};
export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low"];

export type SortBy = "priority" | "due_date" | "title" | "created";

export function formatDate(date: string) {
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();
  if (date === today)    return "Today";
  if (date === tomorrow) return "Tomorrow";
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function isOverdue(t: Task)   { return !t.done && !!t.due_date && t.due_date < getTodayStr(); }
export function isToday(t: Task)     { return !t.done && t.due_date === getTodayStr(); }
export function isScheduled(t: Task) { return !t.done && !!t.due_date && t.due_date > getTodayStr(); }
export function isSomeday(t: Task)   { return !t.done && !t.due_date; }

export function sortByPriority(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const ai = a.priority ? PRIORITY_ORDER.indexOf(a.priority) : 99;
    const bi = b.priority ? PRIORITY_ORDER.indexOf(b.priority) : 99;
    return ai - bi;
  });
}

export function applySort(tasks: Task[], by: SortBy): Task[] {
  if (by === "priority") return sortByPriority(tasks);
  if (by === "due_date") return [...tasks].sort((a, b) => (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : 1);
  if (by === "title")    return [...tasks].sort((a, b) => a.title.localeCompare(b.title));
  return [...tasks];
}

export function matchesSearch(task: Task, q: string) {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    task.title.toLowerCase().includes(lower) ||
    (task.description?.toLowerCase().includes(lower) ?? false)
  );
}
