import React, { createContext, useContext, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { storage } from "./storage";
import { dbLoadTaskCategories, dbSaveTaskCategories } from "./db";
import { useSyncedCollection, type SyncStatus } from "./useSyncedCollection";
import { normalizeAccentId, type AccentId } from "./theme";

export type Category = {
  id: string;
  name: string;
  /** Key into ACCENT_OPTIONS (lib/theme.ts) — resolved to a concrete colour
   *  at render time via resolveAccentSwatch(). Never a raw hex value. */
  color: AccentId;
  order: number;
  /**
   * Parent category id — set makes this a subcategory (e.g. Uni → Structures).
   * Absent means top level. Exactly one level is supported: a subcategory can
   * never itself be a parent, which `addCategory` enforces.
   *
   * No migration needed — task_categories stores the whole row as `data` jsonb,
   * so this is additive and older clients simply ignore the field.
   */
  parent_id?: string;
  /**
   * Retired, but not gone. An archived category keeps its row and its id, so
   * every task still filed under it keeps resolving to a real name and colour;
   * it simply stops appearing as a board column or as an option in any picker.
   * Deleting is still available and still reassigns tasks — archiving is the
   * reversible half. Additive to the `data` jsonb row, so no migration.
   */
  archived?: boolean;
  created_at: string;
  updated_at?: string;
};

/** Top-level categories, in order. Archived ones are excluded by default —
 *  pass `true` for the manage-categories UI, which has to list them. */
export function topLevel(categories: Category[], includeArchived = false): Category[] {
  return categories
    .filter(c => !c.parent_id && (includeArchived || !c.archived))
    .sort((a, b) => a.order - b.order);
}

/** Children of `parentId`, in order. Archived ones excluded by default. */
export function childrenOf(categories: Category[], parentId: string, includeArchived = false): Category[] {
  return categories
    .filter(c => c.parent_id === parentId && (includeArchived || !c.archived))
    .sort((a, b) => a.order - b.order);
}

/** Archived categories, for the manage-categories UI. A subcategory archived
 *  as part of its parent is not listed separately — restoring the parent brings
 *  it back — so only the topmost archived node in each branch appears. */
export function archivedCategories(categories: Category[]): Category[] {
  const archivedIds = new Set(categories.filter(c => c.archived).map(c => c.id));
  return categories
    .filter(c => c.archived && !(c.parent_id && archivedIds.has(c.parent_id)))
    .sort((a, b) => a.order - b.order);
}

/**
 * The top-level category a task's category id belongs to — itself if it is top
 * level, its parent if it is a subcategory. Used for board grouping so a task
 * filed under a subcategory still appears in its parent's column.
 */
export function rootCategoryId(categories: Category[], id?: string): string | undefined {
  if (!id) return undefined;
  const cat = categories.find(c => c.id === id);
  if (!cat) return id;
  return cat.parent_id ?? cat.id;
}

// Back-compat seed — every task created before categories became
// user-editable data stores category: "personal" | "uni". Seeding these two
// fixed ids on first load (see onLoad below) means those tasks keep
// resolving to a real category everywhere. Colors match the old fixed
// categoryColors palette. The accent ids they were seeded with (sky/orchid)
// retired with the 2026-08-15 palette; these are where the legacy map sends
// them, written out so a fresh install and a migrated one match.
const DEFAULT_CATEGORIES: Omit<Category, "created_at" | "updated_at">[] = [
  { id: "personal", name: "Personal", color: "frost", order: 0 },
  { id: "uni",      name: "Uni",      color: "sage",  order: 1 },
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
  /** `parentId` makes it a subcategory. Nesting deeper than one level is
   *  collapsed to the grandparent rather than rejected. */
  addCategory: (name: string, color?: AccentId, parentId?: string) => string;
  updateCategory: (id: string, updates: Partial<Omit<Category, "id" | "created_at">>) => void;
  /** Removes the category **and its subcategories**. Callers (the
   *  manage-categories UI) must reassign any tasks referencing those ids to
   *  Uncategorized (i.e. set task.category to undefined via useTasksActions)
   *  BEFORE calling this — tasks live in a sibling context this one has no
   *  access to. Use `childrenOf` to enumerate the ids that will go. */
  deleteCategory: (id: string) => void;
  /** Retires a category **and its subcategories** without touching any task.
   *  Unlike delete this needs no reassignment: the rows stay, so a task filed
   *  under an archived category still renders its badge correctly. */
  setCategoryArchived: (id: string, archived: boolean) => void;
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
    // Resolves retired accent ids rather than rejecting them: a straight
    // membership test would send every pre-2026-08-15 category to one colour
    // AND persist + sync that collapse.
    color:      normalizeAccentId(c.color) ?? "navy",
    order:      typeof c.order === "number" ? c.order : 0,
    parent_id:  typeof c.parent_id === "string" && c.parent_id ? c.parent_id : undefined,
    archived:   c.archived === true ? true : undefined,
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

  const addCategory = useCallback((name: string, color: AccentId = "navy", parentId?: string): string => {
    const id  = newId();
    const now = new Date().toISOString();
    const all = categoriesRef.current;
    // Only one level of nesting: if the requested parent is itself a child, hang
    // the new category off its parent instead of building a third level.
    const requested = parentId ? all.find(c => c.id === parentId) : undefined;
    const parent_id = requested ? (requested.parent_id ?? requested.id) : undefined;
    // Order is scoped to the sibling set, so children sort within their parent.
    const siblings = all.filter(c => (c.parent_id ?? undefined) === parent_id);
    const maxOrder = siblings.reduce((m, c) => Math.max(m, c.order ?? 0), -1);
    markDirty(id);
    setCategories(prev => [...prev, stamp({ id, name, color, order: maxOrder + 1, parent_id, created_at: now })]);
    return id;
  }, [markDirty, setCategories, categoriesRef]);

  const updateCategory = useCallback((id: string, updates: Partial<Omit<Category, "id" | "created_at">>) => {
    markDirty(id);
    setCategories(prev => prev.map(c => c.id === id ? stamp({ ...c, ...updates }) : c));
  }, [markDirty, setCategories]);

  const deleteCategory = useCallback((id: string) => {
    // Cascade to subcategories — a child whose parent is gone would be
    // unreachable in every picker while still being referenced by tasks.
    const doomed = [id, ...categoriesRef.current.filter(c => c.parent_id === id).map(c => c.id)];
    setCategories(prev => prev.filter(c => !doomed.includes(c.id)));
    // Removes the SQLite row on next flush AND queues the remote tombstone
    // (retried by the sync hook until it lands).
    for (const d of doomed) markLocallyDeleted(d);
  }, [markLocallyDeleted, setCategories, categoriesRef]);

  const setCategoryArchived = useCallback((id: string, archived: boolean) => {
    // Cascade to subcategories, mirroring delete: a child left visible under an
    // archived parent would be unreachable in every picker but still offered.
    const affected = [id, ...categoriesRef.current.filter(c => c.parent_id === id).map(c => c.id)];
    for (const a of affected) markDirty(a);
    setCategories(prev => prev.map(c =>
      affected.includes(c.id) ? stamp({ ...c, archived: archived ? true : undefined }) : c
    ));
  }, [markDirty, setCategories, categoriesRef]);

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
    () => ({ addCategory, updateCategory, deleteCategory, setCategoryArchived, reorderCategories }),
    [addCategory, updateCategory, deleteCategory, setCategoryArchived, reorderCategories]
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
