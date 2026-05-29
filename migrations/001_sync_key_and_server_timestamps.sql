-- Migration 001: sync_key column + server-side updated_at timestamps
--
-- Run this in your Supabase project → SQL Editor.
--
-- What this does:
--   1. Adds a `sync_key` column to tasks, notes, and lists tables so each
--      device's data is isolated by the user's chosen key (no login required).
--   2. Adds an index on sync_key for fast filtered fetches.
--   3. Adds a BEFORE trigger on each table so updated_at is always set to
--      the server clock on insert/update — fixing the client-clock-skew LWW
--      issue where two devices with different clocks could silently drop edits.
--
-- After running this:
--   • Run the backfill UPDATE below with your sync key to adopt existing data.
--   • Add the same sync key on every device (Settings → Sync → Sync Key).
--
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add sync_key column (nullable so existing rows aren't blocked)
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS sync_key text;
ALTER TABLE notes  ADD COLUMN IF NOT EXISTS sync_key text;
ALTER TABLE lists  ADD COLUMN IF NOT EXISTS sync_key text;

-- 2. Index for filtered fetches
CREATE INDEX IF NOT EXISTS tasks_sync_key_idx  ON tasks  (sync_key);
CREATE INDEX IF NOT EXISTS notes_sync_key_idx  ON notes  (sync_key);
CREATE INDEX IF NOT EXISTS lists_sync_key_idx  ON lists  (sync_key);

-- 3. Server-side updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach trigger to each table (replace if exists for idempotency)
DROP TRIGGER IF EXISTS tasks_set_updated_at ON tasks;
CREATE TRIGGER tasks_set_updated_at
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS notes_set_updated_at ON notes;
CREATE TRIGGER notes_set_updated_at
  BEFORE INSERT OR UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS lists_set_updated_at ON lists;
CREATE TRIGGER lists_set_updated_at
  BEFORE INSERT OR UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL (run after choosing your sync key in the app)
--
-- Replace 'YOUR-SYNC-KEY-HERE' with the key you set in Settings → Sync.
-- This adopts your existing rows so they're visible on all your devices.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- UPDATE tasks  SET sync_key = 'YOUR-SYNC-KEY-HERE' WHERE sync_key IS NULL;
-- UPDATE notes  SET sync_key = 'YOUR-SYNC-KEY-HERE' WHERE sync_key IS NULL;
-- UPDATE lists  SET sync_key = 'YOUR-SYNC-KEY-HERE' WHERE sync_key IS NULL;
