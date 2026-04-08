import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { storage } from "./storage";
import { syncFetch, syncUpsert, syncDelete } from "./supabase";

export type ListItemType = "checkbox" | "bullet";

export type ListItem = {
  id: string;
  content: string;
  type: ListItemType;
  done: boolean;
  url?: string;
};

export type NoteList = {
  id: string;
  name: string;
  color: string;
  items: ListItem[];
  pinned?: boolean;
  created_at: string;
  updated_at?: string;
};

export const LIST_COLORS = [
  "#4A90D9", "#9B59B6", "#27AE60", "#E67E22",
  "#E74C3C", "#E8C84A", "#E91E8C", "#1ABC9C",
];

type SyncStatus = "idle" | "syncing" | "synced" | "error";

type ListsContextValue = {
  lists: NoteList[];
  loaded: boolean;
  syncStatus: SyncStatus;
  lastSynced: string | null;
  addList: (name: string, color: string) => string;
  updateList: (id: string, updates: Partial<Omit<NoteList, "id" | "created_at">>) => void;
  deleteList: (id: string) => () => void;
  duplicateList: (id: string) => void;
  pinList: (id: string) => void;
  addItem: (listId: string, content: string, type: ListItemType) => void;
  updateItem: (listId: string, itemId: string, updates: Partial<ListItem>) => void;
  toggleItem: (listId: string, itemId: string) => void;
  deleteItem: (listId: string, itemId: string) => () => void;
  moveItem: (fromListId: string, itemId: string, toListId: string) => void;
  syncNow: () => Promise<void>;
};

const ListsContext = createContext<ListsContextValue | null>(null);

function stamp(obj: NoteList): NoteList {
  return { ...obj, updated_at: new Date().toISOString() };
}

export function ListsProvider({ children }: { children: React.ReactNode }) {
  const [lists, setLists]           = useState<NoteList[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef   = useRef(false);
  const listsRef    = useRef<NoteList[]>([]);

  useEffect(() => { listsRef.current = lists; }, [lists]);

  useEffect(() => {
    if (!loadedRef.current) return;
    storage.set("lists", lists);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSyncStatus("syncing");
      syncUpsert("lists", lists)
        .then(() => { setSyncStatus("synced"); setLastSynced(new Date().toISOString()); })
        .catch(() => setSyncStatus("error"));
    }, 1500);
  }, [lists]);

  useEffect(() => {
    storage.get<NoteList[]>("lists").then(async (local) => {
      const localLists = local ?? [];
      setLists(localLists);
      loadedRef.current = true;
      setLoaded(true);

      setSyncStatus("syncing");
      try {
        const remote = await syncFetch<NoteList & { _updated_at: string }>("lists");
        if (remote.length === 0 && localLists.length > 0) {
          await syncUpsert("lists", localLists);
          setSyncStatus("synced");
          setLastSynced(new Date().toISOString());
          return;
        }
        setLists(prev => {
          const merged = [...prev];
          for (const rem of remote) {
            const idx = merged.findIndex(l => l.id === rem.id);
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

  const syncNow = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const remote = await syncFetch<NoteList & { _updated_at: string }>("lists");
      setLists(prev => {
        const merged = [...prev];
        for (const rem of remote) {
          const idx = merged.findIndex(l => l.id === rem.id);
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

  const addList = useCallback((name: string, color: string): string => {
    const id  = `${Date.now()}`;
    const now = new Date().toISOString();
    setLists(prev => [...prev, stamp({ id, name, color, items: [], created_at: now })]);
    return id;
  }, []);

  const updateList = useCallback((id: string, updates: Partial<Omit<NoteList, "id" | "created_at">>) => {
    setLists(prev => prev.map(l => l.id === id ? stamp({ ...l, ...updates }) : l));
  }, []);

  const deleteList = useCallback((id: string): (() => void) => {
    const deleted = listsRef.current.find(l => l.id === id);
    setLists(prev => prev.filter(l => l.id !== id));
    const timer = setTimeout(() => syncDelete("lists", id), 3000);
    return () => {
      clearTimeout(timer);
      if (deleted) setLists(prev => [...prev, deleted]);
    };
  }, []);

  const pinList = useCallback((id: string) => {
    setLists(prev => prev.map(l => l.id === id ? stamp({ ...l, pinned: !l.pinned }) : l));
  }, []);

  const duplicateList = useCallback((id: string) => {
    const original = listsRef.current.find(l => l.id === id);
    if (!original) return;
    const now = new Date().toISOString();
    const newList: NoteList = {
      ...original,
      id: `${Date.now()}`,
      name: `${original.name} (copy)`,
      items: original.items.map(i => ({ ...i, id: `${Date.now()}-${Math.random()}`, done: false })),
      created_at: now,
      updated_at: now,
    };
    setLists(prev => [...prev, newList]);
  }, []);

  const addItem = useCallback((listId: string, content: string, type: ListItemType) => {
    const item: ListItem = { id: `${Date.now()}`, content, type, done: false };
    setLists(prev => prev.map(l =>
      l.id === listId ? stamp({ ...l, items: [...(l.items ?? []), item] }) : l
    ));
  }, []);

  const updateItem = useCallback((listId: string, itemId: string, updates: Partial<ListItem>) => {
    setLists(prev => prev.map(l =>
      l.id === listId
        ? stamp({ ...l, items: (l.items ?? []).map(i => i.id === itemId ? { ...i, ...updates } : i) })
        : l
    ));
  }, []);

  const toggleItem = useCallback((listId: string, itemId: string) => {
    setLists(prev => prev.map(l =>
      l.id === listId
        ? stamp({ ...l, items: (l.items ?? []).map(i => i.id === itemId ? { ...i, done: !i.done } : i) })
        : l
    ));
  }, []);

  const deleteItem = useCallback((listId: string, itemId: string): (() => void) => {
    let deletedItem: ListItem | undefined;
    setLists(prev => prev.map(l => {
      if (l.id !== listId) return l;
      deletedItem = (l.items ?? []).find(i => i.id === itemId);
      return stamp({ ...l, items: (l.items ?? []).filter(i => i.id !== itemId) });
    }));
    return () => {
      if (deletedItem) {
        const item = deletedItem;
        setLists(prev => prev.map(l =>
          l.id === listId ? stamp({ ...l, items: [...(l.items ?? []), item] }) : l
        ));
      }
    };
  }, []);

  const moveItem = useCallback((fromListId: string, itemId: string, toListId: string) => {
    setLists(prev => {
      let movedItem: ListItem | undefined;
      const withoutItem = prev.map(l => {
        if (l.id !== fromListId) return l;
        movedItem = (l.items ?? []).find(i => i.id === itemId);
        return stamp({ ...l, items: (l.items ?? []).filter(i => i.id !== itemId) });
      });
      if (!movedItem) return prev;
      const item = movedItem;
      return withoutItem.map(l =>
        l.id === toListId ? stamp({ ...l, items: [...(l.items ?? []), item] }) : l
      );
    });
  }, []);

  return (
    <ListsContext.Provider value={{
      lists, loaded, syncStatus, lastSynced,
      addList, updateList, deleteList, duplicateList, pinList,
      addItem, updateItem, toggleItem, deleteItem, moveItem, syncNow,
    }}>
      {children}
    </ListsContext.Provider>
  );
}

export function useLists() {
  const ctx = useContext(ListsContext);
  if (!ctx) throw new Error("useLists must be used within ListsProvider");
  return ctx;
}
