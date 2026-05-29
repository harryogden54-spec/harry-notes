/**
 * Pre-deploy guard: exits non-zero if Supabase env vars are missing.
 *
 * Metro inlines EXPO_PUBLIC_* at build time, so a deploy run without
 * these set compiles SYNC_ENABLED=false into the bundle — the deployed
 * site then silently shows no data on any new device (iPhone, etc.).
 *
 * Loads .env manually because this script runs before `expo export`
 * (which is what normally injects .env into the Metro build).
 *
 * Run this BEFORE `expo export` in the deploy pipeline.
 */

const fs   = require("fs");
const path = require("path");

// ── Load .env from repo root (if it exists) ──────────────────────────────────
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
}

// ── Check ─────────────────────────────────────────────────────────────────────
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("\n❌  Missing Supabase env vars — aborting deploy.\n");
  console.error("    EXPO_PUBLIC_SUPABASE_URL      :", url ? "✓ set" : "MISSING");
  console.error("    EXPO_PUBLIC_SUPABASE_ANON_KEY :", key ? "✓ set" : "MISSING");
  console.error("\n    Create a .env file from .env.example and fill in your project creds.");
  console.error("    The deploy must be run from a checkout that has .env present.\n");
  process.exit(1);
}

console.log("✓ check-env: Supabase credentials present — proceeding.");
