import { useTasksSync } from "./TasksContext";
import { useListsSync } from "./ListsContext";
import { useNotesSync } from "./NotesContext";
import { useCoursesSync } from "./CoursesContext";
import { useTodaySync } from "./TodayContext";

export type SyncState = "idle" | "syncing" | "synced" | "error";

export function useSyncStatus(): { status: SyncState; lastSynced: string | null } {
  const { syncStatus: taskSync, lastSynced: taskLast } = useTasksSync();
  const { syncStatus: listSync, lastSynced: listLast } = useListsSync();
  const { syncStatus: noteSync, lastSynced: noteLast } = useNotesSync();
  const { syncStatus: courseSync, lastSynced: courseLast } = useCoursesSync();
  const { syncStatus: todaySync, lastSynced: todayLast } = useTodaySync();

  const statuses = [taskSync, listSync, noteSync, courseSync, todaySync];
  const status: SyncState =
    statuses.includes("error")   ? "error" :
    statuses.includes("syncing") ? "syncing" :
    statuses.every(s => s === "synced") ? "synced" :
    "idle";

  const times = [taskLast, listLast, noteLast, courseLast, todayLast].filter(Boolean) as string[];
  const lastSynced = times.length > 0
    ? new Date(Math.max(...times.map(t => new Date(t).getTime()))).toISOString()
    : null;

  return { status, lastSynced };
}
