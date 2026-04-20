import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { storage } from "./storage";
import { syncFetch, syncUpsert, syncDelete } from "./supabase";
import { dbLoadTasks, dbSaveTasks } from "./db";

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
};

type SyncStatus = "idle" | "syncing" | "synced" | "error";

type TasksContextValue = {
  tasks: Task[];
  loaded: boolean;
  syncStatus: SyncStatus;
  lastSynced: string | null;
  addTask: (title: string, due_date?: string) => string;
  updateTask: (id: string, updates: Partial<Omit<Task, "id" | "created_at">>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => () => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  reorderTask: (id: string, direction: "up" | "down") => void;
  setSectionOrder: (reorderedSection: Task[]) => void;
  clearCompleted: () => void;
  syncNow: () => Promise<void>;
};

const TasksContext = createContext<TasksContextValue | null>(null);

function stamp(task: Task): Task {
  return { ...task, updated_at: new Date().toISOString() };
}

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const loadedRef      = useRef(false);
  const tasksRef       = useRef<Task[]>([]);
  const syncDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedRef  = useRef<string | null>(null);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { lastSyncedRef.current = lastSynced; }, [lastSynced]);

  // Persist locally on every change + debounced push to Supabase
  useEffect(() => {
    if (!loadedRef.current) return;
    storage.set("tasks", tasks);
    if (Platform.OS !== "web") dbSaveTasks(tasks).catch(console.error);

    // Debounce Supabase upsert so rapid mutations (e.g. toggling many tasks)
    // are batched into a single network call after 1.5 s of quiet.
    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    syncDebounce.current = setTimeout(() => {
      const snapshot = tasksRef.current;
      if (snapshot.length === 0) return;
      // Only push tasks that were locally mutated after the last successful sync.
      // This prevents a pull (setTasks from syncNow) from echoing remote data
      // back to Supabase with a bumped updated_at, which would cause false conflicts.
      const cutoff = lastSyncedRef.current;
      const dirty = cutoff
        ? snapshot.filter(t => (t.updated_at ?? t.created_at) > cutoff)
        : snapshot;
      if (dirty.length === 0) return;
      syncUpsert("tasks", dirty).catch(console.warn);
    }, 1500);
  }, [tasks]);

  useEffect(() => {
    const loadLocal = async (): Promise<Task[]> => {
      if (Platform.OS !== "web") {
        try {
          const dbTasks = await dbLoadTasks() as Task[];
          if (dbTasks.length > 0) return dbTasks;
          // SQLite empty — migrate from AsyncStorage
          const stored = await storage.get<Task[]>("tasks") ?? [];
          if (stored.length > 0) dbSaveTasks(stored).catch(console.error);
          return stored;
        } catch {
          // SQLite unavailable — fall back
        }
      }
      return await storage.get<Task[]>("tasks") ?? [];
    };

    loadLocal().then(async (local) => {
      // Auto-archive tasks completed 7+ days ago
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffStr = cutoff.toISOString();
      const localTasks = local.map(t =>
        t.done && !t.archived && t.completed_at && t.completed_at < cutoffStr
          ? { ...t, archived: true }
          : t
      );
      setTasks(localTasks);
      loadedRef.current = true;
      setLoaded(true);

      setSyncStatus("syncing");
      try {
        const remote = await syncFetch<Task & { _updated_at: string }>("tasks");
        if (remote.length === 0 && localTasks.length > 0) {
          await syncUpsert("tasks", localTasks);
          setSyncStatus("synced");
          setLastSynced(new Date().toISOString());
          return;
        }
        const remoteMap = new Map(remote.map(r => [r.id, r]));
        const merged = await new Promise<Task[]>(resolve => {
          setTasks(prev => {
            const result = [...prev];
            for (const rem of remote) {
              const idx = result.findIndex(t => t.id === rem.id);
              if (idx === -1) {
                result.push(rem);
              } else {
                const localUpdated  = result[idx].updated_at ?? result[idx].created_at;
                const remoteUpdated = (rem as any)._updated_at ?? rem.updated_at ?? "";
                if (remoteUpdated > localUpdated) {
                  // Remote wins — but never un-archive a locally-archived task
                  result[idx] = { ...rem, archived: rem.archived ?? result[idx].archived };
                }
              }
            }
            resolve(result);
            return result;
          });
        });
        // Push any local tasks that are newer than what Supabase has
        const needsSync = merged.filter(t => {
          const rem = remoteMap.get(t.id);
          const localUpdated  = t.updated_at ?? t.created_at;
          const remoteUpdated = rem ? ((rem as any)._updated_at ?? rem.updated_at ?? "") : "";
          return localUpdated > remoteUpdated;
        });
        if (needsSync.length > 0) syncUpsert("tasks", needsSync).catch(console.warn);
        setSyncStatus("synced");
        setLastSynced(new Date().toISOString());
      } catch {
        setSyncStatus("error");
      }
    }).catch(() => setSyncStatus("error"));
  }, []);

  // Sync when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active" && loadedRef.current) syncNow();
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncNow = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const remote = await syncFetch<Task & { _updated_at: string }>("tasks");
      const remoteMap = new Map(remote.map(r => [r.id, r]));
      const local = tasksRef.current;

      const merged = [...local];
      for (const rem of remote) {
        const idx = merged.findIndex(t => t.id === rem.id);
        if (idx === -1) merged.push(rem);
        else {
          const localUpdated  = merged[idx].updated_at ?? merged[idx].created_at;
          const remoteUpdated = (rem as any)._updated_at ?? rem.updated_at ?? "";
          if (remoteUpdated > localUpdated) {
            merged[idx] = { ...rem, archived: rem.archived ?? merged[idx].archived };
          }
        }
      }
      setTasks(merged);

      // Push any local tasks that are newer than what Supabase has
      const toUpsert = merged.filter(t => {
        const rem = remoteMap.get(t.id);
        const localUpdated  = t.updated_at ?? t.created_at;
        const remoteUpdated = rem ? ((rem as any)._updated_at ?? rem.updated_at ?? "") : "";
        return localUpdated > remoteUpdated;
      });
      if (toUpsert.length > 0) await syncUpsert("tasks", toUpsert).catch(console.warn);

      setSyncStatus("synced");
      setLastSynced(new Date().toISOString());
    } catch {
      setSyncStatus("error");
    }
  }, []);

  const addTask = useCallback((title: string, due_date?: string): string => {
    const id  = `${Date.now()}`;
    const now = new Date().toISOString();
    setTasks(prev => [...prev, stamp({ id, title, done: false, due_date, created_at: now, subtasks: [], tags: [] })]);
    return id;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, "id" | "created_at">>) => {
    setTasks(prev => prev.map(t => t.id === id ? stamp({ ...t, ...updates }) : t));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const done = !t.done;
      return stamp({ ...t, done, completed_at: done ? new Date().toISOString() : undefined });
    }));
  }, []);

  const archiveTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? stamp({ ...t, archived: true }) : t));
  }, []);

  const unarchiveTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? stamp({ ...t, archived: false }) : t));
  }, []);

  const deleteTask = useCallback((id: string): (() => void) => {
    const deleted = tasksRef.current.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    const timer = setTimeout(() => syncDelete("tasks", id), 3000);
    return () => {
      clearTimeout(timer);
      if (deleted) setTasks(prev => [...prev, deleted]);
    };
  }, []);

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
  }, []);

  const setSectionOrder = useCallback((reorderedSection: Task[]) => {
    setTasks(prev => {
      const ids     = new Set(reorderedSection.map(t => t.id));
      const indices = prev.reduce<number[]>((acc, t, i) => ids.has(t.id) ? [...acc, i] : acc, []);
      const result  = [...prev];
      indices.forEach((idx, i) => { result[idx] = reorderedSection[i]; });
      return result;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    const toArchive = tasksRef.current
      .filter(t => t.done && !t.archived)
      .map(t => stamp({ ...t, archived: true }));
    if (toArchive.length === 0) return;
    const archivedIds = new Set(toArchive.map(t => t.id));
    const archivedMap = new Map(toArchive.map(t => [t.id, t]));
    setTasks(prev => prev.map(t => archivedIds.has(t.id) ? archivedMap.get(t.id)! : t));
    syncUpsert("tasks", toArchive).catch(console.warn);
  }, []);

  return (
    <TasksContext.Provider value={{
      tasks, loaded, syncStatus, lastSynced,
      addTask, updateTask, toggleTask, deleteTask, archiveTask, unarchiveTask,
      reorderTask, setSectionOrder, clearCompleted, syncNow,
    }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
}
