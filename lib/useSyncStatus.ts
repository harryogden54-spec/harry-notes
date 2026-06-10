import { useTasksSync } from "./TasksContext";
import { useListsSync } from "./ListsContext";
import { useNotesSync } from "./NotesContext";

export type SyncState = "idle" | "syncing" | "synced" | "error";

export function useSyncStatus(): { status: SyncState; lastSynced: string | null } {
  const { syncStatus: taskSync, lastSynced: taskLast } = useTasksSync();
  const { syncStatus: listSync, lastSynced: listLast } = useListsSync();
  const { syncStatus: noteSync, lastSynced: noteLast } = useNotesSync();

  const status: SyncState =
    taskSync === "error" || listSync === "error" || noteSync === "error" ? "error" :
    taskSync === "syncing" || listSync === "syncing" || noteSync === "syncing" ? "syncing" :
    taskSync === "synced" && listSync === "synced" && noteSync === "synced" ? "synced" :
    "idle";

  const times = [taskLast, listLast, noteLast].filter(Boolean) as string[];
  const lastSynced = times.length > 0
    ? new Date(Math.max(...times.map(t => new Date(t).getTime()))).toISOString()
    : null;

  return { status, lastSynced };
}
