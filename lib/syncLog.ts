/**
 * Recent sync failures, kept so the UI can say *why* a sync failed.
 *
 * Every failure path in lib/supabase.ts already console.warn'd its error and
 * then dropped it: the helpers return `false` / `{ ok: false }` and the engine
 * turns that into a bare "error" status. On the primary device — an iOS
 * home-screen PWA — there is no console to read, so "Sync failed" was a dead
 * end with nothing to act on. This keeps the message.
 *
 * In-memory only, and deliberately so: a failing domain retries on the sync
 * scheduler's backoff, so the log refills within seconds of the app opening.
 * Persisting it would mean writing to storage on exactly the paths that are
 * already unhealthy.
 */
import { useSyncExternalStore } from "react";

export type SyncOp = "fetch" | "fetchByIds" | "upsert" | "delete";

export type SyncFailure = {
  table: string;
  op: SyncOp;
  message: string;
  /** ISO timestamp — client clock; this is diagnostics, not sync data. */
  at: string;
};

/** Small enough that a flapping domain can't crowd out the others. */
const MAX_ENTRIES = 20;

let failures: readonly SyncFailure[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function recordSyncFailure(table: string, op: SyncOp, message: string): void {
  failures = [{ table, op, message, at: new Date().toISOString() }, ...failures].slice(0, MAX_ENTRIES);
  emit();
}

/** Drop everything, or just one table's entries. */
export function clearSyncFailures(table?: string): void {
  failures = table ? failures.filter(f => f.table !== table) : [];
  emit();
}

/** Stable reference between mutations — safe as a useSyncExternalStore snapshot. */
export function getSyncFailures(): readonly SyncFailure[] {
  return failures;
}

export function lastFailureFor(table: string): SyncFailure | null {
  return failures.find(f => f.table === table) ?? null;
}

export function subscribeSyncFailures(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/**
 * Re-render on new failures. Failures are recorded from inside the sync
 * helpers, which is not always a React update — a domain can go from healthy to
 * failing without any state the reading component already subscribes to.
 */
export function useSyncFailures(): readonly SyncFailure[] {
  return useSyncExternalStore(subscribeSyncFailures, getSyncFailures, getSyncFailures);
}
