CREATE TABLE IF NOT EXISTS today_items (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  sync_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS today_items_sync_key_idx ON today_items (sync_key);
CREATE INDEX IF NOT EXISTS today_items_sync_updated_idx ON today_items (sync_key, updated_at);
CREATE TRIGGER today_items_set_updated_at BEFORE INSERT OR UPDATE ON today_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
