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

export function useTaskStats() {
  const { tasks } = useTasks();
  const today = getTodayStr();

  const overdue   = tasks.filter(t => !t.done && !!t.due_date && t.due_date < today);
  const todayList = tasks.filter(t => !t.done && t.due_date === today);
  const upcoming  = tasks.filter(t => !t.done && !!t.due_date && t.due_date > today);
  const someday   = tasks.filter(t => !t.done && !t.due_date);
  const completed = tasks.filter(t => t.done);
  const completedThisWeek = tasks.filter(
    t => t.done && !!(t as any).completed_at && isThisWeek((t as any).completed_at),
  );

  return {
    overdue,
    today: todayList,
    upcoming,
    someday,
    completed,
    overdueCount:          overdue.length,
    todayCount:            todayList.length,
    upcomingCount:         upcoming.length,
    somedayCount:          someday.length,
    completedCount:        completed.length,
    completedThisWeek,
    completedThisWeekCount: completedThisWeek.length,
  };
}
