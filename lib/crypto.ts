/**
 * Encryption at rest for synced rows.
 *
 * WHAT THIS PROTECTS AGAINST, AND WHAT IT DOES NOT
 *
 * Protects: anyone who obtains the contents of the Supabase database — a
 * backup, a dump, a leaked connection string, a misconfigured policy. They get
 * ciphertext.
 *
 * Does NOT protect against Supabase itself, or anyone who can read request
 * headers in transit or in logs. The key is derived from the sync key, and the
 * sync key is sent to Supabase on every request as `x-sync-key` (that is how
 * the RLS policies scope rows). This is encryption at rest, deliberately, NOT
 * end-to-end encryption. A separate passphrase never sent to the server would
 * be true E2E; it was weighed and rejected because it has to be typed on every
 * device and forgetting it destroys everything.
 *
 * Also NOT covered: note images. They live in the public `note-images` Supabase
 * Storage bucket at guessable URLs, and nothing here touches them.
 *
 * CONSEQUENCE, stated plainly: once rows are encrypted, the sync key is the
 * only way back to the data. Today losing it means you cannot FIND your rows;
 * after this it means they are gone. There is no recovery path.
 *
 * WHY PBKDF2 AND NOT HKDF
 *
 * A sync key is `XXXX-XXXX-XXXX` over a 32-character alphabet — twelve random
 * characters, about 60 bits. HKDF is a fast derivation, so an attacker holding
 * a dump could grind the whole keyspace. PBKDF2 with a high iteration count
 * makes each guess expensive. 600k iterations is the OWASP 2023 figure for
 * PBKDF2-HMAC-SHA256. It is paid once per session, not per row.
 *
 * The salt is a fixed application constant rather than a random per-user value.
 * That is a real (if modest) weakening — it permits a precomputed attack
 * against this specific app — but the salt must be identical on every device
 * that shares a sync key, and there is nowhere to put a shared random salt that
 * the server cannot also read. Documented rather than hidden.
 */

import { storage } from "./storage";

const PBKDF2_ITERATIONS = 600_000;
const SALT = new TextEncoder().encode("harry-notes/enc/v1");
const IV_BYTES = 12; // AES-GCM standard nonce length.

/** Marker on an encrypted payload. Rows without it are read as plaintext. */
const ENVELOPE_VERSION = 1;

export type EncryptedEnvelope = {
  __enc: typeof ENVELOPE_VERSION;
  /** base64 nonce */
  iv: string;
  /** base64 ciphertext (includes the GCM auth tag) */
  ct: string;
};

/** True when this runtime can do AES-GCM. Web only — Hermes has no SubtleCrypto. */
export function cryptoAvailable(): boolean {
  return typeof globalThis.crypto !== "undefined"
    && typeof globalThis.crypto.subtle !== "undefined"
    && typeof globalThis.crypto.subtle.importKey === "function";
}

export function isEncrypted(data: unknown): data is EncryptedEnvelope {
  return !!data
    && typeof data === "object"
    && (data as any).__enc === ENVELOPE_VERSION
    && typeof (data as any).iv === "string"
    && typeof (data as any).ct === "string";
}

// ─── base64 (no Buffer, no atob edge cases with large inputs) ────────────────

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000; // avoid blowing the argument limit on a long note
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

// Backed by an explicit ArrayBuffer: `BufferSource` (what SubtleCrypto takes)
// excludes SharedArrayBuffer-backed views, and a bare `Uint8Array` is typed as
// ArrayBufferLike, which includes them.
function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── Key derivation ──────────────────────────────────────────────────────────

// Cached per sync key so a key change (or rotation) re-derives rather than
// silently encrypting the new dataset under the old key.
let _cachedFor: string | null = null;
let _cachedKey: Promise<CryptoKey> | null = null;

export function deriveKey(syncKey: string): Promise<CryptoKey> {
  if (_cachedFor === syncKey && _cachedKey) return _cachedKey;
  _cachedFor = syncKey;
  _cachedKey = (async () => {
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(syncKey),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: SALT, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  })();
  _cachedKey.catch(() => { _cachedFor = null; _cachedKey = null; });
  return _cachedKey;
}

/** Drop the cached key — call when the sync key changes. */
export function resetKeyCache(): void {
  _cachedFor = null;
  _cachedKey = null;
}

// ─── Encrypt / decrypt a row payload ─────────────────────────────────────────

export async function encryptJson(value: unknown, syncKey: string): Promise<EncryptedEnvelope> {
  const key = await deriveKey(syncKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { __enc: ENVELOPE_VERSION, iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

/**
 * Decrypt a payload. Returns the parsed object, or `null` if it cannot be read.
 *
 * A null return is a real possibility in normal use — rows written under a
 * previous sync key are undecryptable by construction — so callers must skip
 * such rows rather than treating it as a fatal sync error. Throwing here would
 * fail the whole fetch and pin the domain at `error`, which is the same failure
 * shape as the stranded tombstone that pinned Courses.
 */
export async function decryptJson<T>(envelope: EncryptedEnvelope, syncKey: string): Promise<T | null> {
  try {
    const key = await deriveKey(syncKey);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.ct)
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

// ─── The on/off preference ───────────────────────────────────────────────────
//
// Deliberately asymmetric, and this is the part that makes rollout safe:
//
//   DECRYPTION is always on. Any row carrying the envelope is decrypted
//   whatever this flag says.
//   ENCRYPTION on write is what the flag gates.
//
// So a device that has not enabled it yet still reads everything an enabled
// device wrote, and turning it on is not a coordinated fleet-wide switch. If
// the flag gated reads too, enabling it on one device would make every other
// device see garbage until each was individually updated.

const PREF_KEY = "encrypt_at_rest";

let _enabled: boolean | undefined;

export async function encryptionEnabled(): Promise<boolean> {
  if (_enabled !== undefined) return _enabled;
  _enabled = (await storage.get<boolean>(PREF_KEY)) === true;
  return _enabled;
}

export function encryptionEnabledCached(): boolean {
  return _enabled === true;
}

export async function setEncryptionEnabled(on: boolean): Promise<void> {
  _enabled = on;
  await storage.set(PREF_KEY, on);
}
