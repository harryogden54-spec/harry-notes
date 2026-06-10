import React, { createContext, useContext, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { storage } from "./storage";
import { syncDelete } from "./supabase";
import { dbLoadTasks, dbSaveTasks } from "./db";
import { useSyncedCollection, type SyncStatus } from "./useSyncedCollection";
import { advanceByRecurrence } from "./utils";

export type Priority   = "urgent" | "high" | "medium" | "low";
export type TaskCategory = "personal" | "uni";

export const UNI_COURSES = [
  "Misc",
  "Engineering Maths 2B",
  "Construction and Surveying",
  "Fire Science and Engineering",
  "Civil Engineering Design",
  "Materials 2",
  "Environmental and Sustainability",
] as const;
export type UniCourse = typeof UNI_COURSES[number];

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

export type Task = {
  id: string;
  title: string;
  done: boolean;
  archived?: boolean;
  due_date?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  subtasks?: Subtask[];
  category?: TaskCategory;
  uniCourse?: UniCourse;
  recurrence?: string;
};

// Split into three contexts so consumers subscribe only to what they use:
// data changes on every mutation, sync status churns around every sync, and
// actions never change. Bundling them re-rendered every consumer on all three.
type TasksData = {
  tasks: Task[];
  loaded: boolean;
};

type TasksSync = {
  syncStatus: SyncStatus;
  lastSynced: string | null;
  syncNow: () => Promise<void>;
};

type TasksActions = {
  addTask: (title: string, due_date?: string) => string;
  updateTask: (id: string, updates: Partial<Omit<Task, "id" | "created_at">>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => () => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  reorderTask: (id: string, direction: "up" | "down") => void;
  setSectionOrder: (reorderedSection: Task[]) => void;
  clearCompleted: () => void;
};

const TasksDataContext    = createContext<TasksData | null>(null);
const TasksSyncContext    = createContext<TasksSync | null>(null);
const TasksActionsContext = createContext<TasksActions | null>(null);

function stamp(task: Task): Task {
  return { ...task, updated_at: new Date().toISOString() };
}

const EPOCH = new Date(0).toISOString();

/**
 * Coerce a possibly-malformed task into a well-formed one. Rows synced from
 * another client, partially-written records, or older schema versions may be
 * missing `title`/`created_at` (or have them as null), which crashes every
 * screen that calls `task.title.toLowerCase()` / `.localeCompare()` or sorts by
 * date. Normalising once on load and on every remote merge guarantees those
 * fields are always the right type.
 */
function normalizeTask(t: Task): Task {
  const created = typeof t.created_at === "string" && t.created_at ? t.created_at : EPOCH;
  return {
    ...t,
    title:      typeof t.title === "string" ? t.title : "",
    done:       !!t.done,
    created_at: created,
    subtasks:   Array.isArray(t.subtasks) ? t.subtasks : [],
    tags:       Array.isArray(t.tags) ? t.tags : [],
  };
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const {
    items: tasks, setItems: setTasks, loaded, syncStatus, lastSynced,
    itemsRef: tasksRef, pendingDeletesRef, dirtyIdsRef,
    markDirty, syncNow,
  } = useSyncedCollection<Task>({
    table: "tasks",
    storageKey: "tasks",
    loadLocal: async () => {
      if (Platform.OS !== "web") {
        // Re-throw on DB error: the caller (useSyncedCollection) will surface
        // syncStatus:"error" and mark the app as loaded. Silently falling back
        // to AsyncStorage on a DB throw would overwrite real data with a
        // potentially-stale mirror and is extremely hard to debug.
        const dbTasks = await dbLoadTasks() as Task[];
        if (dbTasks.length > 0) return dbTasks.map(normalizeTask);
        // DB returned 0 rows — migrate from AsyncStorage on first install.
        const stored = await storage.get<Task[]>("tasks") ?? [];
        if (stored.length > 0) await dbSaveTasks(stored);
        return stored.map(normalizeTask);
      }
      return (await storage.get<Task[]>("tasks") ?? []).map(normalizeTask);
    },
    saveLocal: (items) => {
      if (Platform.OS !== "web") dbSaveTasks(items).catch(console.error);
    },
    // Auto-archive tasks completed 7+ days ago on initial load.
    // Use completed_at + 7 days as updated_at so a real archive event on
    // another device (with a later timestamp) always wins in LWW merge.
    onLoad: (items) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffStr = cutoff.toISOString();
      const dirty: string[] = [];
      const updated = items.map(t => {
        if (t.done && !t.archived && t.completed_at && t.completed_at < cutoffStr) {
          dirty.push(t.id);
          const archiveAt = new Date(t.completed_at);
          archiveAt.setDate(archiveAt.getDate() + 7);
          return { ...t, archived: true, updated_at: archiveAt.toISOString() };
        }
        return t;
      });
      return { items: updated, dirty };
    },
    // Coerce remote rows — older rows may be missing title/created_at/arrays.
    normalizeRemote: (row) => normalizeTask(row),
    // Never un-archive a locally-archived task when remote wins.
    mergeRow: (local, remote) => ({ ...remote, archived: remote.archived ?? local.archived }),
  });

  const addTask = useCallback((title: string, due_date?: string): string => {
    const id  = newId();
    const now = new Date().toISOString();
    markDirty(id);
    setTasks(prev => [...prev, stamp({ id, title, done: false, due_date, created_at: now, subtasks: [], tags: [] })]);
    return id;
  }, [markDirty, setTasks]);

  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, "id" | "created_at">>) => {
    markDirty(id);
    setTasks(prev => prev.map(t => t.id === id ? stamp({ ...t, ...updates }) : t));
  }, [markDirty, setTasks]);

  const toggleTask = useCallback((id: string) => {
    markDirty(id);
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (!task) return prev;
      const done = !task.done;
      const updated = prev.map(t =>
        t.id === id ? stamp({ ...t, done, completed_at: done ? new Date().toISOString() : undefined }) : t
      );
      // Spawn next instance when completing a recurring task
      if (done && task.recurrence) {
        const nextId  = newId();
        const nextDue = advanceByRecurrence(task.due_date, task.recurrence);
        const now     = new Date().toISOString();
        const next: Task = stamp({
          id: nextId,
          title: task.title,
          done: false,
          due_date: nextDue,
          priority: task.priority,
          category: task.category,
          uniCourse: task.uniCourse,
          description: task.description,
          subtasks: [],
          tags: task.tags ?? [],
          recurrence: task.recurrence,
          created_at: now,
        });
        markDirty(nextId);
        return [...updated, next];
      }
      return updated;
    });
  }, [markDirty, setTasks]);

  const archiveTask = useCallback((id: string) => {
    markDirty(id);
    setTasks(prev => prev.map(t => t.id === id ? stamp({ ...t, archived: true }) : t));
  }, [markDirty, setTasks]);

  const unarchiveTask = useCallback((id: string) => {
    markDirty(id);
    setTasks(prev => prev.map(t => t.id === id ? stamp({ ...t, archived: false }) : t));
  }, [markDirty, setTasks]);

  const deleteTask = useCallback((id: string): (() => void) => {
    const deleted = tasksRef.current.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    pendingDeletesRef.current.add(id);
    dirtyIdsRef.current.delete(id);
    const timer = setTimeout(() => {
      syncDelete("tasks", id);
      pendingDeletesRef.current.delete(id);
    }, 3000);
    return () => {
      clearTimeout(timer);
      pendingDeletesRef.current.delete(id);
      if (deleted) {
        markDirty(id);
        setTasks(prev => [...prev, deleted]);
      }
    };
  }, [tasksRef, pendingDeletesRef, dirtyIdsRef, markDirty, setTasks]);

  const reorderTask = useCallback((id: string, direction: "up" | "down") => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }, [setTasks]);

  const setSectionOrder = useCallback((reorderedSection: Task[]) => {
    setTasks(prev => {
      const ids     = new Set(reorderedSection.map(t => t.id));
      const indices = prev.reduce<number[]>((acc, t, i) => ids.has(t.id) ? [...acc, i] : acc, []);
      const result  = [...prev];
      indices.forEach((idx, i) => { result[idx] = reorderedSection[i]; });
      return result;
    });
  }, [setTasks]);

  const clearCompleted = useCallback(() => {
    const toArchive = tasksRef.current
      .filter(t => t.done && !t.archived)
      .map(t => stamp({ ...t, archived: true }));
    if (toArchive.length === 0) return;
    const archivedIds = new Set(toArchive.map(t => t.id));
    const archivedMap = new Map(toArchive.map(t => [t.id, t]));
    for (const id of archivedIds) markDirty(id);
    setTasks(prev => prev.map(t => archivedIds.has(t.id) ? archivedMap.get(t.id)! : t));
  }, [tasksRef, markDirty, setTasks]);

  const dataValue = useMemo(() => ({ tasks, loaded }), [tasks, loaded]);
  const syncValue = useMemo(
    () => ({ syncStatus, lastSynced, syncNow }),
    [syncStatus, lastSynced, syncNow]
  );
  // Every action is a useCallback over stable refs, so this object never changes.
  const actionsValue = useMemo(
    () => ({
      addTask, updateTask, toggleTask, deleteTask, archiveTask, unarchiveTask,
      reorderTask, setSectionOrder, clearCompleted,
    }),
    [addTask, updateTask, toggleTask, deleteTask, archiveTask, unarchiveTask,
     reorderTask, setSectionOrder, clearCompleted]
  );

  return (
    <TasksDataContext.Provider value={dataValue}>
      <TasksSyncContext.Provider value={syncValue}>
        <TasksActionsContext.Provider value={actionsValue}>
          {children}
        </TasksActionsContext.Provider>
      </TasksSyncContext.Provider>
    </TasksDataContext.Provider>
  );
}

export function useTasksData(): TasksData {
  const ctx = useContext(TasksDataContext);
  if (!ctx) throw new Error("useTasksData must be used within TasksProvider");
  return ctx;
}

export function useTasksSync(): TasksSync {
  const ctx = useContext(TasksSyncContext);
  if (!ctx) throw new Error("useTasksSync must be used within TasksProvider");
  return ctx;
}

export function useTasksActions(): TasksActions {
  const ctx = useContext(TasksActionsContext);
  if (!ctx) throw new Error("useTasksActions must be used within TasksProvider");
  return ctx;
}

/**
 * @deprecated Compatibility alias — subscribes to all three contexts, so it
 * re-renders on every data AND sync change. Prefer useTasksData /
 * useTasksActions / useTasksSync.
 */
export function useTasks(): TasksData & TasksSync & TasksActions {
  const data    = useTasksData();
  const sync    = useTasksSync();
  const actions = useTasksActions();
  return useMemo(() => ({ ...data, ...sync, ...actions }), [data, sync, actions]);
}
