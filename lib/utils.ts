import type { Priority } from "./TasksContext";

/**
 * Format a Date as YYYY-MM-DD using the device's LOCAL timezone.
 * Never use `toISOString().slice(0, 10)` for date keys — that returns UTC,
 * which drifts ahead by a day for users in UTC+ timezones after midnight local.
 */
export function getLocalDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getTodayStr(): string {
  return getLocalDateStr();
}

export function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return getLocalDateStr(d);
}

export function getNextWeekStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return getLocalDateStr(d);
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

/**
 * Parse a natural-language date fragment from a task title.
 * Returns the ISO date string and the title with the date phrase stripped.
 */
export function parseNaturalDate(input: string): { date: string | null; cleanText: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function toStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function shiftDays(n: number): string {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return toStr(d);
  }

  function nextWeekday(idx: number, forceNext = false): string {
    const d = new Date(today);
    let diff = (idx - d.getDay() + 7) % 7;
    if (diff === 0 || forceNext) diff += 7;
    d.setDate(d.getDate() + diff);
    return toStr(d);
  }

  const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  let m: RegExpMatchArray | null;

  if ((m = input.match(/\btoday\b/i)))
    return { date: shiftDays(0), cleanText: input.replace(m[0], "").replace(/\s{2,}/g, " ").trim() };
  if ((m = input.match(/\b(tomorrow|tmrw|tmr)\b/i)))
    return { date: shiftDays(1), cleanText: input.replace(m[0], "").replace(/\s{2,}/g, " ").trim() };
  if ((m = input.match(/\bin (\d+) weeks?\b/i)))
    return { date: shiftDays(parseInt(m[1]) * 7), cleanText: input.replace(m[0], "").replace(/\s{2,}/g, " ").trim() };
  if ((m = input.match(/\bin (\d+) days?\b/i)))
    return { date: shiftDays(parseInt(m[1])), cleanText: input.replace(m[0], "").replace(/\s{2,}/g, " ").trim() };
  if ((m = input.match(/\bnext week\b/i)))
    return { date: shiftDays(7), cleanText: input.replace(m[0], "").replace(/\s{2,}/g, " ").trim() };

  for (let i = 0; i < DAYS.length; i++) {
    if ((m = input.match(new RegExp(`\\bnext ${DAYS[i]}\\b`, "i"))))
      return { date: nextWeekday(i, true), cleanText: input.replace(m[0], "").replace(/\s{2,}/g, " ").trim() };
  }
  for (let i = 0; i < DAYS.length; i++) {
    if ((m = input.match(new RegExp(`\\b${DAYS[i]}\\b`, "i"))))
      return { date: nextWeekday(i), cleanText: input.replace(m[0], "").replace(/\s{2,}/g, " ").trim() };
  }

  return { date: null, cleanText: input };
}

export const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "#E05252",
  high:   "#E8874A",
  medium: "#7AB0D9",
  low:    "#8ABF7A",
};

export const DAY_NAMES   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;
export const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"] as const;

/** "Monday, 22 May" style header date using local timezone. */
export function formatHeaderDate(d: Date = new Date()): string {
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}
