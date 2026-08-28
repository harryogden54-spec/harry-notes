/**
 * One-time rewrite of every synced row, so data written before encryption was
 * turned on stops sitting in Supabase as readable text.
 *
 * Why this is not just `syncNow({ full: true })`: that path's upload branch
 * only pushes rows the server does not already have, or that are locally newer
 * (see the `toUpsert` filter in useSyncedCollection). Every already-synced row
 * is therefore skipped — which is correct for syncing and useless for
 * re-encrypting, because those are exactly the rows still in plaintext.
 *
 * So this reads each domain's local mirror and force-upserts the lot.
 * `syncUpsert` encrypts at its own boundary (lib/supabase.ts), so nothing here
 * needs to know how encryption works — it only has to make the writes happen.
 *
 * Idempotent: running it twice just rewrites the same rows with fresh nonces.
 */

import { storage } from "./storage";
import { syncUpsert, SYNC_ENABLED } from "./supabase";
import { getSyncKey } from "./syncKey";
import { cryptoAvailable, encryptionEnabled } from "./crypto";

/** Local storage key → Supabase table. They match today, but not by law. */
const DOMAINS: { storageKey: string; table: string; label: string }[] = [
  { storageKey: "tasks",            table: "tasks",            label: "Tasks" },
  { storageKey: "notes",            table: "notes",            label: "Notes" },
  { storageKey: "dumps",            table: "dumps",            label: "Dumps" },
  { storageKey: "courses",          table: "courses",          label: "Courses" },
  { storageKey: "task_categories",  table: "task_categories",  label: "Categories" },
  { storageKey: "today_items",      table: "today_items",      label: "Today" },
];

export type ReEncryptResult = {
  ok: boolean;
  /** rows rewritten, per domain label */
  counts: Record<string, number>;
  /** domain labels whose upload failed */
  failed: string[];
  /** set when the whole run was refused before touching anything */
  refused?: string;
};

export async function reEncryptAll(): Promise<ReEncryptResult> {
  const counts: Record<string, number> = {};
  const failed: string[] = [];

  if (!SYNC_ENABLED) return { ok: false, counts, failed, refused: "Sync is not configured." };
  if (!cryptoAvailable()) return { ok: false, counts, failed, refused: "This device cannot encrypt (no WebCrypto)." };
  if (!(await getSyncKey())) return { ok: false, counts, failed, refused: "Set a sync key first." };
  // Guard rather than assume: if the flag is off, syncUpsert would faithfully
  // rewrite every row as PLAINTEXT — turning a "secure my data" button into a
  // bulk decrypt.
  if (!(await encryptionEnabled())) return { ok: false, counts, failed, refused: "Turn on encryption first." };

  for (const { storageKey, table, label } of DOMAINS) {
    const items = (await storage.get<{ id: string }[]>(storageKey)) ?? [];
    counts[label] = items.length;
    if (items.length === 0) continue;
    const ok = await syncUpsert(table, items);
    if (!ok) failed.push(label);
  }

  return { ok: failed.length === 0, counts, failed };
}
