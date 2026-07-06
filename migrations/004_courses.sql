-- Migration 004: courses table (checkbox progress tables, synced domain)
--
-- Applied to production 2026-07-05 via MCP apply_migration.
--
-- NOTE: a `courses` table already existed from a pre-sync-key iteration of
-- the app (columns id/data/updated_at only, one legacy row `cd-main` from
-- 2026-03). This migration is therefore ADDITIVE: it brings the table up to
-- the same shape as tasks/notes/lists/dumps. The legacy row keeps
-- sync_key = NULL, so it is invisible to the sync protocol (every fetch
-- filters on sync_key) and intentionally left in place.

CREATE TABLE IF NOT EXISTS courses (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sync_key text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS courses_sync_key_idx ON courses (sync_key);
CREATE INDEX IF NOT EXISTS courses_sync_updated_idx ON courses (sync_key, updated_at);
DROP TRIGGER IF EXISTS courses_set_updated_at ON courses;
CREATE TRIGGER courses_set_updated_at BEFORE INSERT OR UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
