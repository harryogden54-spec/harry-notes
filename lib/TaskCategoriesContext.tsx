import React, { createContext, useContext, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { storage } from "./storage";
import { dbLoadTaskCategories, dbSaveTaskCategories } from "./db";
import { useSyncedCollection, type SyncStatus } from "./useSyncedCollection";
import { ACCENT_OPTIONS, type AccentId } from "./theme";

export type Category = {
  id: string;
  name: string;
  /** Key into ACCENT_OPTIONS (lib/theme.ts) — resolved to a concrete colour
   *  at render time via resolveAccentSwatch(). Never a raw hex value. */
  color: AccentId;
  order: number;
  created_at: string;
  updated_at?: string;
};

// Back-compat seed — every task created before categories became
// user-editable data stores category: "personal" | "uni". Seeding these two
// fixed ids on first load (see onLoad below) means those tasks keep
// resolving to a real category everywhere. Colors match the old fixed
// categoryColors palette exactly (personal=#88C0D0=sky, uni=#B48EAD=orchid)
// so nothing visually changes for existing users.
const DEFAULT_CATEGORIES: Omit<Category, "created_at" | "updated_at">[] = [
  { id: "personal", name: "Personal", color: "sky",    order: 0 },
  { id: "uni",      name: "Uni",      color: "orchid", order: 1 },
];

// Split into data / sync / actions contexts — see TasksContext for rationale.
type CategoriesData = {
  categories: Category[];
  loaded: boolean;
};

type CategoriesSync = {
  syncStatus: SyncStatus;
  lastSynced: string | null;
  syncNow: (opts?: { full?: boolean }) => Promise<boolean>;
};

type CategoriesActions = {
  addCategory: (name: string, color?: AccentId) => string;
  updateCategory: (id: string, updates: Partial<Omit<Category, "id" | "created_at">>) => void;
  /** Removes the category itself only. Callers (the manage-categories UI)
   *  must reassign any tasks referencing this id to Uncategorized (i.e. set
   *  task.category to undefined via useTasksActions) BEFORE calling this —
   *  tasks live in a sibling context this one has no access to. */
  deleteCategory: (id: string) => void;
  /** Persists a full reorder — pass every category id in the new order. */
  reorderCategories: (orderedIds: string[]) => void;
};

const CategoriesDataContext    = createContext<CategoriesData | null>(null);
const CategoriesSyncContext    = createContext<CategoriesSync | null>(null);
const CategoriesActionsContext = createContext<CategoriesActions | null>(null);

function stamp(c: Category): Category {
  return { ...c, updated_at: new Date().toISOString() };
}

const EPOCH = new Date(0).toISOString();

/** Coerce a possibly-malformed category into a well-formed one — see
 *  TasksContext for the rationale (older schema / other client / partial
 *  writes can leave name/color/order missing or the wrong type). */
function normalizeCategory(c: Category): Category {
  return {
    ...c,
    name:       typeof c.name === "string" ? c.name : "",
    color:      (typeof c.color === "string" && ACCENT_OPTIONS.some(a => a.id === c.color))
                  ? c.color as AccentId
                  : "indigo",
    order:      typeof c.order === "number" ? c.order : 0,
    created_at: typeof c.created_at === "string" && c.created_at ? c.created_at : EPOCH,
  };
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function TaskCategoriesProvider({ children }: { children: React.ReactNode }) {
  const {
    items: categories, setItems: setCategories, loaded, syncStatus, lastSynced,
    itemsRef: categoriesRef,
    markDirty, markLocallyDeleted, syncNow,
  } = useSyncedCollection<Category>({
    table: "task_categories",
    storageKey: "task_categories",
    loadLocal: async () => {
      if (Platform.OS !== "web") {
        // Re-throw on DB error: the caller (useSyncedCollection) will surface
        // syncStatus:"error" and mark the app as loaded — see TasksContext.
        const dbCats = await dbLoadTaskCategories() as Category[];
        if (dbCats.length > 0) return dbCats.map(normalizeCategory);
        // DB returned 0 rows — migrate from AsyncStorage on first install.
        const stored = await storage.get<Category[]>("task_categories") ?? [];
        if (stored.length > 0) await dbSaveTaskCategories(stored);
        return stored.map(normalizeCategory);
      }
      return (await storage.get<Category[]>("task_categories") ?? []).map(normalizeCategory);
    },
    saveLocal: (items, changes) => {
      if (Platform.OS !== "web") dbSaveTaskCategories(items, changes).catch(console.error);
    },
    // First-ever load with nothing stored locally (fresh install, or an
    // install that predates this feature) — seed the two legacy categories so
    // pre-existing tasks' "personal"/"uni" category ids keep resolving.
    // Marked dirty so the seed uploads on the next sync.
    onLoad: (items) => {
      if (items.length > 0) return { items, dirty: [] };
      const now = new Date().toISOString();
      const seeded = DEFAULT_CATEGORIES.map(c => ({ ...c, created_at: now, updated_at: now }));
      return { items: seeded, dirty: seeded.map(c => c.id) };
    },
    // Coerce remote rows — older/foreign rows may be missing name/color/order.
    normalizeRemote: (row) => normalizeCategory(row),
  });

  const addCategory = useCallback((name: string, color: AccentId = "indigo"): string => {
    const id  = newId();
    const now = new Date().toISOString();
    const maxOrder = categoriesRef.current.reduce((m, c) => Math.max(m, c.order ?? 0), -1);
    markDirty(id);
    setCategories(prev => [...prev, stamp({ id, name, color, order: maxOrder + 1, created_at: now })]);
    return id;
  }, [markDirty, setCategories, categoriesRef]);

  const updateCategory = useCallback((id: string, updates: Partial<Omit<Category, "id" | "created_at">>) => {
    markDirty(id);
    setCategories(prev => prev.map(c => c.id === id ? stamp({ ...c, ...updates }) : c));
  }, [markDirty, setCategories]);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    // Removes the SQLite row on next flush AND queues the remote tombstone
    // (retried by the sync hook until it lands).
    markLocallyDeleted(id);
  }, [markLocallyDeleted, setCategories]);

  const reorderCategories = useCallback((orderedIds: string[]) => {
    const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
    for (const id of orderedIds) markDirty(id);
    setCategories(prev => prev.map(c => orderMap.has(c.id) ? stamp({ ...c, order: orderMap.get(c.id)! }) : c));
  }, [markDirty, setCategories]);

  const dataValue = useMemo(() => ({ categories, loaded }), [categories, loaded]);
  const syncValue = useMemo(
    () => ({ syncStatus, lastSynced, syncNow }),
    [syncStatus, lastSynced, syncNow]
  );
  const actionsValue = useMemo(
    () => ({ addCategory, updateCategory, deleteCategory, reorderCategories }),
    [addCategory, updateCategory, deleteCategory, reorderCategories]
  );

  return (
    <CategoriesDataContext.Provider value={dataValue}>
      <CategoriesSyncContext.Provider value={syncValue}>
        <CategoriesActionsContext.Provider value={actionsValue}>
          {children}
        </CategoriesActionsContext.Provider>
      </CategoriesSyncContext.Provider>
    </CategoriesDataContext.Provider>
  );
}

export function useCategoriesData(): CategoriesData {
  const ctx = useContext(CategoriesDataContext);
  if (!ctx) throw new Error("useCategoriesData must be used within TaskCategoriesProvider");
  return ctx;
}

export function useCategoriesSync(): CategoriesSync {
  const ctx = useContext(CategoriesSyncContext);
  if (!ctx) throw new Error("useCategoriesSync must be used within TaskCategoriesProvider");
  return ctx;
}

export function useCategoriesActions(): CategoriesActions {
  const ctx = useContext(CategoriesActionsContext);
  if (!ctx) throw new Error("useCategoriesActions must be used within TaskCategoriesProvider");
  return ctx;
}
