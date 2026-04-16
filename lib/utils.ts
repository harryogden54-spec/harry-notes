import type { Priority } from "./TasksContext";

export function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function formatDueDate(
  date: string,
  today: string,
  tomorrow: string,
  dangerColor: string,
  accentColor: string,
): { label: string; color: string } {
  if (date < today)      return { label: "Overdue",  color: dangerColor };
  if (date === today)    return { label: "Today",    color: accentColor };
  if (date === tomorrow) return { label: "Tomorrow", color: "#5B6AD0" };
  return {
    label: new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    color: "#9A9A9A",
  };
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^---+$/gm, "")
    .trim();
}

export const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "#F26464",
  high:   "#F5A623",
  medium: "#E8C84A",
  low:    "#5B6AD0",
};
