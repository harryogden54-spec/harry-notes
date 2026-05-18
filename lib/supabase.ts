import { createClient } from "@supabase/supabase-js";

// Values are inlined by Metro at build time from .env (EXPO_PUBLIC_* prefix).
// Hard-coded fallback ensures the app loads even if the build didn't pick up the file.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://vbegnnwyrbxiqdnzvhwk.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_vu8Trd9OjPINvclyAtQ8-w_x2ZdahXp";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Result type so callers can distinguish "remote is empty" from "fetch failed".
// The previous shape (returning [] on error) caused contexts to mistake a
// network blip for an empty remote and re-upload the entire local store.
export type FetchResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; error: string };

export async function syncFetch<T extends { id: string }>(
  table: string
): Promise<FetchResult<T>> {
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
  if (items.length === 0) return true;
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
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) { console.warn(`syncDelete ${table}:`, error.message); return false; }
  return true;
}
