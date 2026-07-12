-- Row Level Security, keyed on the sync key.
--
-- The web bundle inlines the anon key, so before this migration anyone who
-- extracted it could read/write every row. Now the client sends its sync key
-- as an `x-sync-key` request header (lib/supabase.ts custom fetch), and each
-- policy only exposes rows whose sync_key matches that header. The anon key
-- alone grants nothing; the sync key is the real capability token, and it
-- never appears in the bundle (entered per device, stored locally).
--
-- ORDER MATTERS: deploy a client that sends the header BEFORE applying this,
-- or live devices lose sync until they pick up the new bundle.
--
-- Legacy pre-sync-key tables (deadlines, settings, habits, selling, archive)
-- get RLS with no policies: fully locked at the API, still reachable from the
-- SQL editor / service role if that data is ever wanted again.

CREATE OR REPLACE FUNCTION request_sync_key() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.headers', true)::json->>'x-sync-key'
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tasks','lists','notes','dumps','courses','task_categories','today_items']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS sync_key_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY sync_key_all ON %I FOR ALL TO anon, authenticated
         USING (sync_key IS NOT DISTINCT FROM request_sync_key() AND request_sync_key() IS NOT NULL)
         WITH CHECK (sync_key IS NOT DISTINCT FROM request_sync_key() AND request_sync_key() IS NOT NULL)',
      t
    );
  END LOOP;

  FOREACH t IN ARRAY ARRAY['deadlines','settings','habits','selling','archive']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
