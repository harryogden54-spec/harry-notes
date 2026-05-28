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
  if (typeof text !== "string") return "";
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

// ─── Recurrence helpers ───────────────────────────────────────────────────────

/**
 * Recurrence DSL:
 *   "daily"       → every day
 *   "weekdays"    → Mon–Fri
 *   "weekly:N"    → every weekday N (0 = Sun … 6 = Sat)
 *   "interval:N"  → every N days
 */

export const RECURRENCE_PRESETS = [
  { value: "daily",      label: "Daily" },
  { value: "weekdays",   label: "Weekdays" },
  { value: "weekly:1",   label: "Every Monday" },
  { value: "weekly:2",   label: "Every Tuesday" },
  { value: "weekly:3",   label: "Every Wednesday" },
  { value: "weekly:4",   label: "Every Thursday" },
  { value: "weekly:5",   label: "Every Friday" },
  { value: "interval:2", label: "Every 2 days" },
  { value: "interval:14", label: "Every 2 weeks" },
] as const;

export function recurrenceLabel(r: string): string {
  const found = RECURRENCE_PRESETS.find(p => p.value === r);
  if (found) return found.label;
  if (r.startsWith("weekly:")) {
    const idx = parseInt(r.split(":")[1]);
    const names = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    return `Every ${names[idx] ?? "?"}`;
  }
  if (r.startsWith("interval:")) {
    const n = parseInt(r.split(":")[1]);
    return `Every ${n} days`;
  }
  return r;
}

/**
 * Advance a due date by one recurrence step.
 * Always returns a date strictly after `base` (or today if base is undefined).
 */
export function advanceByRecurrence(base: string | undefined, recurrence: string): string {
  const from = base ? new Date(base + "T00:00:00") : new Date();
  from.setHours(0, 0, 0, 0);

  function toStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  if (recurrence === "daily") {
    const d = new Date(from);
    d.setDate(d.getDate() + 1);
    return toStr(d);
  }

  if (recurrence === "weekdays") {
    const d = new Date(from);
    do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
    return toStr(d);
  }

  if (recurrence.startsWith("weekly:")) {
    const target = parseInt(recurrence.split(":")[1]);
    const d = new Date(from);
    let diff = (target - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // never same day — always next occurrence
    d.setDate(d.getDate() + diff);
    return toStr(d);
  }

  if (recurrence.startsWith("interval:")) {
    const n = parseInt(recurrence.split(":")[1]);
    const d = new Date(from);
    d.setDate(d.getDate() + n);
    return toStr(d);
  }

  // Fallback: tomorrow
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  return toStr(d);
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
