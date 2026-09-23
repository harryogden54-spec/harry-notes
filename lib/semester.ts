import type { AccentId } from "./theme";
import { getLocalDateStr } from "./utils";

/**
 * The current semester: courses, the weekly timetable, and the tracker columns
 * each course carries. Deliberately static — a semester is set once, in
 * September, and changing it is a code edit rather than a settings screen.
 *
 * Only the ticks are user data. They live in the synced `courses` collection as
 * one CourseTable per course (see `trackerTableId` / CoursesContext), so they
 * ride the existing sync engine with no migration.
 */

/** Scopes every stored tracker id, so next semester starts clean rather than
 *  inheriting this one's ticks. Bump it when the config below is replaced. */
export const TERM_ID = "2026-s1";

/** Monday of teaching week 1. Week 0 (welcome week) is the Monday before. */
const WEEK1_MONDAY = "2026-09-21";
export const FIRST_WEEK = 0;
export const LAST_WEEK  = 11;
/** Weeks the timetable runs. Week 0 has no classes — it exists for tracking. */
const TEACHING_FIRST_WEEK = 1;

export type CourseKey = "structures" | "water" | "transport" | "design";
export type TrackerItemKey = "lecture" | "notes" | "flashcards" | "questions";

export type TrackerItem = {
  key: TrackerItemKey;
  /** Full label — sheet rows, accessibility names. */
  label: string;
  /** Column header in the tracker table. */
  short: string;
  /** Word used in a generated task title: "Structural week 4 flashcards". */
  taskWord: string;
};

export const TRACKER_ITEMS: Record<TrackerItemKey, TrackerItem> = {
  lecture:    { key: "lecture",    label: "Lecture attended",  short: "Lecture", taskWord: "lecture" },
  notes:      { key: "notes",      label: "Notes / catch-up",  short: "Notes",   taskWord: "notes" },
  flashcards: { key: "flashcards", label: "Flashcards made",   short: "Cards",   taskWord: "flashcards" },
  questions:  { key: "questions",  label: "Weekly questions",  short: "Qs",      taskWord: "questions" },
};

export type SemesterCourse = {
  key: CourseKey;
  name: string;
  /** Used in task titles, timetable blocks on a phone, and the dashboard. */
  short: string;
  /** Timetable block on a phone, where a day column is ~45px of text. */
  abbr: string;
  /** Identity colour — a key into ACCENT_OPTIONS, resolved per scheme. */
  accent: AccentId;
  items: TrackerItemKey[];
  /** Case-insensitive fragments that identify an existing task subcategory
   *  as this course, so "Make a task" files under the one you already have. */
  categoryMatch: string[];
};

export const SEMESTER_COURSES: SemesterCourse[] = [
  {
    key: "structures", abbr: "Struct", name: "Structural Analysis", short: "Structural", accent: "brick",
    items: ["lecture", "notes", "flashcards", "questions"], categoryMatch: ["struct"],
  },
  {
    key: "water", abbr: "Water", name: "Water Engineering", short: "Water", accent: "harbour",
    items: ["lecture", "notes", "flashcards", "questions"], categoryMatch: ["water"],
  },
  {
    key: "transport", abbr: "Transp", name: "Transport Engineering", short: "Transport", accent: "jade",
    items: ["lecture", "notes", "flashcards"], categoryMatch: ["transport"],
  },
  {
    key: "design", abbr: "Design", name: "Conceptual Design", short: "Design", accent: "olive",
    items: ["lecture", "notes"], categoryMatch: ["conceptual"],
  },
];

export function courseByKey(key: CourseKey): SemesterCourse {
  return SEMESTER_COURSES.find(c => c.key === key)!;
}

export type Session = {
  course: CourseKey;
  kind: "Lecture" | "Seminar";
  /** 1 = Monday … 5 = Friday. */
  day: 1 | 2 | 3 | 4 | 5;
  /** "HH:MM", 24h. */
  start: string;
  end: string;
  location: string;
};

/** The weekly timetable, identical in every teaching week. */
export const SESSIONS: Session[] = [
  { course: "structures", kind: "Lecture", day: 1, start: "10:00", end: "12:00", location: "Sanderson · Classroom 3" },
  { course: "water",      kind: "Lecture", day: 2, start: "14:10", end: "16:00", location: "JCMB · Lecture Theatre B" },
  { course: "structures", kind: "Lecture", day: 3, start: "09:00", end: "10:50", location: "Sanderson · Classroom 3" },
  { course: "transport",  kind: "Lecture", day: 3, start: "11:10", end: "13:00", location: "Nucleus · 2.07 Yew Lecture Theatre" },
  { course: "structures", kind: "Seminar", day: 4, start: "12:10", end: "13:00", location: "Sanderson · Classroom 3" },
  { course: "design",     kind: "Seminar", day: 5, start: "09:00", end: "12:00", location: "Alrick · TLC" },
  { course: "transport",  kind: "Seminar", day: 5, start: "13:10", end: "14:00", location: "Sanderson · Lecture Theatre 1" },
  { course: "water",      kind: "Lecture", day: 5, start: "14:10", end: "16:00", location: "Ashworth Labs · Lecture Theatre 3" },
];

