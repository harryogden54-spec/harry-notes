import { createClient } from "@supabase/supabase-js";
import { getSyncKey } from "./syncKey";

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
  SUPABASE_ANON_KEY || "placeholder"
);

// Result type so callers can distinguish "remote is empty" from "fetch failed".
// The previous shape (returning [] on error) caused contexts to mistake a
// network blip for an empty remote and re-upload the entire local store.
export type FetchResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; error: string };

export async function syncFetch<T extends { id: string }>(
  table: string
): Promise<FetchResult<T>> {
  if (!SYNC_ENABLED) return { ok: true, rows: [] };

  // No sync key = device hasn't been set up for sync yet → offline mode.
  const syncKey = await getSyncKey();
  if (!syncKey) return { ok: true, rows: [] };

  try {
    const { data, error } = await supabase
      .from(table)
      .select("id, data, updated_at")
      .eq("sync_key", syncKey);
    if (error) {
      console.warn(`syncFetch ${table}:`, error.message);
      return { ok: false, error: error.message };
    }
    const rows = (data ?? []).map((row: any) => ({ ...row.data, _updated_at: row.updated_at })) as T[];
    return { ok: true, rows };
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
  const rows = items.map(item => ({
    id: item.id,
    data: item,
    sync_key: syncKey,
  }));
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) { console.warn(`syncUpsert ${table}:`, error.message); return false; }
  return true;
}

export async function syncDelete(table: string, id: string): Promise<boolean> {
  if (!SYNC_ENABLED) return true;

  const syncKey = await getSyncKey();
  if (!syncKey) return true;

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("sync_key", syncKey);
  if (error) { console.warn(`syncDelete ${table}:`, error.message); return false; }
  return true;
}
