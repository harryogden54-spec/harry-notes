-- Migration 002: tombstone deletes + delta-fetch index
--
-- Run in Supabase project → SQL Editor (or via MCP apply_migration).
--
-- What this does:
--   1. Adds a `deleted` tombstone column to tasks/notes/lists. Deletes become
--      upserts with deleted=true, so the set_updated_at() trigger stamps them
--      with a server timestamp and other devices pick them up through the
--      incremental (since-cursor) fetch. Hard DELETEs are invisible to a
--      delta protocol — tombstones are what make incremental sync correct.
--      Bonus: an accidental delete is recoverable server-side.
--   2. Adds a composite (sync_key, updated_at) index so the delta query
--      `WHERE sync_key = ? AND updated_at > ?` is an index range scan.
--
-- Backwards compatibility: older deployed clients select id/data/updated_at
-- (they ignore `deleted`) and still hard-delete — both remain valid against
-- this schema. Apply this migration BEFORE deploying the delta-sync client.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tombstone column (additive, defaulted — no data rewrite)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

-- 2. Composite index for delta fetches
CREATE INDEX IF NOT EXISTS tasks_sync_updated_idx ON tasks (sync_key, updated_at);
CREATE INDEX IF NOT EXISTS notes_sync_updated_idx ON notes (sync_key, updated_at);
CREATE INDEX IF NOT EXISTS lists_sync_updated_idx ON lists (sync_key, updated_at);
