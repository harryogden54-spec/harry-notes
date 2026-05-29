import { createClient } from "@supabase/supabase-js";

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
  try {
    const { data, error } = await supabase
      .from(table)
      .select("id, data, updated_at");
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
  // CLOCK-SKEW TODO: we currently stamp updated_at from the client clock.
  // If two devices have skewed clocks, LWW can silently drop edits.
  // Fix: remove updated_at from rows below and add a Postgres trigger on each
  // table that sets updated_at = now() on INSERT/UPDATE. Then syncFetch's
  // _updated_at will always be a server timestamp and ordering will be correct.
  // Requires a Supabase migration before the client change lands.
  const rows = items.map(item => ({
    id: item.id,
    data: item,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) { console.warn(`syncUpsert ${table}:`, error.message); return false; }
  return true;
}

export async function syncDelete(table: string, id: string): Promise<boolean> {
  if (!SYNC_ENABLED) return true;
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) { console.warn(`syncDelete ${table}:`, error.message); return false; }
  return true;
}