/** First and last hour the timetable grid draws. */
export const GRID_START_HOUR = 9;
export const GRID_END_HOUR   = 16;

// ─── Weeks ────────────────────────────────────────────────────────────────────

export const WEEKS: number[] = Array.from({ length: LAST_WEEK - FIRST_WEEK + 1 }, (_, i) => FIRST_WEEK + i);

function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Monday of the given week, as a local Date at midnight. */
export function weekMonday(week: number): Date {
  return addDays(parseLocal(WEEK1_MONDAY), (week - 1) * 7);
}

/** The date of `day` (1 = Mon) in `week`, as YYYY-MM-DD. */
export function sessionDate(week: number, day: number): string {
  return getLocalDateStr(addDays(weekMonday(week), day - 1));
}

/**
 * The semester week containing `date`, or null outside weeks 0–11. Whole-day
 * arithmetic on local midnights, so a DST change mid-semester (25 Oct) cannot
 * shift the boundary by an hour into the wrong week.
 */
export function weekOf(date: Date = new Date()): number | null {
  const today = parseLocal(getLocalDateStr(date));
  const days = Math.round((today.getTime() - weekMonday(FIRST_WEEK).getTime()) / 86_400_000);
  const week = FIRST_WEEK + Math.floor(days / 7);
  return week >= FIRST_WEEK && week <= LAST_WEEK ? week : null;
}

/** The week to open on: this week during the semester, else the nearest end. */
export function defaultWeek(date: Date = new Date()): number {
  const w = weekOf(date);
  if (w !== null) return w;
  return date < weekMonday(FIRST_WEEK) ? FIRST_WEEK : LAST_WEEK;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "21 Sep" */
export function shortDate(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/** "21–27 Sep" / "28 Sep – 4 Oct" */
export function weekRangeLabel(week: number): string {
  const mon = weekMonday(week);
  const sun = addDays(mon, 6);
  return mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${SHORT_MONTHS[sun.getMonth()]}`
    : `${shortDate(mon)} – ${shortDate(sun)}`;
}

export function isTeachingWeek(week: number): boolean {
  return week >= TEACHING_FIRST_WEEK && week <= LAST_WEEK;
}

export function sessionsForWeek(week: number): Session[] {
  return isTeachingWeek(week) ? SESSIONS : [];
}

export function sessionsFor(course: CourseKey, week: number): Session[] {
  return sessionsForWeek(week).filter(s => s.course === course);
}

/** Due date for a task generated from a week's tracker: that week's Sunday,
 *  or today if the week is already over (it is catch-up, due now). */
export function taskDueDate(week: number, now: Date = new Date()): string {
  const sunday = getLocalDateStr(addDays(weekMonday(week), 6));
  const today  = getLocalDateStr(now);
  return sunday < today ? today : sunday;
}

// ─── Upcoming sessions (dashboard "Coming up") ────────────────────────────────

export type Occurrence = Session & { week: number; date: string; startsAt: Date; endsAt: Date };

function atTime(date: string, hhmm: string): Date {
  const d = parseLocal(date);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * The next `limit` classes that have not yet ended, in time order — a class in
 * progress counts as upcoming, since that is when you most need its room.
 */
export function upcomingSessions(now: Date = new Date(), limit = 3): Occurrence[] {
  const out: Occurrence[] = [];
  const startWeek = Math.max(TEACHING_FIRST_WEEK, weekOf(now) ?? (now < weekMonday(FIRST_WEEK) ? FIRST_WEEK : LAST_WEEK + 1));
  for (let week = startWeek; week <= LAST_WEEK && out.length < limit; week++) {
    const occ = SESSIONS
      .map(s => {
        const date = sessionDate(week, s.day);
        return { ...s, week, date, startsAt: atTime(date, s.start), endsAt: atTime(date, s.end) };
      })
      .filter(o => o.endsAt > now)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    out.push(...occ.slice(0, limit - out.length));
  }
  return out;
}

/** "9:00" / "14:10" → "9am" / "2:10pm" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// ─── Tracker storage ids ──────────────────────────────────────────────────────

/**
 * Deterministic, so two devices that each tick something before they have
 * synced write to the same row instead of creating two tables for one course.
 */
export function trackerTableId(course: CourseKey): string {
  return `sem-${TERM_ID}-${course}`;
}

export function weekRowId(week: number): string {
  return `w${week}`;
}

/** Stamped on a generated task so the tracker can find it again. */
export function courseRef(course: CourseKey, week: number, item: TrackerItemKey): string {
  return `${TERM_ID}:${course}:${week}:${item}`;
}

export function taskTitle(course: CourseKey, week: number, item: TrackerItemKey): string {
  return `${courseByKey(course).short} week ${week} ${TRACKER_ITEMS[item].taskWord}`;
}
