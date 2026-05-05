import { useTasks } from "./TasksContext";
import { useLists } from "./ListsContext";
import { useNotes } from "./NotesContext";

export type SyncState = "idle" | "syncing" | "synced" | "error";

export function useSyncStatus(): { status: SyncState; lastSynced: string | null } {
  const { syncStatus: taskSync, lastSynced: taskLast } = useTasks();
  const { syncStatus: listSync, lastSynced: listLast } = useLists();
  const { syncStatus: noteSync, lastSynced: noteLast } = useNotes();

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
