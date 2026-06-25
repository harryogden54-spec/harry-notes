CREATE TABLE IF NOT EXISTS dumps (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  sync_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS dumps_sync_key_idx ON dumps (sync_key);
CREATE INDEX IF NOT EXISTS dumps_sync_updated_idx ON dumps (sync_key, updated_at);
CREATE TRIGGER dumps_set_updated_at BEFORE INSERT OR UPDATE ON dumps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
