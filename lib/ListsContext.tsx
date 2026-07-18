import React, { createContext, useContext, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { storage } from "./storage";
import { dbLoadLists, dbSaveLists } from "./db";
import { useSyncedCollection, type SyncStatus } from "./useSyncedCollection";

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

// Re-exported from theme.ts as the single source of truth.
export { listColors as LIST_COLORS } from "./theme";

// Split into data / sync / actions contexts — see TasksContext for rationale.
type ListsData = {
  lists: NoteList[];
  loaded: boolean;
};

type ListsSync = {
  syncStatus: SyncStatus;
  lastSynced: string | null;
  syncNow: (opts?: { full?: boolean }) => Promise<boolean>;
};

type ListsActions = {
  addList: (name: string, color: string, initialItems?: string[]) => string;
  updateList: (id: string, updates: Partial<Omit<NoteList, "id" | "created_at">>) => void;
  deleteList: (id: string) => () => void;
  duplicateList: (id: string) => void;
  pinList: (id: string) => void;
  addItem: (listId: string, content: string, type: ListItemType) => void;
  updateItem: (listId: string, itemId: string, updates: Partial<ListItem>) => void;
  toggleItem: (listId: string, itemId: string) => void;
  deleteItem: (listId: string, itemId: string) => () => void;
  moveItem: (fromListId: string, itemId: string, toListId: string) => void;
  reorderItems: (listId: string, newItems: ListItem[]) => void;
};

const ListsDataContext    = createContext<ListsData | null>(null);
const ListsSyncContext    = createContext<ListsSync | null>(null);
const ListsActionsContext = createContext<ListsActions | null>(null);

function stamp(obj: NoteList): NoteList {
  return { ...obj, updated_at: new Date().toISOString() };
}

const EPOCH = new Date(0).toISOString();

/**
 * Coerce a possibly-malformed list into a well-formed one. Rows synced from
 * another client or older schema versions may be missing `name`/`created_at` or
 * have a non-array `items`, which crashes screens that call `list.name
 * .toLowerCase()`, sort by date, or map over `items`. Normalising on load and on
 * every remote merge guarantees the shapes the UI relies on.
 */
function normalizeList(l: NoteList): NoteList {
  const created = typeof l.created_at === "string" && l.created_at ? l.created_at : EPOCH;
  return {
    ...l,
    name:  typeof l.name === "string" ? l.name : "",
    items: Array.isArray(l.items)
      ? l.items.filter(Boolean).map(i => ({ ...i, content: typeof i.content === "string" ? i.content : "", done: !!i.done }))
      : [],
    created_at: created,
  };
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ListsProvider({ children }: { children: React.ReactNode }) {
  const {
    items: lists, setItems: setLists, loaded, syncStatus, lastSynced,
    itemsRef: listsRef,
    markDirty, markLocallyDeleted, syncNow,
  } = useSyncedCollection<NoteList>({
    table: "lists",
    storageKey: "lists",
    loadLocal: async () => {
      if (Platform.OS !== "web") {
        // Re-throw on DB error — see TasksContext for rationale.
        const dbLists = await dbLoadLists() as NoteList[];
        if (dbLists.length > 0) return dbLists.map(normalizeList);
        const stored = await storage.get<NoteList[]>("lists") ?? [];
        if (stored.length > 0) await dbSaveLists(stored);
        return stored.map(normalizeList);
      }
      return (await storage.get<NoteList[]>("lists") ?? []).map(normalizeList);
    },
    saveLocal: (items, changes) => {
      if (Platform.OS !== "web") dbSaveLists(items, changes).catch(console.error);
    },
    // Coerce remote rows — older rows may be missing name/created_at/items.
    normalizeRemote: (row) => normalizeList(row),
  });

  const addList = useCallback((name: string, color: string, initialItems?: string[]): string => {
    const id  = newId();
    const now = new Date().toISOString();
    const items: ListItem[] = (initialItems ?? []).map((content, i) => ({
      id: `${Date.now()}_${i}`, content, type: "checkbox" as ListItemType, done: false,
    }));
    markDirty(id);
    setLists(prev => [...prev, stamp({ id, name, color, items, created_at: now })]);
    return id;
  }, [markDirty, setLists]);

  const updateList = useCallback((id: string, updates: Partial<Omit<NoteList, "id" | "created_at">>) => {
    markDirty(id);
    setLists(prev => prev.map(l => l.id === id ? stamp({ ...l, ...updates }) : l));
  }, [markDirty, setLists]);

  const deleteList = useCallback((id: string): (() => void) => {
    const deleted = listsRef.current.find(l => l.id === id);
    setLists(prev => prev.filter(l => l.id !== id));
    // Removes the SQLite row on next flush AND queues the remote tombstone
    // (retried by the sync hook until it lands).
    markLocallyDeleted(id);
    return () => {
      if (deleted) {
        markDirty(id); // cancels the queued tombstone / resurrects if sent
        setLists(prev => [...prev, deleted]);
      }
    };
  }, [listsRef, markLocallyDeleted, markDirty, setLists]);

  const pinList = useCallback((id: string) => {
    markDirty(id);
    setLists(prev => prev.map(l => l.id === id ? stamp({ ...l, pinned: !l.pinned }) : l));
  }, [markDirty, setLists]);

  const duplicateList = useCallback((id: string) => {
    const original = listsRef.current.find(l => l.id === id);
    if (!original) return;
    const now = new Date().toISOString();
    const newList: NoteList = {
      ...original,
      id: `${Date.now()}`,
      name: `${original.name} (copy)`,
      items: (original.items ?? []).map(i => ({ ...i, id: `${Date.now()}-${Math.random()}`, done: false })),
      created_at: now,
      updated_at: now,
    };
    markDirty(newList.id);
    setLists(prev => [...prev, newList]);
  }, [listsRef, markDirty, setLists]);

  const addItem = useCallback((listId: string, content: string, type: ListItemType) => {
    const item: ListItem = { id: newId(), content, type, done: false };
    markDirty(listId);
    setLists(prev => prev.map(l =>
      l.id === listId ? stamp({ ...l, items: [...(l.items ?? []), item] }) : l
    ));
  }, [markDirty, setLists]);

  const updateItem = useCallback((listId: string, itemId: string, updates: Partial<ListItem>) => {
    markDirty(listId);
    setLists(prev => prev.map(l =>
      l.id === listId
        ? stamp({ ...l, items: (l.items ?? []).map(i => i.id === itemId ? { ...i, ...updates } : i) })
        : l
    ));
  }, [markDirty, setLists]);

  const toggleItem = useCallback((listId: string, itemId: string) => {
    markDirty(listId);
    setLists(prev => prev.map(l =>
      l.id === listId
        ? stamp({ ...l, items: (l.items ?? []).map(i => i.id === itemId ? { ...i, done: !i.done } : i) })
        : l
    ));
  }, [markDirty, setLists]);

  const deleteItem = useCallback((listId: string, itemId: string): (() => void) => {
    let deletedItem: ListItem | undefined;
    markDirty(listId);
    setLists(prev => prev.map(l => {
      if (l.id !== listId) return l;
      deletedItem = (l.items ?? []).find(i => i.id === itemId);
      return stamp({ ...l, items: (l.items ?? []).filter(i => i.id !== itemId) });
    }));
    return () => {
      if (deletedItem) {
        const item = deletedItem;
        markDirty(listId);
        setLists(prev => prev.map(l =>
          l.id === listId ? stamp({ ...l, items: [...(l.items ?? []), item] }) : l
        ));
      }
    };
  }, [markDirty, setLists]);

  const moveItem = useCallback((fromListId: string, itemId: string, toListId: string) => {
    markDirty(fromListId, toListId);
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
  }, [markDirty, setLists]);

  const reorderItems = useCallback((listId: string, newItems: ListItem[]) => {
    markDirty(listId);
    setLists(prev => prev.map(l =>
      l.id === listId ? stamp({ ...l, items: newItems }) : l
    ));
  }, [markDirty, setLists]);

  const dataValue = useMemo(() => ({ lists, loaded }), [lists, loaded]);
  const syncValue = useMemo(
    () => ({ syncStatus, lastSynced, syncNow }),
    [syncStatus, lastSynced, syncNow]
  );
  const actionsValue = useMemo(
    () => ({
      addList, updateList, deleteList, duplicateList, pinList,
      addItem, updateItem, toggleItem, deleteItem, moveItem, reorderItems,
    }),
    [addList, updateList, deleteList, duplicateList, pinList,
     addItem, updateItem, toggleItem, deleteItem, moveItem, reorderItems]
  );

  return (
    <ListsDataContext.Provider value={dataValue}>
      <ListsSyncContext.Provider value={syncValue}>
        <ListsActionsContext.Provider value={actionsValue}>
          {children}
        </ListsActionsContext.Provider>
      </ListsSyncContext.Provider>
    </ListsDataContext.Provider>
  );
}

export function useListsData(): ListsData {
  const ctx = useContext(ListsDataContext);
  if (!ctx) throw new Error("useListsData must be used within ListsProvider");
  return ctx;
}

export function useListsSync(): ListsSync {
  const ctx = useContext(ListsSyncContext);
  if (!ctx) throw new Error("useListsSync must be used within ListsProvider");
  return ctx;
}

export function useListsActions(): ListsActions {
  const ctx = useContext(ListsActionsContext);
  if (!ctx) throw new Error("useListsActions must be used within ListsProvider");
  return ctx;
}

/**
 * @deprecated Compatibility alias — re-renders on every data AND sync change.
 * Prefer useListsData / useListsActions / useListsSync.
 */
export function useLists(): ListsData & ListsSync & ListsActions {
  const data    = useListsData();
  const sync    = useListsSync();
  const actions = useListsActions();
  return useMemo(() => ({ ...data, ...sync, ...actions }), [data, sync, actions]);
}
