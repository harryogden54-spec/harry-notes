import * as SQLite from "expo-sqlite";
import type { SaveChanges } from "./useSyncedCollection";

let _db: SQLite.SQLiteDatabase | null = null;

function tryParse(json: string): any {
  try { return JSON.parse(json); } catch { return undefined; }
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync("harry-notes.db");
  }
  return _db;
}

// Bump this when adding migrations below. The CREATE TABLE statements below
// should always reflect the CURRENT schema so fresh installs get the right
// columns immediately (without relying on migrations to add them).
// v7: query indexes on created_at / archived / pinned (created in the
// always-run block below — CREATE INDEX IF NOT EXISTS covers old installs).
const SCHEMA_VERSION = 7;

export async function initDb(): Promise<void> {
  const db = getDb();

  // ── Current schema ──────────────────────────────────────────────────────────
  // Always kept in sync with SCHEMA_VERSION. Fresh installs get all columns.
  // Migrations below handle upgrading existing installs one version at a time.
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS tasks (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      done         INTEGER NOT NULL DEFAULT 0,
      archived     INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      due_date     TEXT,
      priority     TEXT,
      description  TEXT,
      tags         TEXT,
      subtasks     TEXT,
      recurrence   TEXT,
      category     TEXT,
      uni_course   TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lists (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL DEFAULT '#4A90D9',
      items      TEXT,
      pinned     INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL DEFAULT '',
      body       TEXT NOT NULL DEFAULT '',
      pinned     INTEGER NOT NULL DEFAULT 0,
      type       TEXT NOT NULL DEFAULT 'note',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
    CREATE INDEX IF NOT EXISTS idx_tasks_due  ON tasks(due_date);

    CREATE INDEX IF NOT EXISTS idx_tasks_created   ON tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_archived  ON tasks(archived);
    CREATE INDEX IF NOT EXISTS idx_notes_created   ON notes(created_at);
    CREATE INDEX IF NOT EXISTS idx_notes_pinned    ON notes(pinned);
    CREATE INDEX IF NOT EXISTS idx_lists_created   ON lists(created_at);
  `);

  // ── Migrations ──────────────────────────────────────────────────────────────
  const rows = await db.getAllAsync<{ version: number }>("SELECT version FROM schema_version LIMIT 1");
  const current = rows[0]?.version ?? 0;

  if (current < 1) {
    const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(tasks)");
    const names = cols.map(c => c.name);
    if (!names.includes("priority"))    await db.execAsync("ALTER TABLE tasks ADD COLUMN priority TEXT");
    if (!names.includes("description")) await db.execAsync("ALTER TABLE tasks ADD COLUMN description TEXT");
    if (!names.includes("tags"))        await db.execAsync("ALTER TABLE tasks ADD COLUMN tags TEXT");
    if (!names.includes("subtasks"))    await db.execAsync("ALTER TABLE tasks ADD COLUMN subtasks TEXT");
    if (!names.includes("recurrence"))  await db.execAsync("ALTER TABLE tasks ADD COLUMN recurrence TEXT");
  }

  // v2: notes table was added via CREATE TABLE IF NOT EXISTS (no-op for existing).
  // v3: sticky_notes was added here but is now dead — dropped in v6 below.

  if (current < 4) {
    const tCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(tasks)");
    const tNames = tCols.map(c => c.name);
    if (!tNames.includes("category"))   await db.execAsync("ALTER TABLE tasks ADD COLUMN category TEXT");
    if (!tNames.includes("uni_course")) await db.execAsync("ALTER TABLE tasks ADD COLUMN uni_course TEXT");

    const lCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(lists)");
    const lNames = lCols.map(c => c.name);
    if (!lNames.includes("items"))  await db.execAsync("ALTER TABLE lists ADD COLUMN items TEXT");
    if (!lNames.includes("pinned")) await db.execAsync("ALTER TABLE lists ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
  }

  if (current < 5) {
    const tCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(tasks)");
    const tNames = tCols.map(c => c.name);
    if (!tNames.includes("archived"))     await db.execAsync("ALTER TABLE tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
    if (!tNames.includes("completed_at")) await db.execAsync("ALTER TABLE tasks ADD COLUMN completed_at TEXT");
  }

  if (current < 6) {
    // v6: add type column to notes (was tracked in Supabase but never in SQLite,
    // causing postits to lose their type on native after every restart).
    const nCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(notes)");
    const nNames = nCols.map(c => c.name);
    if (!nNames.includes("type")) await db.execAsync("ALTER TABLE notes ADD COLUMN type TEXT NOT NULL DEFAULT 'note'");

    // Drop dead tables that were never used in app code.
    await db.execAsync(`
      DROP TABLE IF EXISTS sticky_notes;
      DROP TABLE IF EXISTS list_items;
    `);
  }

  if (current < SCHEMA_VERSION) {
    if (rows.length === 0) {
      await db.runAsync("INSERT INTO schema_version (version) VALUES (?)", SCHEMA_VERSION);
    } else {
      await db.runAsync("UPDATE schema_version SET version = ?", SCHEMA_VERSION);
    }
  }
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

export async function dbLoadTasks(): Promise<any[]> {
  const rows = await getDb().getAllAsync<Record<string, any>>(
    "SELECT * FROM tasks ORDER BY created_at ASC"
  );
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    done: !!r.done,
    archived: !!r.archived,
    due_date: r.due_date ?? undefined,
    priority: r.priority ?? undefined,
    description: r.description ?? undefined,
    tags: r.tags ? tryParse(r.tags) : undefined,
    subtasks: r.subtasks ? tryParse(r.subtasks) : undefined,
    category: r.category ?? undefined,
    uniCourse: r.uni_course ?? undefined,
    completed_at: r.completed_at ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

// ─── Save queue ───────────────────────────────────────────────────────────────
// Serialise writes per-table so concurrent saves can't interleave (a DELETE
// from save A landing after save B's writes used to nuke B's data). Coalesces
// pending saves by UNIONING their dirty/deleted sets — dropping the earlier
// request (the old behavior) would silently skip its rows now that saves are
// partial.

type SaveReq = {
  items: any[];
  dirtyIds: Set<string>;
  deletedIds: Set<string>;
  full: boolean;
};
type Writer = (req: SaveReq) => Promise<void>;
const queues: Record<string, { running: boolean; pending: { req: SaveReq; writer: Writer } | null }> = {};

function mergeReq(older: SaveReq, newer: SaveReq): SaveReq {
  return {
    items: newer.items, // latest snapshot wins
    dirtyIds: new Set([...older.dirtyIds, ...newer.dirtyIds]),
    deletedIds: new Set([...older.deletedIds, ...newer.deletedIds]),
    full: older.full || newer.full,
  };
}

function toReq(items: any[], changes?: SaveChanges): SaveReq {
  return {
    items,
    dirtyIds: new Set(changes?.dirtyIds ?? []),
    deletedIds: new Set(changes?.deletedIds ?? []),
    // No changes argument = legacy caller (first-install migration) → full save.
    full: changes ? changes.full : true,
  };
}

function enqueue(table: string, req: SaveReq, writer: Writer): void {
  const q = queues[table] ?? (queues[table] = { running: false, pending: null });
  if (q.running) {
    q.pending = q.pending
      ? { req: mergeReq(q.pending.req, req), writer }
      : { req, writer };
    return;
  }
  q.running = true;
  (async () => {
    let next: { req: SaveReq; writer: Writer } | null = { req, writer };
    while (next) {
      try { await next.writer(next.req); } catch (e) { console.error(`db save ${table}:`, e); }
      next = q.pending;
      q.pending = null;
    }
    q.running = false;
  })();
}

/** Shared write pass: full saves rewrite every row and prune rows missing from
 *  the in-memory set; partial saves touch only dirty rows + explicit deletes. */
async function runSave(
  table: string,
  req: SaveReq,
  upsertRow: (db: SQLite.SQLiteDatabase, item: any) => Promise<void>,
): Promise<void> {
  const db = getDb();
  const toWrite = req.full ? req.items : req.items.filter(i => req.dirtyIds.has(i.id));
  await db.withTransactionAsync(async () => {
    for (const item of toWrite) {
      try { await upsertRow(db, item); }
      catch (e) { console.warn(`dbSave ${table} row ${item.id}:`, e); }
    }
    if (req.full) {
      // Reconciliation: delete rows that disappeared from the in-memory set.
      const ids = new Set(req.items.map(i => i.id));
      const existing = await db.getAllAsync<{ id: string }>(`SELECT id FROM ${table}`);
      for (const row of existing) {
        if (!ids.has(row.id)) await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, row.id);
      }
    } else {
      for (const id of req.deletedIds) {
        await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, id);
      }
    }
  });
}

export async function dbSaveTasks(tasks: any[], changes?: SaveChanges): Promise<void> {
  enqueue("tasks", toReq(tasks, changes), (req) => runSave("tasks", req, async (db, t) => {
    await db.runAsync(
      `INSERT OR REPLACE INTO tasks
         (id,title,done,archived,completed_at,due_date,priority,description,tags,subtasks,recurrence,category,uni_course,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        t.id, t.title, t.done ? 1 : 0, t.archived ? 1 : 0, t.completed_at ?? null,
        t.due_date ?? null,
        t.priority ?? null, t.description ?? null,
        t.tags       ? JSON.stringify(t.tags)      : null,
        t.subtasks   ? JSON.stringify(t.subtasks)  : null,
        t.recurrence ?? null,
        t.category  ?? null, t.uniCourse ?? null,
        t.created_at, t.updated_at ?? t.created_at,
      ]
    );
  }));
}

