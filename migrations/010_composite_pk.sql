-- 010: replace the global id-only primary key with (id, sync_key) on every
-- synced table. With id as sole PK, the same id cannot exist under two sync
-- keys — which permanently breaks:
--   * task_categories: ids "personal"/"uni" are seeded identically for every
--     key, so only the FIRST key to sync can ever own them; every other key
--     gets an RLS violation on upsert forever.
--   * key rotation: after Settings → Generate new key, the bootstrap re-upload
--     collides on every id still stored under the old key.
--
-- ⚠️ ORDER MATTERS: apply this ONLY AFTER the client that upserts with
-- on_conflict=id,sync_key (lib/supabase.ts UPSERT_ON_CONFLICT, 2026-07-18) is
-- deployed. Older clients send on_conflict=id, which needs the id-only unique
-- constraint this migration drops. (Migration 009 added the (id, sync_key)
-- unique constraint first, so old and new clients both work in between.)
--
-- Prereq: no NULL sync_key rows may remain (PK columns are NOT NULL). The 7
-- legacy NULL-key rows were claimed for the active key on 2026-07-18.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tasks','lists','notes','dumps','courses','task_categories','today_items']
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN sync_key SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, t || '_pkey');
    EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id, sync_key)', t);
    -- The 009 unique constraint is now redundant with the PK.
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, t || '_id_sync_key_key');
  END LOOP;
END $$;
