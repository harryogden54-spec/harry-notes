import React, { createContext, useContext, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { storage } from "./storage";
import { dbLoadCourses, dbSaveCourses } from "./db";
import { useSyncedCollection, type SyncStatus } from "./useSyncedCollection";

export type CourseColumnType = "text" | "checkbox";

export type CourseColumn = {
  id: string;
  name: string;
  type: CourseColumnType;
};

/** One table row; cells keyed by column id (string for text, boolean for checkbox). */
export type CourseRow = {
  id: string;
  cells: Record<string, string | boolean>;
};

export type CourseTable = {
  id: string;
  title: string;
  columns: CourseColumn[];
  rows: CourseRow[];
  created_at: string;
  updated_at?: string;
};

/** Tick progress across every checkbox-type cell in the table. */
export function tableProgress(table: CourseTable): { ticked: number; total: number } {
  const checkboxCols = table.columns.filter(c => c.type === "checkbox");
  if (checkboxCols.length === 0 || table.rows.length === 0) return { ticked: 0, total: 0 };
  let ticked = 0;
  for (const row of table.rows) {
    for (const col of checkboxCols) {
      if (row.cells[col.id] === true) ticked++;
    }
  }
  return { ticked, total: table.rows.length * checkboxCols.length };
}

// Split into data / sync / actions contexts — see TasksContext for rationale.
type CoursesData = {
  tables: CourseTable[];
  loaded: boolean;
};

type CoursesSync = {
  syncStatus: SyncStatus;
  lastSynced: string | null;
  syncNow: (opts?: { full?: boolean }) => Promise<boolean>;
};

type CoursesActions = {
  addTable: (title: string, columns: Omit<CourseColumn, "id">[]) => string;
  /** Rename + column edits in one shot (the table editor modal saves both).
   *  Cells belonging to removed columns are pruned. */
  updateTableStructure: (id: string, title: string, columns: CourseColumn[]) => void;
  deleteTable: (id: string) => () => void;
  addRow: (tableId: string) => void;
  deleteRow: (tableId: string, rowId: string) => void;
  updateCell: (tableId: string, rowId: string, columnId: string, value: string | boolean) => void;
};

const CoursesDataContext    = createContext<CoursesData | null>(null);
const CoursesSyncContext    = createContext<CoursesSync | null>(null);
const CoursesActionsContext = createContext<CoursesActions | null>(null);

function stamp(t: CourseTable): CourseTable {
  return { ...t, updated_at: new Date().toISOString() };
}

const EPOCH = new Date(0).toISOString();

/** Coerce a possibly-malformed table (older schema / other client) into a
 *  well-formed one so screens can map over columns/rows safely. */
function normalizeTable(t: CourseTable): CourseTable {
  return {
    ...t,
    title: typeof t.title === "string" ? t.title : "",
    columns: Array.isArray(t.columns)
      ? t.columns.filter(Boolean).map(c => ({
          id: String(c.id ?? newId()),
          name: typeof c.name === "string" ? c.name : "",
          type: c.type === "checkbox" ? "checkbox" as const : "text" as const,
        }))
      : [],
    rows: Array.isArray(t.rows)
      ? t.rows.filter(Boolean).map(r => ({
          id: String(r.id ?? newId()),
          cells: r.cells && typeof r.cells === "object" ? r.cells : {},
        }))
      : [],
    created_at: typeof t.created_at === "string" && t.created_at ? t.created_at : EPOCH,
  };
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CoursesProvider({ children }: { children: React.ReactNode }) {
  const {
    items: tables, setItems: setTables, loaded, syncStatus, lastSynced,
    itemsRef: tablesRef,
    markDirty, markLocallyDeleted, syncNow,
  } = useSyncedCollection<CourseTable>({
    table: "courses",
    storageKey: "courses",
    loadLocal: async () => {
      if (Platform.OS !== "web") {
        // Re-throw on DB error — see TasksContext for rationale.
        const dbTables = await dbLoadCourses() as CourseTable[];
        if (dbTables.length > 0) return dbTables.map(normalizeTable);
        const stored = await storage.get<CourseTable[]>("courses") ?? [];
        if (stored.length > 0) await dbSaveCourses(stored);
        return stored.map(normalizeTable);
      }
      return (await storage.get<CourseTable[]>("courses") ?? []).map(normalizeTable);
    },
    saveLocal: (items, changes) => {
      if (Platform.OS !== "web") dbSaveCourses(items, changes).catch(console.error);
    },
    normalizeRemote: (row) => normalizeTable(row),
  });

  const addTable = useCallback((title: string, columns: Omit<CourseColumn, "id">[]): string => {
    const id  = newId();
    const now = new Date().toISOString();
    const cols: CourseColumn[] = columns.map(c => ({ ...c, id: newId() }));
    markDirty(id);
    setTables(prev => [...prev, stamp({ id, title, columns: cols, rows: [], created_at: now })]);
    return id;
  }, [markDirty, setTables]);

  const updateTableStructure = useCallback((id: string, title: string, columns: CourseColumn[]) => {
    markDirty(id);
    setTables(prev => prev.map(t => {
      if (t.id !== id) return t;
      const keep = new Set(columns.map(c => c.id));
      const rows = t.rows.map(r => ({
        ...r,
        cells: Object.fromEntries(Object.entries(r.cells).filter(([colId]) => keep.has(colId))),
      }));
      return stamp({ ...t, title, columns, rows });
    }));
  }, [markDirty, setTables]);

  const deleteTable = useCallback((id: string): (() => void) => {
    const deleted = tablesRef.current.find(t => t.id === id);
    setTables(prev => prev.filter(t => t.id !== id));
    // Removes the SQLite row on next flush AND queues the remote tombstone
    // (retried by the sync hook until it lands).
    markLocallyDeleted(id);
    return () => {
      if (deleted) {
        markDirty(id); // cancels the queued tombstone / resurrects if sent
        setTables(prev => [...prev, deleted]);
      }
    };
  }, [tablesRef, markLocallyDeleted, markDirty, setTables]);

  const addRow = useCallback((tableId: string) => {
    const row: CourseRow = { id: newId(), cells: {} };
    markDirty(tableId);
    setTables(prev => prev.map(t => t.id === tableId ? stamp({ ...t, rows: [...t.rows, row] }) : t));
  }, [markDirty, setTables]);

  const deleteRow = useCallback((tableId: string, rowId: string) => {
    markDirty(tableId);
    setTables(prev => prev.map(t =>
      t.id === tableId ? stamp({ ...t, rows: t.rows.filter(r => r.id !== rowId) }) : t
    ));
  }, [markDirty, setTables]);

  const updateCell = useCallback((tableId: string, rowId: string, columnId: string, value: string | boolean) => {
    markDirty(tableId);
    setTables(prev => prev.map(t =>
      t.id === tableId
        ? stamp({
            ...t,
            rows: t.rows.map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [columnId]: value } } : r),
          })
        : t
    ));
  }, [markDirty, setTables]);

  const dataValue = useMemo(() => ({ tables, loaded }), [tables, loaded]);
  const syncValue = useMemo(
    () => ({ syncStatus, lastSynced, syncNow }),
    [syncStatus, lastSynced, syncNow]
  );
  const actionsValue = useMemo(
    () => ({ addTable, updateTableStructure, deleteTable, addRow, deleteRow, updateCell }),
    [addTable, updateTableStructure, deleteTable, addRow, deleteRow, updateCell]
  );

  return (
    <CoursesDataContext.Provider value={dataValue}>
      <CoursesSyncContext.Provider value={syncValue}>
        <CoursesActionsContext.Provider value={actionsValue}>
          {children}
        </CoursesActionsContext.Provider>
      </CoursesSyncContext.Provider>
    </CoursesDataContext.Provider>
  );
}

export function useCoursesData(): CoursesData {
  const ctx = useContext(CoursesDataContext);
  if (!ctx) throw new Error("useCoursesData must be used within CoursesProvider");
  return ctx;
}

export function useCoursesSync(): CoursesSync {
  const ctx = useContext(CoursesSyncContext);
  if (!ctx) throw new Error("useCoursesSync must be used within CoursesProvider");
  return ctx;
}

export function useCoursesActions(): CoursesActions {
  const ctx = useContext(CoursesActionsContext);
  if (!ctx) throw new Error("useCoursesActions must be used within CoursesProvider");
  return ctx;
}