export async function dbLoadLists(): Promise<any[]> {
  const rows = await getDb().getAllAsync<Record<string, any>>(
    "SELECT * FROM lists ORDER BY created_at ASC"
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    color: r.color,
    pinned: !!r.pinned,
    items: r.items ? tryParse(r.items) ?? [] : [],
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function dbSaveLists(lists: any[], changes?: SaveChanges): Promise<void> {
  enqueue("lists", toReq(lists, changes), (req) => runSave("lists", req, async (db, l) => {
    await db.runAsync(
      `INSERT OR REPLACE INTO lists (id,name,color,pinned,items,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
      [
        l.id, l.name, l.color, l.pinned ? 1 : 0,
        JSON.stringify(l.items ?? []),
        l.created_at, l.updated_at ?? l.created_at,
      ]
    );
  }));
}

export async function dbLoadNotes(): Promise<any[]> {
  const rows = await getDb().getAllAsync<Record<string, any>>(
    "SELECT * FROM notes ORDER BY created_at ASC"
  );
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    body: r.body,
    pinned: !!r.pinned,
    type: (r.type ?? "note") as "note" | "postit",
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function dbSaveNotes(notes: any[], changes?: SaveChanges): Promise<void> {
  enqueue("notes", toReq(notes, changes), (req) => runSave("notes", req, async (db, n) => {
    await db.runAsync(
      `INSERT OR REPLACE INTO notes (id,title,body,pinned,type,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
      [
        n.id, n.title ?? "", n.body ?? "", n.pinned ? 1 : 0,
        n.type ?? "note",
        n.created_at, n.updated_at ?? n.created_at,
      ]
    );
  }));
}
