import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://vbegnnwyrbxiqdnzvhwk.supabase.co",
  "sb_publishable_vu8Trd9OjPINvclyAtQ8-w_x2ZdahXp"
);

// Generic helpers for the id/data/updated_at schema

export async function syncFetch<T extends { id: string }>(
  table: string
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, data, updated_at");
  if (error) { console.warn(`syncFetch ${table}:`, error.message); return []; }
  return (data ?? []).map((row: any) => ({ ...row.data, _updated_at: row.updated_at })) as T[];
}

export async function syncUpsert<T extends { id: string }>(
  table: string,
  items: T[]
): Promise<void> {
  if (items.length === 0) return;
  const rows = items.map(item => ({
    id: item.id,
    data: item,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) console.warn(`syncUpsert ${table}:`, error.message);
}

export async function syncDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) console.warn(`syncDelete ${table}:`, error.message);
}
