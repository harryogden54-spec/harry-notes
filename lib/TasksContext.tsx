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
  const loadedRef   = useRef(false);
  const tasksRef    = useRef<Task[]>([]);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Persist locally on every change; Supabase sync only on explicit triggers
  useEffect(() => {
    if (!loadedRef.current) return;
    storage.set("tasks", tasks);
    if (Platform.OS !== "web") dbSaveTasks(tasks).catch(console.error);
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
        setTasks(prev => {
          const merged = [...prev];
          for (const rem of remote) {
            const idx = merged.findIndex(t => t.id === rem.id);
            if (idx === -1) merged.push(rem);
            else {
              const localUpdated  = merged[idx].updated_at ?? merged[idx].created_at;
              const remoteUpdated = (rem as any)._updated_at ?? rem.updated_at ?? "";
              if (remoteUpdated > localUpdated) merged[idx] = rem;
            }
          }
          return merged;
        });
        setSyncStatus("synced");
        setLastSynced(new Date().toISOString());
      } catch {
        setSyncStatus("error");
      }
    });
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
      setTasks(prev => {
        const merged = [...prev];
        for (const rem of remote) {
          const idx = merged.findIndex(t => t.id === rem.id);
          if (idx === -1) merged.push(rem);
          else {
            const localUpdated  = merged[idx].updated_at ?? merged[idx].created_at;
            const remoteUpdated = (rem as any)._updated_at ?? rem.updated_at ?? "";
            if (remoteUpdated > localUpdated) merged[idx] = rem;
          }
        }
        return merged;
      });
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
    setTasks(prev => prev.map(t => t.done && !t.archived ? stamp({ ...t, archived: true }) : t));
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
