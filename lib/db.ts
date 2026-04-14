import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync("harry-notes.db");
  }
  return _db;
}

const SCHEMA_VERSION = 4;

export async function initDb(): Promise<void> {
  const db = getDb();

  // Create tables
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      done        INTEGER NOT NULL DEFAULT 0,
      due_date    TEXT,
      priority    TEXT,
      description TEXT,
      tags        TEXT,
      subtasks    TEXT,
      recurrence  TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lists (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      color       TEXT NOT NULL DEFAULT '#4A90D9',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS list_items (
      id          TEXT PRIMARY KEY,
      list_id     TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      content     TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'bullet',
      done        INTEGER NOT NULL DEFAULT 0,
      url         TEXT,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT '',
      body        TEXT NOT NULL DEFAULT '',
      pinned      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sticky_notes (
      id         TEXT PRIMARY KEY,
      content    TEXT NOT NULL DEFAULT '',
      colour     TEXT NOT NULL DEFAULT '#88C0D0',
      createdAt  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
    CREATE INDEX IF NOT EXISTS idx_tasks_due  ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id);
  `);

  // Run migrations for existing installs
  const rows = await db.getAllAsync<{ version: number }>("SELECT version FROM schema_version LIMIT 1");
  const current = rows[0]?.version ?? 0;

  if (current < 1) {
    // v1: add missing columns to tasks if upgrading from bare schema
    const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(tasks)");
    const names = cols.map(c => c.name);
    if (!names.includes("priority"))    await db.execAsync("ALTER TABLE tasks ADD COLUMN priority TEXT");
    if (!names.includes("description")) await db.execAsync("ALTER TABLE tasks ADD COLUMN description TEXT");
    if (!names.includes("tags"))        await db.execAsync("ALTER TABLE tasks ADD COLUMN tags TEXT");
    if (!names.includes("subtasks"))    await db.execAsync("ALTER TABLE tasks ADD COLUMN subtasks TEXT");
    if (!names.includes("recurrence"))  await db.execAsync("ALTER TABLE tasks ADD COLUMN recurrence TEXT");
  }

  if (current < 2) {
    // v2: notes table (already in CREATE TABLE IF NOT EXISTS above)
  }

  if (current < 3) {
    // v3: sticky_notes table (already in CREATE TABLE IF NOT EXISTS above)
    // Ensure the table exists in case we're running against an older DB that skipped the CREATE
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sticky_notes (
        id         TEXT PRIMARY KEY,
        content    TEXT NOT NULL DEFAULT '',
        colour     TEXT NOT NULL DEFAULT '#88C0D0',
        createdAt  TEXT NOT NULL
      );
    `);
  }

  if (current < 4) {
    // v4: add category/uni_course to tasks; add items JSON + pinned to lists
    const tCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(tasks)");
    const tNames = tCols.map(c => c.name);
    if (!tNames.includes("category"))  await db.execAsync("ALTER TABLE tasks ADD COLUMN category TEXT");
    if (!tNames.includes("uni_course")) await db.execAsync("ALTER TABLE tasks ADD COLUMN uni_course TEXT");

    const lCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(lists)");
    const lNames = lCols.map(c => c.name);
    if (!lNames.includes("items"))  await db.execAsync("ALTER TABLE lists ADD COLUMN items TEXT");
    if (!lNames.includes("pinned")) await db.execAsync("ALTER TABLE lists ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
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
    due_date: r.due_date ?? undefined,
    priority: r.priority ?? undefined,
    description: r.description ?? undefined,
    tags: r.tags ? JSON.parse(r.tags) : undefined,
    subtasks: r.subtasks ? JSON.parse(r.subtasks) : undefined,
    category: r.category ?? undefined,
    uniCourse: r.uni_course ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function dbSaveTasks(tasks: any[]): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM tasks");
    for (const t of tasks) {
      await db.runAsync(
        `INSERT INTO tasks
           (id,title,done,due_date,priority,description,tags,subtasks,recurrence,category,uni_course,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          t.id, t.title, t.done ? 1 : 0, t.due_date ?? null,
          t.priority ?? null, t.description ?? null,
          t.tags      ? JSON.stringify(t.tags)     : null,
          t.subtasks  ? JSON.stringify(t.subtasks) : null,
          null,
          t.category  ?? null, t.uniCourse ?? null,
          t.created_at, t.updated_at ?? t.created_at,
        ]
      );
    }
  });
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
    items: r.items ? JSON.parse(r.items) : [],
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function dbSaveLists(lists: any[]): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM lists");
    for (const l of lists) {
      await db.runAsync(
        `INSERT INTO lists (id,name,color,pinned,items,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
        [
          l.id, l.name, l.color, l.pinned ? 1 : 0,
          JSON.stringify(l.items ?? []),
          l.created_at, l.updated_at ?? l.created_at,
        ]
      );
    }
  });
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
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function dbSaveNotes(notes: any[]): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM notes");
    for (const n of notes) {
      await db.runAsync(
        `INSERT INTO notes (id,title,body,pinned,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
        [
          n.id, n.title ?? "", n.body ?? "", n.pinned ? 1 : 0,
          n.created_at, n.updated_at ?? n.created_at,
        ]
      );
    }
  });
}
