/**
 * One pull timer for every synced collection.
 *
 * Each collection used to run its own 90-second interval. With six providers
 * mounted at the root that meant six timers started within a few milliseconds
 * of each other, so they stayed in phase and fired up to six concurrent
 * request bursts every 90s.
 *
 * The failure mode that made this worth fixing: a burst that partly fails
 * leaves one domain in `error` with nothing scheduled to clear it, because its
 * only retry was the next tick a full 90 seconds later — and if that domain
 * gets no further writes (Courses, typically, being the smallest and least
 * edited) the flag never clears at all. The header chip rolls up "Sync failed"
 * from any single domain, so one flaky moment on mobile data pinned it
 * indefinitely while every other collection synced fine.
 *
 * So: one heartbeat for the whole app, domains walked strictly serially, and a
 * failed domain retried with exponential backoff instead of waiting out a full
 * healthy cycle. A transient failure now self-heals in ~15s.
 */
import { AppState, Platform } from "react-native";

/** Runs one sync pass for a collection. Resolves false if the pass failed. */
type SyncTick = () => Promise<boolean>;

type Entry = {
  tick: SyncTick;
  /** Epoch ms at which this domain is next eligible to run. */
  nextDueAt: number;
  consecutiveFailures: number;
};

/** How often the heartbeat wakes to look for due domains. Deliberately much
 *  shorter than the healthy interval so backoff retries land promptly; one
 *  timer at this rate is still fewer wake-ups than six were at 90s. */
const HEARTBEAT_MS = 15_000;
/** Cadence for a domain whose last pass succeeded. */
const HEALTHY_INTERVAL_MS = 90_000;
/** First retry delay after a failure; doubles per consecutive failure. */
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS  = 120_000;

const entries = new Map<string, Entry>();
let heartbeat: ReturnType<typeof setInterval> | null = null;
let running = false;

function appIsActive(): boolean {
  if (Platform.OS === "web") {
    return typeof document === "undefined" || !document.hidden;
  }
  return AppState.currentState === "active";
}

function backoffMs(failures: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS);
}

async function runDue(): Promise<void> {
  // Re-entrancy guard. A pass slower than one heartbeat must not overlap the
  // next, or the serialisation this module exists to provide is lost.
  if (running) return;
  if (!appIsActive()) return;
  running = true;
  try {
    const now = Date.now();
    // Snapshot the registry: a provider can unmount mid-await.
    for (const [table, entry] of [...entries]) {
      if (!entries.has(table)) continue;
      if (entry.nextDueAt > now) continue;
      let ok: boolean;
      try {
        ok = await entry.tick();
      } catch {
        ok = false;
      }
      if (ok) {
        entry.consecutiveFailures = 0;
        entry.nextDueAt = Date.now() + HEALTHY_INTERVAL_MS;
      } else {
        entry.consecutiveFailures += 1;
        entry.nextDueAt = Date.now() + backoffMs(entry.consecutiveFailures);
      }
    }
  } finally {
    running = false;
  }
}

/**
 * Register a collection's pull pass. Returns an unregister function for the
 * effect cleanup; the heartbeat starts with the first domain and stops with
 * the last.
 */
export function registerSyncDomain(table: string, tick: SyncTick): () => void {
  entries.set(table, {
    tick,
    // No immediate pass: the collection's own initial load already syncs on
    // mount. First scheduled pass is one healthy interval out.
    nextDueAt: Date.now() + HEALTHY_INTERVAL_MS,
    consecutiveFailures: 0,
  });
  if (!heartbeat) heartbeat = setInterval(runDue, HEARTBEAT_MS);
  return () => {
    entries.delete(table);
    if (entries.size === 0 && heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };
}

/** Test/diagnostic view of the schedule. Not used by the app. */
export function __schedulerState() {
  return [...entries].map(([table, e]) => ({
    table,
    dueInMs: e.nextDueAt - Date.now(),
    consecutiveFailures: e.consecutiveFailures,
  }));
}
