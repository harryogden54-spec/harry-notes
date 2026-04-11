import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync("harry-notes.db");
  }
  return _db;
}

const SCHEMA_VERSION = 3;

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

  if (current < SCHEMA_VERSION) {
    if (rows.length === 0) {
      await db.runAsync("INSERT INTO schema_version (version) VALUES (?)", SCHEMA_VERSION);
    } else {
      await db.runAsync("UPDATE schema_version SET version = ?", SCHEMA_VERSION);
    }
  }
}
