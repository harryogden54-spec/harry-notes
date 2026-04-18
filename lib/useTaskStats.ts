import { useTasks } from "./TasksContext";
import { getTodayStr } from "./utils";

function isThisWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now  = new Date();
  // Monday of this week
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  // Sunday of this week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return date >= monday && date <= sunday;
}

/** Returns an array of 7 completion counts: [6 days ago, …, today] */
function buildSparkline(completedAts: (string | undefined)[]): number[] {
  const counts = Array(7).fill(0);
  const now = new Date();
  for (const raw of completedAts) {
    if (!raw) continue;
    const diff = Math.floor((now.getTime() - new Date(raw).getTime()) / 86_400_000);
    if (diff >= 0 && diff < 7) counts[6 - diff]++;
  }
  return counts;
}

/** Current consecutive-day streak (days ending today where ≥1 task was completed) */
function calcStreak(completedAts: (string | undefined)[]): number {
  const daySet = new Set<string>();
  for (const raw of completedAts) {
    if (!raw) continue;
    daySet.add(new Date(raw).toISOString().slice(0, 10));
  }
  const today = getTodayStr();
  let streak = 0;
  let cursor = new Date(today);
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!daySet.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function useTaskStats() {
  const { tasks } = useTasks();
  const today = getTodayStr();

  const overdue   = tasks.filter(t => !t.done && !!t.due_date && t.due_date < today);
  const todayList = tasks.filter(t => !t.done && t.due_date === today);
  const upcoming  = tasks.filter(t => !t.done && !!t.due_date && t.due_date > today);
  const someday   = tasks.filter(t => !t.done && !t.due_date);
  const completed = tasks.filter(t => t.done);
  const completedThisWeek = tasks.filter(
    t => t.done && !!t.completed_at && isThisWeek(t.completed_at),
  );

  const sparkline = buildSparkline(tasks.filter(t => t.done).map(t => t.completed_at));
  const streak    = calcStreak(tasks.filter(t => t.done).map(t => t.completed_at));

  return {
    overdue,
    today: todayList,
    upcoming,
    someday,
    completed,
    overdueCount:           overdue.length,
    todayCount:             todayList.length,
    upcomingCount:          upcoming.length,
    somedayCount:           someday.length,
    completedCount:         completed.length,
    completedThisWeek,
    completedThisWeekCount: completedThisWeek.length,
    sparkline,
    streak,
  };
}
