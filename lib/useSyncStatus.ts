import { useCallback } from "react";
import { useTasksSync } from "./TasksContext";
import { useNotesSync } from "./NotesContext";
import { useCoursesSync } from "./CoursesContext";
import { useTodaySync } from "./TodayContext";
import { useDumpsSync } from "./DumpContext";
import { useCategoriesSync } from "./TaskCategoriesContext";

export type SyncState = "idle" | "syncing" | "synced" | "error";

export type SyncDomain = {
  /** Display name — used by the Settings per-collection breakdown. */
  label: string;
  status: SyncState;
  lastSynced: string | null;
};

/**
 * Aggregate sync state across **every** synced domain, plus the one manual
 * trigger. Every caller (header chip, Settings) must go through here: a
 * hand-rolled subset silently under-reports, which is exactly what happened
 * before — Dumps and TaskCategories were missing, so the header could read
 * "synced" while dumps were erroring.
 */
export function useSyncDomains(): SyncDomain[] {
  const tasks      = useTasksSync();
  const notes      = useNotesSync();
  const dumps      = useDumpsSync();
  const courses    = useCoursesSync();
  const categories = useCategoriesSync();
  const today      = useTodaySync();

  return [
    { label: "Tasks",      status: tasks.syncStatus,      lastSynced: tasks.lastSynced },
    { label: "Notes",      status: notes.syncStatus,      lastSynced: notes.lastSynced },
    { label: "Dumps",      status: dumps.syncStatus,      lastSynced: dumps.lastSynced },
    { label: "Courses",    status: courses.syncStatus,    lastSynced: courses.lastSynced },
    { label: "Categories", status: categories.syncStatus, lastSynced: categories.lastSynced },
    { label: "Today",      status: today.syncStatus,      lastSynced: today.lastSynced },
  ];
}

function rollUp(domains: SyncDomain[]): { status: SyncState; lastSynced: string | null } {
  const statuses = domains.map(d => d.status);
  const status: SyncState =
    statuses.includes("error")   ? "error" :
    statuses.includes("syncing") ? "syncing" :
    statuses.every(s => s === "synced") ? "synced" :
    "idle";

  const times = domains.map(d => d.lastSynced).filter(Boolean) as string[];
  const lastSynced = times.length > 0
    ? new Date(Math.max(...times.map(t => new Date(t).getTime()))).toISOString()
    : null;

  return { status, lastSynced };
}

/**
 * Rolled-up state plus the single manual-sync entry point.
 *
 * `syncAll` is the reconciliation path: a full fetch per domain, ignoring the
 * delta cursor, so it can repair divergence the incremental sync missed.
 * Resolves false if any domain failed, so callers can report honestly instead
 * of claiming success.
 */
export function useSyncAll(): {
  status: SyncState;
  lastSynced: string | null;
  domains: SyncDomain[];
  syncAll: () => Promise<boolean>;
} {
  const domains = useSyncDomains();
  const { syncNow: syncTasks }      = useTasksSync();
  const { syncNow: syncNotes }      = useNotesSync();
  const { syncNow: syncDumps }      = useDumpsSync();
  const { syncNow: syncCourses }    = useCoursesSync();
  const { syncNow: syncCategories } = useCategoriesSync();
  const { syncNow: syncToday }      = useTodaySync();

  const syncAll = useCallback(async () => {
    const results = await Promise.all([
      syncTasks({ full: true }), syncNotes({ full: true }),
      syncDumps({ full: true }), syncCourses({ full: true }),
      syncCategories({ full: true }), syncToday({ full: true }),
    ]);
    return results.every(Boolean);
  }, [syncTasks, syncNotes, syncDumps, syncCourses, syncCategories, syncToday]);

  return { ...rollUp(domains), domains, syncAll };
}
