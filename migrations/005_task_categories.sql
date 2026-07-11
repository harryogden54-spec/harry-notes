CREATE TABLE IF NOT EXISTS task_categories (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  sync_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS task_categories_sync_key_idx ON task_categories (sync_key);
CREATE INDEX IF NOT EXISTS task_categories_sync_updated_idx ON task_categories (sync_key, updated_at);
CREATE TRIGGER task_categories_set_updated_at BEFORE INSERT OR UPDATE ON task_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
