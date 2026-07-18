import { createClient } from "@supabase/supabase-js";
import { getSyncKey, getCachedSyncKey } from "./syncKey";

// Values are inlined by Metro at build time from .env (EXPO_PUBLIC_* prefix).
// Fail loudly if missing so a misconfigured build surfaces immediately rather
// than silently syncing to the wrong project or exposing credentials in source.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// True only when real credentials are present — guards all sync helpers below.
export const SYNC_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!SYNC_ENABLED) {
  console.warn(
    "[supabase] EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. " +
    "Running in offline mode. Copy .env.example to .env and fill in your project credentials."
  );
}

export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder",
  {
    global: {
      // Every request carries the sync key as a header so the RLS policies
      // (migrations/007_rls_sync_key.sql) can scope rows to it — the anon key
      // alone grants nothing. The cache is always warm here: every helper in
      // this file awaits getSyncKey() before issuing a request.
      fetch: (input: any, init?: any) => {
        const key = getCachedSyncKey();
        const headers = new Headers(init?.headers);
        if (key) headers.set("x-sync-key", key);
        return fetch(input, { ...init, headers });
      },
    },
  }
);

// Upserts are chunked so a large dirty set (e.g. first-device bootstrap) can't
// produce one oversized POST that times out on a slow connection.
const UPSERT_CHUNK_SIZE = 100;

// Conflict target for upserts. (id, sync_key) — not id alone — so the same id
// can exist under different sync keys (fixed seeded ids like task_categories
// "personal"/"uni", and re-uploading a whole dataset after a key rotation).
// Requires the unique constraint from migrations/009_composite_upsert_index.sql.
const UPSERT_ON_CONFLICT = "id,sync_key";

// PostgREST caps responses at db_max_rows (1000 by default) and silently
// truncates beyond it — page explicitly so a large table can't lose rows.
const FETCH_PAGE_SIZE = 1000;
const FETCH_MAX_PAGES = 30;

// Result type so callers can distinguish "remote is empty" from "fetch failed".
// The previous shape (returning [] on error) caused contexts to mistake a
// network blip for an empty remote and re-upload the entire local store.
export type FetchResult<T> =
  | { ok: true; rows: T[]; deletedIds: string[]; serverMax: string | null }
  | { ok: false; error: string };

const EMPTY_OK: { ok: true; rows: never[]; deletedIds: never[]; serverMax: null } =
  { ok: true, rows: [], deletedIds: [], serverMax: null };

/**
 * Fetch rows for this sync key. With `sinceIso` set, only rows the server
 * touched after that timestamp are returned (incremental delta); without it,
 * the full table slice is returned (reconciliation path).
 *
 * Returns live rows, tombstoned ids, and `serverMax` — the highest server
 * updated_at seen, which the caller persists as the next delta cursor.
 * Timestamps are always server-clock (set_updated_at trigger), so the cursor
 * is immune to client clock skew.
 */
export async function syncFetch<T extends { id: string }>(
  table: string,
  sinceIso?: string | null
): Promise<FetchResult<T>> {
  if (!SYNC_ENABLED) return EMPTY_OK;

  // No sync key = device hasn't been set up for sync yet → offline mode.
  const syncKey = await getSyncKey();
  if (!syncKey) return EMPTY_OK;

  try {
    // Paged fetch with a stable order — without an explicit order + range,
    // PostgREST returns an arbitrary 1000-row slice and the rest silently
    // never syncs. Rows written between page requests are caught by the next
    // delta (the cursor advances only to what we actually saw).
    const all: any[] = [];
    for (let page = 0; page < FETCH_MAX_PAGES; page++) {
      const from = page * FETCH_PAGE_SIZE;
      let query = supabase
        .from(table)
        .select("id, data, updated_at, deleted")
        .eq("sync_key", syncKey)
        .order("updated_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + FETCH_PAGE_SIZE - 1);
      if (sinceIso) query = query.gt("updated_at", sinceIso);
      const { data, error } = await query;
      if (error) {
        console.warn(`syncFetch ${table}:`, error.message);
        return { ok: false, error: error.message };
      }
      all.push(...(data ?? []));
      if (!data || data.length < FETCH_PAGE_SIZE) break;
    }

    const rows: T[] = [];
    const deletedIds: string[] = [];
    let serverMax: string | null = null;
    for (const row of all as any[]) {
      if (typeof row.updated_at === "string" && (!serverMax || row.updated_at > serverMax)) {
        serverMax = row.updated_at;
      }
      if (row.deleted) deletedIds.push(row.id);
      else rows.push({ ...row.data, _updated_at: row.updated_at } as T);
    }
    return { ok: true, rows, deletedIds, serverMax };
  } catch (e: any) {
    console.warn(`syncFetch ${table}: network error`, e);
    return { ok: false, error: e?.message ?? "network error" };
  }
}

export async function syncUpsert<T extends { id: string }>(
  table: string,
  items: T[]
): Promise<boolean> {
  if (!SYNC_ENABLED) return true;
  if (items.length === 0) return true;

  // No sync key → offline mode.
  const syncKey = await getSyncKey();
  if (!syncKey) return true;

  // Note: updated_at is intentionally NOT set here. A Postgres trigger on each
  // table sets updated_at = now() server-side on INSERT/UPDATE, so all devices
  // compare against a common server clock rather than skewed client clocks.
  // See migrations/001_sync_key_and_server_timestamps.sql
  //
  // deleted: false resurrects a tombstoned row when the user undoes a delete
  // (or edits a row another device removed).
  const rows = items.map(item => ({
    id: item.id,
    data: item,
    sync_key: syncKey,
    deleted: false,
  }));
  let allOk = true;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: UPSERT_ON_CONFLICT });
    if (error) {
      // One rejected row (e.g. an RLS violation) fails the whole chunk POST.
      // Retry row-by-row so a single poisoned row can't block every other
      // row in the domain from ever syncing.
      console.warn(`syncUpsert ${table} chunk failed, retrying per-row:`, error.message);
      for (const row of chunk) {
        const { error: rowErr } = await supabase
          .from(table)
          .upsert([row], { onConflict: UPSERT_ON_CONFLICT });
        if (rowErr) {
          allOk = false;
          console.warn(`syncUpsert ${table} row ${row.id}:`, rowErr.message);
        }
      }
    }
  }
  return allOk;
}

/**
 * Tombstone delete: an upsert with deleted=true rather than a row DELETE, so
 * the server stamps it with updated_at = now() and other devices learn about
 * the deletion through the incremental fetch. The data blob is reduced to a
 * stub; the row itself stays visible server-side for debugging.
 * See migrations/002_tombstones_and_delta_index.sql
 */
export async function syncDelete(table: string, id: string): Promise<boolean> {
  if (!SYNC_ENABLED) return true;

  const syncKey = await getSyncKey();
  if (!syncKey) return true;

  const { error } = await supabase
    .from(table)
    .upsert([{ id, data: { id }, sync_key: syncKey, deleted: true }], { onConflict: UPSERT_ON_CONFLICT });
  if (error) { console.warn(`syncDelete ${table}:`, error.message); return false; }
  return true;
}
