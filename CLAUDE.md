# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server (choose platform)
npm run start          # Expo Go / dev client
npm run ios            # iOS simulator
npm run android        # Android emulator
npm run web            # Browser

# Deploy (web only — Cloudflare Pages via Wrangler)
npm run deploy         # expo export --platform web && wrangler pages deploy
```

There is no test runner configured. TypeScript is checked implicitly by the Expo build toolchain.

## Dev server rules

- **Before starting a dev server, check whether Metro is already running:** `netstat -ano | findstr :8081`. If it is, reuse it — do not start a second instance.
- When starting one, use `npx expo start --web --offline` (skips Expo's network update checks).
- **Kill any dev server you started before the session ends.** Orphaned Metro/Expo processes from worktree sessions have previously been left pinning a CPU core for days.

### Working in a git worktree

A fresh worktree has no `node_modules/` or `.env` (both are gitignored). Before `npm run web`, `npm run deploy`, or the TypeScript-via-node workaround will work, copy `.env` from the main checkout and run `npm install` inside the worktree.

### Web fonts — dev and prod use the same path now

Inter + Ionicons `.ttf` files are committed at `public/fonts/` and referenced by `global.css` as `/fonts/*.ttf`. They are **not** under `/assets/fonts/` — Metro's dev server (`expo start --web`) unconditionally claims the entire `/assets/*` URL space for its own bundler asset-resolution middleware, so static files placed there 404 in dev even though the identical path works fine once exported. `expo export --platform web` copies `public/` straight into `dist/`, so `dist/fonts/` is produced automatically — there is no font-copy build step (`scripts/copy-fonts.js` was deleted; previously it pulled TTFs from `node_modules` post-export). If `npm run web` ever shows serif/system fonts instead of Inter, check `public/fonts/` still has the 5 files and `global.css` still points at `/fonts/`, not `/assets/fonts/`.

One cosmetic, harmless leftover: the Metro terminal (not the browser) logs `Error: ENOENT: ... scandir 'fonts'` once per page load on web. Root cause wasn't isolated — it's unrelated to the `/fonts/` static files (those load fine; checked via `document.fonts` reporting `"loaded"` for all five). Safe to ignore.

### Known accepted warning — RN-Web `<Modal>` deprecated `pointerEvents`

`react-native-web`'s own internal `<Modal>` implementation (`ModalAnimation.js`) still triggers the deprecated-`pointerEvents`-as-a-prop console warning on web. All of *our* call sites were fixed (they use the `style.pointerEvents` form) — this residual warning comes from inside the library itself, not app code, and isn't fixable without a `patch-package` override or an RN-Web upgrade. The deploy pipeline has no patch step, so **accepted as a known, harmless, cosmetic console warning** rather than patched. Revisit if/when RN-Web is upgraded.

## Architecture

**Stack:** Expo SDK 54 · expo-router v6 · React Native 0.81 · NativeWind v4 (Tailwind CSS) · expo-sqlite · Supabase (sync)

### Routing

expo-router file-based routing. All screens live under `app/`:
- `app/(tabs)/` — screens: `index` (Dashboard), `today`, `tasks`, `notes`, `courses`, `dump`; `lists` and `calendar` also live here but are hidden from navigation (`href: null`). On mobile, `MobileTabBar` shows only Home/Today/Tasks/Notes plus a "More" sheet for the rest; the desktop `Sidebar` shows every screen. Post-its were removed 2026-07-06; legacy `type: "postit"` notes are coerced to regular notes on load.
- `app/settings.tsx` — modal screen
- `app/_layout.tsx` — root layout: wraps everything in providers, initialises the DB, requests notification permissions

### State / Data layer

Each domain has a Context + Provider in `lib/`:

| Context | File | Persists to |
|---------|------|-------------|
| Tasks | `TasksContext.tsx` | AsyncStorage → Supabase (debounced 1.5 s) |
| Lists | `ListsContext.tsx` | AsyncStorage → Supabase |
| Notes | `NotesContext.tsx` | AsyncStorage → Supabase |
| Theme | `ThemeContext.tsx` | AsyncStorage |
| Toast | `ToastContext.tsx` | in-memory only |

All providers are composed in `app/_layout.tsx`. The pattern is: load from local storage first (instant), then merge with remote (last-`updated_at` wins).

`lib/db.ts` — expo-sqlite singleton (`getDb()`) with versioned migrations (`SCHEMA_VERSION`). SQLite is used as the durable local store on native; web falls back to AsyncStorage only.

`lib/storage.ts` — thin async wrapper around `@react-native-async-storage/async-storage`.

`lib/supabase.ts` — `syncFetch`, `syncUpsert`, `syncDelete` helpers used by the context providers.

### Design system

**Single source of truth:** `lib/theme.ts` exports typed tokens (`colors`, `lightColors`, `spacing`, `radius`, `typography`). These mirror `tailwind.config.js` exactly so the same values work both in NativeWind classes and in `StyleSheet` / inline styles (e.g. react-navigation theme config).

- Use NativeWind Tailwind classes wherever possible
- Use `lib/useTheme.ts` (`useTheme()`) when you need JS-side color values — it returns the correct palette for the current color scheme
- Never hardcode color hex values; always reference tokens

**Color palette (Linear-inspired, dark-first):**
- Backgrounds: `bg-bg-primary` (#0D0D0D) → `bg-bg-secondary` (#141414) → `bg-bg-tertiary` (#1A1A1A)
- Accent: `accent` (#5B6AD0 indigo)
- Text: `text-text-primary` / `text-text-secondary` / `text-text-tertiary`

### UI components

Shared primitives live in `components/ui/` and are re-exported from `components/ui/index.ts`:
`Text`, `Card`, `CardPressable`, `Divider`, `Badge`, `Button`, `Checkbox`, `TextInput`, `DatePicker`, `EmptyState`, `SearchBar`, `Toast`, `ToastContainer`

Always prefer these over raw RN primitives to keep styling consistent.

## Hard rules
- Never hardcode hex values; always use theme tokens from `lib/theme.ts`
- Never use raw RN primitives (View/Text/TextInput) in screens; always use components from `components/ui/`
- Never modify Supabase schema directly; schema changes go via migrations only
- `npm run typecheck` must pass before any feature is considered done
- Web fallback is AsyncStorage only — never assume expo-sqlite is available on web

## Current state
Built: tasks (category board + composer modal), notes (Pinned/All Notes sections, WYSIWYG editor
on web, sort Recent/Added/A–Z, archive, `//tag` inline tags + filter chips), courses (custom
checkbox-progress tables + rings, migration 004), lists, calendar tabs, dump (frictionless capture,
migration 003), settings screen, theme system (6 themes: Obsidian/Nord/Graphite/Evergreen/Solar/Ember;
10 accents incl. Slate/Mono grayscale; header button = light/dark toggle), Supabase sync,
Atelier design system (shadow/type/layout/motion tokens + per-theme kits in `lib/theme.ts`),
split data/sync/actions contexts, delta-cursor sync with tombstones,
mobile nav = 4 tabs + More sheet (custom `MobileTabBar`; desktop sidebar shows everything).
"Early July Changes" programme (Claude Design redesign, WYSIWYG editor, accent palette, PWA icon
fix, UI polish sweep) shipped 2026-07-03; Courses page + nav declutter + modal/zoom/editor fixes
shipped 2026-07-05 — full history + decisions in `docs/plans/early-july-changes.md`.
Removed 2026-07-06: post-its section (dashboard secondary FAB now creates a note) and ALL web
keyboard shortcuts (g-chords / `/` / `?` / tasks n/f/j/k/x — they intercepted letters while typing
in the notes editor). Do not reintroduce shortcuts unprompted. Also replaced the 30-swatch accent
palette with a curated 10 (see theme system above) per explicit user request the same day.
iOS Safari input-focus auto-zoom fixed via viewport `maximum-scale=1` — set at runtime in
`lib/webViewport.ts` and statically by `scripts/inject-pwa-head.js`; keep the two in sync.
July 10 batch: Dump hide-filed toggle; notes editor — desktop bullets fixed (explicit
`list-style: disc`; the app-wide reset nulls li markers), checked checklist items sink to the
bottom of their group (`sinkToggledCheckbox` in `components/notes/utils.ts`, web + native paths),
"T" regular-text toolbar button (web `setCurrentBlockType("paragraph")`, native `removeLinePrefix`),
tags managed from a top-bar TagRow (still stored as a //tag line at the top of the body —
`addTagToBody`/`removeTagFromBody`), focus mode = full-window RN `<Modal>`; iOS keyboard could
leave the page scrolled up with a white bar below → `installKeyboardScrollRestore` in
`lib/webViewport.ts` + themed `document.body` background set by `ThemeContext`.
Standalone-PWA safe areas (2026-07-10, round 2): in Add-to-Home-Screen mode percentage heights
resolve short and content paints under the status bar — `html, body { height: 100dvh }` in
global.css, `PersistentHeader` owns the top inset (`useSafeAreaInsets`), tab screens use
`SafeAreaView` from react-native-safe-area-context with `edges={["left","right"]}` (top/bottom
belong to the header/tab bar — RN-W's SafeAreaView pads all four edges unconditionally and
double-pads; keep using the context version + edges for anything under the app chrome; full-window
modals like settings and the task-detail modal keep all edges).
July 11 batch: notes markdown tables (web WYSIWYG: tablerow/tablesep blocks keep the
one-element-per-line invariant; contiguous `display: table-row` siblings form an anonymous CSS
table so columns align — Tab/Shift+Tab navigates cells, Tab-at-end/Enter grow rows, empty-row
Enter/Backspace exits/deletes; `MarkdownView` renders `| a | b |` lines for native/preview);
note pages/tabs (tab 1 = the note itself, further tabs = child notes with `parent_id` +
`page_order` — each page its own sync row so per-page edits never conflict; pages hidden from
list/dashboard/wiki-links, page-count badge, search looks inside pages); sticky editor toolbar
(`position: sticky` in the note ScrollView); tag chips display without the `//` prefix (storage
format unchanged); custom task categories (synced `task_categories` table + migration 005,
`TaskCategoriesContext`, ids "personal"/"uni" seeded for back-compat, Edit-categories modal:
add/rename/recolor via accent keys/reorder/delete-with-reassign); Today screen synced
(`today_items` table + migration 006, `TodayContext` — all days in one store filtered by date,
carry-forward is idempotent (only the `date` field of undone items changes, same id), 30-day
retention sweep for done items, one-time import from legacy `today_items_<date>` keys;
lib/todayCarry.ts deleted); notes export (.zip of .md files via dependency-free ZIP writer in
`lib/notesExport.ts`; multi-page notes become folders) + import (.md file picker, filename =
title); theme polish (getShadow sm/md web adds a 1px inner top highlight; dashboard greeting is
ink→accent gradient text on web). Migrations 005/006 applied to Supabase 2026-07-11.
July 12 batch: Supabase RLS enabled — client sends `x-sync-key` header on every request
(custom fetch in `lib/supabase.ts`); migration 007 adds per-table policies matching the header
against the sync_key column (anon key alone grants nothing; legacy pre-app tables locked with
RLS + no policies). NOTE: any future synced table needs the same policy pattern AND the client
already sends the header. iOS widget shipped as a Scriptable script (`widget/scriptable-today.js`
+ setup guide `docs/scriptable-widget.md`) — reads today_items + due tasks via REST with the
x-sync-key header; user pastes their sync key into the script. Theme push round 2: FAB + primary
Button accent gradients, deeper GradientBackground washes. Today: retention sweep removed, done
items stay listed past their day (newest first). Notes: H3 toolbar button (web + native), page
reorder via chevrons on the active tab. setSyncKey now clears all 7 domains' delta cursors.
July 15 batch: widget v2 — every colour is `Color.dynamic(light, dark)` (follows system
appearance), large widget renders stacked TODAY / DUE / PINNED NOTES sections (12-row budget,
per-section caps 5/5/4 with leftover redistribution, empty sections skipped), pinned-notes fetch
excludes child pages, in-app preview is presentLarge. Notes: the managed //tag first line is
hidden from the editor — NoteEditor splits it off before display and re-joins on save
(`splitTagLine` in `components/notes/utils.ts`); only the exact line captured at page-open or
via TagRow is hidden, so a tag line typed mid-session stays visible (protects the caret from
DOM rebuilds); notePreview strips it from list previews too. Desktop sidebar collapse (already
existed via header chevron) now persists (`sidebar_collapsed` storage key). Migration 008 pins
search_path='' on set_updated_at/request_sync_key (linter 0011) — applied live, RLS re-verified.
July 18 sync audit: Settings "Sync now" + status roll-up now cover today_items and dumps
(both were silently skipped); Today pull-to-refresh actually syncs (was a cosmetic 600ms
spinner). Live-DB repairs done 2026-07-18 via Supabase MCP: 7 orphaned sync_key=NULL rows
(6 notes, 1 course — pre-sync-key era) claimed under the active sync key; they were
poisoning full-sync upsert batches with RLS violations (one bad row 403s the whole
100-row chunk → whole domain errors + cursor never advances). Known remaining sync-engine
gaps (documented in audit report, not yet fixed): task_categories seeds fixed ids
"personal"/"uni" with a global id PK so any second sync key hits RLS on upsert forever
(needs composite PK (id, sync_key) migration + onConflict change, deploy-before-migrate);
no interval pull (an always-visible window only pulls on visibility flips ≥60s apart);
in-memory dirty set = edits stranded until a full fetch if the tab dies inside the 1.5s
debounce; delete tombstones fire-and-forget after 3s (close app sooner → deletes
resurrect); LWW compares client clock vs server clock; no PostgREST row-limit guard
(silent truncation at 1000 rows/table). Scriptable widget: repo file is valid (node
--check passes) — the reported "line 412 Unexpected identifier" comes from a corrupted
paste; docs/scriptable-widget.md now mandates copying from the raw GitHub URL.
In progress: —
On hold (user will ask): further themes redesign beyond the 2026-07-12 push.
Not started: calendar screen memoization polish (hidden screen, deferred); tech debt items in
memory (two-browser sync drill, deprecated `useTasks()`/`useNotes()`/`useLists()` alias removal);
Supabase storage bucket (note images) policies not yet reviewed — table RLS shipped 2026-07-12.

> Update "In progress" and "Not started" at the start of each session.

## Deploy
`npm run deploy` — exports web build and deploys to Cloudflare Pages via Wrangler. Uses `--commit-dirty=true` so does not require a clean working tree. Web only; native builds are not in scope.
