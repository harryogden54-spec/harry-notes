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
  const loadedRef        = useRef(false);
  const tasksRef         = useRef<Task[]>([]);
  const syncDebounce     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeletesRef = useRef<Set<string>>(new Set());
  // Explicit dirty tracking — populated on every local mutation, drained
  // after a successful upsert. Replaces the old timestamp-based inference,
  // which could miss rows that Supabase had echoed back between debounce
  // tick and upsert.
  const dirtyIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  function markDirty(...ids: string[]) {
    for (const id of ids) dirtyIdsRef.current.add(id);
  }

  // Persist locally on every change + debounced push to Supabase
  useEffect(() => {
    if (!loadedRef.current) return;
    storage.set("tasks", tasks);
    if (Platform.OS !== "web") dbSaveTasks(tasks).catch(console.error);

    // Debounce Supabase upsert so rapid mutations (e.g. toggling many tasks)
    // are batched into a single network call after 1.5 s of quiet.
    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    syncDebounce.current = setTimeout(async () => {
      const dirtyIds = dirtyIdsRef.current;
      if (dirtyIds.size === 0) return;
      const snapshot = tasksRef.current;
      const dirty = snapshot.filter(t => dirtyIds.has(t.id));
      if (dirty.length === 0) { dirtyIds.clear(); return; }
      // Take a snapshot of what we're about to push, then clear; if the upsert
      // fails we re-add them so they retry next tick.
      const pushedIds = dirty.map(t => t.id);
      dirtyIds.clear();
      const ok = await syncUpsert("tasks", dirty);
      if (!ok) {
        for (const id of pushedIds) dirtyIds.add(id);
        setSyncStatus("error");
      }
    }, 1500);
  }, [tasks]);

  useEffect(() => {
    // 3-second safety net: mark loaded even if storage hangs
    const loadTimeout = setTimeout(() => {
      if (!loadedRef.current) { loadedRef.current = true; setLoaded(true); }
    }, 3000);

    const loadLocal = async (): Promise<Task[]> => {
      if (Platform.OS !== "web") {
        try {
          const dbTasks = await dbLoadTasks() as Task[];
          if (dbTasks.length > 0) return dbTasks;
          // SQLite empty — migrate from AsyncStorage
          const stored = await storage.get<Task[]>("tasks") ?? [];
          if (stored.length > 0) await dbSaveTasks(stored);
          return stored;
        } catch {
          // SQLite unavailable — fall back
        }
      }
      return await storage.get<Task[]>("tasks") ?? [];
    };

    loadLocal().then(async (local) => {
      clearTimeout(loadTimeout);
      // Auto-archive tasks completed 7+ days ago. Bump updated_at and mark
      // dirty so the change actually gets persisted to Supabase, otherwise
      // the next pull would un-archive them.
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffStr = cutoff.toISOString();
      const localTasks = local.map(t => {
        if (t.done && !t.archived && t.completed_at && t.completed_at < cutoffStr) {
          markDirty(t.id);
          return stamp({ ...t, archived: true });
        }
        return t;
      });
      setTasks(localTasks);
      loadedRef.current = true;
      setLoaded(true);

      setSyncStatus("syncing");
      const result = await syncFetch<Task & { _updated_at: string }>("tasks");
      if (!result.ok) {
        // Network/auth error — keep local state, surface error, do NOT
        // upload local as "the truth" (that path is reserved for genuine
        // empty-remote responses).
        setSyncStatus("error");
        return;
      }
      const remote = result.rows;
      if (remote.length === 0 && localTasks.length > 0) {
        // Genuine empty remote: seed it from local.
        const ok = await syncUpsert("tasks", localTasks);
        setSyncStatus(ok ? "synced" : "error");
        if (ok) setLastSynced(new Date().toISOString());
        return;
      }

      // Merge remote into local, preferring whichever has the newer updated_at.
      const local0 = tasksRef.current;
      const merged = [...local0];
      const remoteMap = new Map(remote.map(r => [r.id, r]));
      for (const rem of remote) {
        if (pendingDeletesRef.current.has(rem.id)) continue;
        const idx = merged.findIndex(t => t.id === rem.id);
        if (idx === -1) {
          merged.push(rem);
        } else {
          const localUpdated  = merged[idx].updated_at ?? merged[idx].created_at;
          const remoteUpdated = rem._updated_at ?? rem.updated_at ?? "";
          if (remoteUpdated > localUpdated) {
            // Remote wins — but never un-archive a locally-archived task
            merged[idx] = { ...rem, archived: rem.archived ?? merged[idx].archived };
          }
        }
      }
      setTasks(merged);

      // Push any local tasks newer than what Supabase has
      const needsSync = merged.filter(t => {
        const rem = remoteMap.get(t.id);
        const localUpdated  = t.updated_at ?? t.created_at;
        const remoteUpdated = rem ? (rem._updated_at ?? rem.updated_at ?? "") : "";
        return localUpdated > remoteUpdated;
      });
      if (needsSync.length > 0) {
        const ok = await syncUpsert("tasks", needsSync);
        if (!ok) for (const t of needsSync) dirtyIdsRef.current.add(t.id);
      }
      setSyncStatus("synced");
      setLastSynced(new Date().toISOString());
    }).catch(() => { clearTimeout(loadTimeout); setSyncStatus("error"); });
    return () => clearTimeout(loadTimeout);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    setSyncStatus("syncing");
    const result = await syncFetch<Task & { _updated_at: string }>("tasks");
    if (!result.ok) { setSyncStatus("error"); return; }
    const remote = result.rows;
    const remoteMap = new Map(remote.map(r => [r.id, r]));
    const local = tasksRef.current;

    const merged = [...local];
    for (const rem of remote) {
      if (pendingDeletesRef.current.has(rem.id)) continue;
      const idx = merged.findIndex(t => t.id === rem.id);
      if (idx === -1) merged.push(rem);
      else {
        const localUpdated  = merged[idx].updated_at ?? merged[idx].created_at;
        const remoteUpdated = rem._updated_at ?? rem.updated_at ?? "";
        if (remoteUpdated > localUpdated) {
          merged[idx] = { ...rem, archived: rem.archived ?? merged[idx].archived };
        }
      }
    }
    setTasks(merged);

    // Push any local tasks newer than what Supabase has
    const toUpsert = merged.filter(t => {
      const rem = remoteMap.get(t.id);
      const localUpdated  = t.updated_at ?? t.created_at;
      const remoteUpdated = rem ? (rem._updated_at ?? rem.updated_at ?? "") : "";
      return localUpdated > remoteUpdated;
    });
    if (toUpsert.length > 0) {
      const ok = await syncUpsert("tasks", toUpsert);
      if (!ok) {
        for (const t of toUpsert) dirtyIdsRef.current.add(t.id);
        setSyncStatus("error");
        return;
      }
    }

    setSyncStatus("synced");
    setLastSynced(new Date().toISOString());
  }, []);

  // Sync when app comes to foreground (native) or tab becomes visible (web)
  useEffect(() => {
    if (Platform.OS !== "web") {
      const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
        if (state === "active" && loadedRef.current) syncNow();
      });
      return () => sub.remove();
    }
    const onVisibility = () => { if (!document.hidden && loadedRef.current) syncNow(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [syncNow]);

  const addTask = useCallback((title: string, due_date?: string): string => {
    const id  = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    markDirty(id);
    setTasks(prev => [...prev, stamp({ id, title, done: false, due_date, created_at: now, subtasks: [], tags: [] })]);
    return id;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, "id" | "created_at">>) => {
    markDirty(id);
    setTasks(prev => prev.map(t => t.id === id ? stamp({ ...t, ...updates }) : t));
  }, []);

  const toggleTask = useCallback((id: string) => {
    markDirty(id);
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const done = !t.done;
      return stamp({ ...t, done, completed_at: done ? new Date().toISOString() : undefined });
    }));
  }, []);

  const archiveTask = useCallback((id: string) => {
    markDirty(id);
    setTasks(prev => prev.map(t => t.id === id ? stamp({ ...t, archived: true }) : t));
  }, []);

  const unarchiveTask = useCallback((id: string) => {
    markDirty(id);
    setTasks(prev => prev.map(t => t.id === id ? stamp({ ...t, archived: false }) : t));
  }, []);

  const deleteTask = useCallback((id: string): (() => void) => {
    const deleted = tasksRef.current.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    pendingDeletesRef.current.add(id);
    dirtyIdsRef.current.delete(id); // don't push a row we're about to delete
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
    for (const id of archivedIds) markDirty(id);
    // Don't push directly — let the debounced effect pick them up via dirty set,
    // so failures retry through the same path as every other mutation.
    setTasks(prev => prev.map(t => archivedIds.has(t.id) ? archivedMap.get(t.id)! : t));
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
