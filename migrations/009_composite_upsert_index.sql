-- 009: unique (id, sync_key) on every synced table, so the client can upsert
-- with on_conflict=id,sync_key. Additive: the old id-only PK stays for now
-- (older deployed clients still send on_conflict=id), and is removed by 010
-- AFTER the new client is deployed. Applied live 2026-07-18.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tasks','lists','notes','dumps','courses','task_categories','today_items']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (id, sync_key)', t, t || '_id_sync_key_key');
  END LOOP;
END $$;
