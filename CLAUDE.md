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

### Known accepted error — NativeWind `Appearance.setColorScheme` on web

Once per page load the console logs an uncaught `Cannot manually set color scheme, as dark
mode is class-based` error. It comes from NativeWind v4's own web color-scheme observer
(`colorScheme.set` fired from a MutationObserver on `<head>`), which calls RN-Web's
`Appearance.setColorScheme` — rejected because dark mode is class-based. No app code is
involved (the theme system is custom via `ThemeContext`), theming works, and fixing it would
need patch-package or a NativeWind upgrade. **Accepted as known and harmless.**

### Known accepted warning — RN-Web `<Modal>` deprecated `pointerEvents`

`react-native-web`'s own internal `<Modal>` implementation (`ModalAnimation.js`) still triggers the deprecated-`pointerEvents`-as-a-prop console warning on web. All of *our* call sites were fixed (they use the `style.pointerEvents` form) — this residual warning comes from inside the library itself, not app code, and isn't fixable without a `patch-package` override or an RN-Web upgrade. The deploy pipeline has no patch step, so **accepted as a known, harmless, cosmetic console warning** rather than patched. Revisit if/when RN-Web is upgraded.

## Browser testing

When verifying UI changes, use the Claude Code built-in browser pane
(Ctrl+Shift+B in the desktop app's Code tab) pointed at the local dev
server. Do NOT launch an external Chrome window, and do NOT use the
Claude in Chrome extension for routine verification.

Take screenshots from the built-in pane. If the dev server is not
running, start it and wait for the ready line before navigating.

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
`Text`, `Divider`, `Badge`, `Button`, `Checkbox`, `TextInput`, `DatePicker`, `EmptyState`, `SearchBar`, `Toast`, `ToastContainer`, `Surface`, `GlassCard`

Dump-screen blocks live in `components/dump/` (`MonthCalendar`, `SparkBox`, `BrowseBox`, `AddDumpBox`).

Always prefer these over raw RN primitives to keep styling consistent.

## Hard rules
- Never hardcode hex values; always use theme tokens from `lib/theme.ts`
- Never use raw RN primitives (View/Text/TextInput) in screens; always use components from `components/ui/`
- Never modify Supabase schema directly; schema changes go via migrations only
- `npm run typecheck` must pass before any feature is considered done
- Web fallback is AsyncStorage only — never assume expo-sqlite is available on web

## Current state
Built: tasks (category board with one level of subcategories + a single centred create/edit
modal), notes (Pinned/All Notes sections, WYSIWYG editor on web, desktop tile view when nothing
is open, sort Recent/Added/A–Z, archive, `//tag` inline tags + filter chips), courses (custom
checkbox-progress tables + rings, condensable, migration 004), dump (frictionless capture,
migration 003, PWA share target), settings screen, theme system (6 themes: Obsidian/Nord/Graphite/Evergreen/Solar/Ember;
10 accents incl. Slate/Mono grayscale; header button = light/dark toggle), Supabase sync,
Atelier design system (shadow/type/layout/motion tokens + per-theme kits in `lib/theme.ts`),
split data/sync/actions contexts, delta-cursor sync with tombstones,
mobile nav = 4 tabs + More sheet (custom `MobileTabBar`; desktop sidebar shows everything).
Six nav items only — Home/Today/Tasks/Notes/Courses/Dump. Lists, Calendar and the command
palette were deleted 2026-07-27; do not reintroduce them or reference `ListsContext`.
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
100-row chunk → whole domain errors + cursor never advances). July 18 sync hardening (all the audit's engine gaps, second commit): upserts/tombstones
target on_conflict=id,sync_key (per-row fallback when a chunk fails); syncFetch pages past
the PostgREST 1000-row cap; dirty ids + pending tombstones persist to storage
(sync:dirty:<table> / sync:pendingDelete:<table>) and re-hydrate + retry on launch —
contexts no longer call syncDelete themselves (the hook owns tombstones); 90s periodic
pull while visible; remote never overwrites rows with unpushed local edits; syncNow
returns success and the Settings toast reports partial failure. Verified end-to-end on
local dev against prod Supabase with a throwaway key. Migration 009 (unique (id,sync_key),
additive) applied live 2026-07-18; client deployed 2026-07-21 (user-run npm run deploy);
migration 010 (composite PK (id,sync_key) on all 7 tables, sync_key NOT NULL) APPLIED
live 2026-07-21 and verified — a second sync key can now own the seeded task_categories
ids, and key rotation no longer collides. Any client older than the 2026-07-18 bundle
can no longer upsert (on_conflict=id has no matching constraint) — hard-refresh stale
tabs/PWAs if one shows sync errors. Scriptable widget: repo file is valid (node
--check passes) — the reported "line 412 Unexpected identifier" comes from a corrupted
paste; docs/scriptable-widget.md now mandates copying from the raw GitHub URL.
July 26 batch: sync re-verified end to end against prod (RLS policies key on
`request_sync_key()` not `auth.uid()`; 7-day cursor degrades to a full reconciliation fetch;
tombstones persist + retry; all 7 collections wired) — no engine bug found; `today_items` is
empty server-side only because no device has Today items, proven by a throwaway-key probe
(push → row lands, server-side insert → pulled + cursor advances, server-side tombstone →
row removed locally; probe rows deleted). Bottom-inset ownership: `Platform.OS === "ios"` is
false in the iOS home-screen PWA, so every iOS-tuned bottom offset took the shorter Android
value while the ~34px home-indicator inset was still reserved — FAB stack (bottom 76) and
toasts (72) sat behind an 89px tab bar. MobileTabBar now pads itself by the inset and
publishes its height (`lib/TabBarHeightContext.tsx`: `useScrollBottomPadding`,
`useFloatingBottom`); the effect-based report is load-bearing because react-native-web's
onLayout (ResizeObserver) never delivered an initial callback. Dropped `layout.tabBarHeight`
and `fabBottom.ios`. Dump: `components/ui/Select.tsx` (anchored panel, NOT a nested RN Modal —
a dismissed one lingered in the DOM on web) + `DateFieldDMY` replace the calendar picker;
`note_date` is optional end to end, empty is the default, day clamps to the month/year, stored
format unchanged (`data jsonb`, no migration). Header sync chip is now tappable with a
"Never synced" state; `lib/useSyncStatus.ts` owns the aggregate + the single `useSyncAll`
trigger over all 7 domains (was 5 — Dumps and Categories were missing) and Settings reuses it;
unused `SyncStatusBadge` deleted. Settings trimmed: sync status → one expandable row, sync key
→ one row + sheet, exports behind a Backup disclosure, Archive-completed split into its own
group, About card → footer version line. `AUDIT.md` at repo root has the full findings list.
July 27 batch (all deployed, master fast-forwarded to match production — the
long-standing master drift is gone): **Lists, Calendar and the command palette
deleted** (~2,080 lines; both Supabase tables kept as backup, the dashboard
magnifier went with the palette). **Sync scheduler** — `lib/syncScheduler.ts`
replaces six independent 90s pull timers with one heartbeat walking domains
serially plus exponential backoff; that was the "Sync failed / Courses" bug (a
partly-failed concurrent burst left one domain in `error` with nothing scheduled
to clear it, and the least-edited collection never got a write to clear it).
`OfflineBanner` was also keyed on Tasks alone. **Three-way merge for note
bodies** — `lib/textMerge.ts`, line-based diff3 against a `sync:base:<table>`
common ancestor, merged on BOTH upload paths (debounced push via new
`syncFetchByIds`, and inside `performSync` which has the remote rows already);
overlapping edits produce an inline git-style conflict block, never a silent
winner; `npm run test:merge` runs 25 assertions + a 4000-case no-data-loss fuzz.
**PWA share target** into Dump (`app/share.tsx`, manifest `share_target`) — but
**iOS Safari does not implement Web Share Target**, so on the primary device it
needs the Shortcut in `docs/share-target.md`; GET not POST because Pages is
static, so shared files are out of scope. **PWA padding bands fixed** —
`react-native-safe-area-context@5.6.2` disagrees with itself: native fills a
missing `edges` entry with `'off'`, the web build leaves it `undefined` and
`getEdgeValue`'s `default:` is `'additive'`, so `edges={["left","right"]}` ADDED
the top/bottom insets on web on top of the header and tab bar that already own
them. Use `components/ui/SideSafeArea` (explicit object form) for anything under
the app chrome — never the array shorthand. **Dashboard/search task rows were
unopenable** (TaskRow's title sits in an inner Pressable with no onPress; RN-Web
handles the click there instead of bubbling) — pre-existing, confirmed on the
live site. Task create+edit unified into one centred `TaskDetailModal`
(TaskComposerModal deleted, file renamed TaskComposerForm.tsx since QuickAddModal
still embeds the form — that is now the last duplicate create surface, see
AUDIT.md). One level of **task subcategories** (`Category.parent_id`, additive to
the jsonb row, no migration; board columns stay top-level and group by
`rootCategoryId`; `order` is sibling-scoped; delete cascades). Urgency on the
inline new-task row; desktop notes tile view when nothing is open; courses
condense; design pass (widened type scale, borders-vs-shadows per scheme,
semantic elevation ladder, one `motion.easing` + `transition()`, notes-grid mount
stagger via `hn-rise` keyframes, and the icon's **star** replacing the pin on
pinned notes). Also removed the dashboard greeting's accent gradient as part of
accent restraint — the one change that reverses an earlier deliberate choice;
the spot is commented in `app/(tabs)/index.tsx`.

July 30: the persistent "Sync failed / Courses" was a literal `null` stranded in
`sync:pendingDelete:courses` (localStorage, origin pre-guard) — its tombstone upsert can never
land, so `flushRemoteDeletes` failed every pass and pinned the domain at `error`; the July 27
scheduler fix only addressed the *stale-status* half. Fixed by validating ids at all three
mouths of the queue (markLocallyDeleted, hydration filter that also rewrites the cleaned
queues, and syncDelete returning success for non-ids so the entry drains). Devices self-heal
on next load after deploy — no manual localStorage surgery.

August 11 batch (deployed — production is commit 18cbdce, branch
`claude/tasks-notes-ui-audit-be4adf`): **DatePicker is Monday-first** (the only
calendar grid in the app). **Tasks sync pill deleted** — it duplicated the header
SyncChip, and in normal flow its appearance reflowed the whole screen. **Inline
quick add no longer opens the detail modal** on the new task. **AddTaskRow blur
guard** — mousedown on an option chip blurred the input, which unmounted the chip
before the click landed (only visible with an empty input); `setFocused(false)` is
now delayed 150 ms and cancelled on refocus. This blur-unmounts-the-click-target
class is a recurring RN-Web hazard, like the inner-Pressable swallow of 2026-07-27.
**Category tags unified** — AddTaskRow embeds `CategorySelector` (was a flat chip
list that mixed subcategories in with parents under their own colours), selector
chips are pills like every other category chip, `TaskRow` (dashboard/search) shows
`CategoryBadge`, and the badge qualifies a uni course as "Uni · Materials 2" except
on the board, where `rootImplied` drops the half the column already states.
**Web editor block buttons are multi-block** — `setCurrentBlockType` converts every
top-level block the selection touches, resolving Ctrl+A ranges whose boundaries sit
on the container itself (`findTopLevelBlock` returns null there) and skipping
image/table/hr blocks. **Untitled notes display their first line** as the title
(`noteDisplayTitle` in `components/notes/utils.ts`) with `notePreview` starting
after it — display only, never for `[[wiki link]]` resolution, which still matches
the stored title. **Empty board columns** hold their shape with a dashed well
instead of printing "Nothing here" once per category. **Note toolbars**: one size
and weight for every letter glyph, "H" → "H1", grouped with dividers; the native
toolbar's unicode marks (• ☑ ` — ⊞) became Ionicons. Require-cycle note: anything
`components/ui/index.ts` re-exports must not import back through that barrel —
`CategoryBadge` imports `Text` directly.

August 11 design pass (deployed, master level with prod): **type role tokens** in
`lib/theme.ts` beside the t-shirt sizes — `meta` (11.5) replaces the caption size that
was written as 11, 11.5 and 12 in different files; `label` retuned to 11/1.2 uppercase
(what every call site was already overriding it to); `cardTitle` (15/21) for card and
list-item headings; `inputText` for body-level TextInputs, which had drifted to
13/14/15/16. Prefer a role token over a raw step, and never a bare `fontSize`.
**`shape` tokens** (`pill`/`countPill`/`card`) for the small repeated forms: pill padding
had existed as paddingHorizontal 5|6|7|8|9 with paddingVertical 1|2|3 across a dozen
files, so a due pill and a category badge on the same row never aligned. **Colour is
spent only where it signals** — urgent/high carry their priority colour, medium/low stay
neutral, and the coloured dot that repeated the priority word is gone; subtask progress
left the pill language for quiet text. Note: it is deliberately NOT hover-revealed —
adding a pill on hover re-wraps the meta row and grows the card. **EmptyState takes an
optional `action`**, so a state that says "tap the field above" offers the thing to tap;
its holder lost the `accentSubtle` fill that made the emptiest screen the most colourful.
Illustrations for deleted features were repointed (`lists` → `courses`, `sticky` → `dump`).
The tasks **loading skeleton mirrors the real layout** rather than five flat bars.

August 13 batch (deployed): **icon system** — `iconSize` (12/14/16/20/28) replaces
seventeen ad-hoc sizes; outline is the default for every object icon, FILLED means an
on-state (`star` = pinned, `checkmark-circle` = filed) and never mere emphasis; geometric
glyphs (add/close/chevron/ellipsis) get one spelling each (`refresh`, `close-outline`
and `chevron-back` were each in use alongside their twin). **Note cards** key their
pastel on the note's first TAG and show the tag name — same tag, same colour, so a grid
groups itself; untagged notes carry no mark. Pinned cards get an accent edge.
**Density** left the tasks screen (`tasks_compact`) to become an app-level preference on
ThemeContext with a Comfortable/Compact control in Settings → Appearance; it currently
reaches TaskItem rows only. **GradientBackground is flat** — the three per-theme radial
washes argued with the surface hierarchy once borders and the elevation ladder earned it.
`kit.wash` is kept, so restoring it is a local change to that one component.
**`mountStagger()` and `hn-rise` are gone**: they animated nothing and replayed on every
visit to Notes. Note cards now animate on real changes (enter/exit/reorder).

**THEMES REBUILT AS MATERIALS** (same batch). Four themes, not six —
Obsidian (neutral), Nord (cool), Ember (warm), Void (true-black OLED, its own
entry because #000 needs its own surface ramp). Graphite/Evergreen/Solar are gone;
`theme-v4` supersedes `theme-v3` and maps them to obsidian/nord/ember so no device
silently resets. `ThemeMaterial` adds `separation` ("border" | "shadow" | "both"),
`shadowColor` and `shadowStrength`, so Nord is border-led and flat while Ember's cards
sit on a warm-tinted shadow. **Every theme's light scheme is authored, not inverted.**
`useTheme()` now returns a material-bound `shadow(level)` — prefer it over
`getShadow(level, scheme)`, which cannot know the theme's material. Accent precedence is
explicit: each theme ships a `defaultAccent`, `accentId === null` means "follow the
theme", an explicit pick wins and persists, and a reset appears only when there is
something to undo. The picker is a near-full-size **live preview** (real card, task row,
real type in the previewed material) — the old 86px thumbnail could only show hue.
**Accents retuned**: same ten hues with real chroma (the originals were Nord's
deliberately-desaturated palette and read muddy), and each now carries a deeper
`light`/`lightHover` pair because one hex cannot clear 4.5:1 on both #0D0D0D and #FFFFFF.
Verified: all ten clear 4.5:1 in both schemes. Also **tabular figures** on the `meta` and
`label` roles (prose stays proportional) and a **masonry note grid** — `columns` vertical
stacks, cards as tall as their content, dealt round-robin because heights are unknown
until layout and RN-Web's first ResizeObserver callback never arrives.

August 15 batch: **Today's carry-forward was resurrecting completed items.** It ran
from useSyncedCollection's `onLoad` — i.e. against whatever this device last wrote
down, before any contact with the server — re-dating every undone item to today with
a fresh `updated_at` and marking it dirty. That is indistinguishable from a user edit,
so it beat the server's newer `done: true` on timestamps AND was shielded from it by
doMerge's dirty guard, then pushed the stale copy back. The engine gains
**`onReconciled`**: same shape as `onLoad`, run after a *successful* reconciliation
and re-run after every later one (so a session open across midnight also carries
forward), including on the offline-only paths where there is no race to lose. Rule of
thumb now: **anything derived from the clock or from other rows goes in `onReconciled`,
never `onLoad`.** Because adoption now waits for the network, the rule is *also* a
derivation — `isActiveOn(item, date)` in `TodayContext`, read by the Today screen and
by the widget (`date <= todayStr`, not `===`) — so nothing is missing while offline;
toggling or reordering a not-yet-adopted item adopts it on the spot. Verified end to
end against Supabase with a throwaway sync key (push → complete → rewind the local
store to the stale undone copy with the cursor cleared → relaunch → stays done); probe
row deleted. Also **`storage.get` no longer throws on a corrupt value** — an
unparseable entry made `loadLocal` reject, and that path marks the domain `error` and
returns WITHOUT calling performSync, so one bad write stranded a whole collection
permanently (same class as the null in `sync:pendingDelete:courses`). It now drops the
value and returns null. **Accents replaced** with eight hues the user picked by eye —
Navy/Harbour/Frost/Sage/Jade/Olive/Brick/Stone. Each is anchored on one supplied hex,
kept verbatim in the scheme where it already clears 4.5:1 (four are light enough for a
dark background, four deep enough for white), with the counterpart derived by moving
lightness with the hue pinned; derived values target 5.2:1 on #0D0D0D because Nord's
dark surface is far lighter than near-black, and saturation is capped at 0.55 while
lifting — an unbounded lift of #780000 lands on #F80000. `normalizeAccentId` maps the
retired ten onto the new eight and rewrites them in place: task categories store an
AccentId as their colour, so a membership test alone would have collapsed every custom
category to one colour and synced that collapse. **Theme blurbs deleted** (picker rows
are name + swatch; the reset link no longer names the theme), and the light/dark row
lost its subtitle. Two bugs found alongside: the theme preview drew the dark-scheme
accent in both schemes, and `components/ui/Card` took its shadow from the raw
`getShadow(level, scheme)`, which cannot see the theme's material.

August 25 batch: **priority is a left edge**, not a word (task cards) or a dot
(dashboard rows) — 4px on a card, 3px on a row, urgent and high only, and the
tinted urgent background goes with it. Dashboard task titles drop to the `sm`
step and stop turning red when overdue; the due pill on the right already said
it. **Empty category columns are not drawn** — the dashed well held a shape
that cost most of the board's width on a board with six categories and two live
ones. **Task categories archive** (`Category.archived`, additive to the jsonb
row, no migration): the row and its id stay so a task filed under one keeps
resolving to a real name and colour, while the column and every picker entry
go; `topLevel`/`childrenOf` take an `includeArchived` flag and
`archivedCategories()` feeds the restore list in the Edit-categories sheet.
Watch the class of bug found there: `CategoryColumns` used to call a task
categorised if its id was *known*, so archiving a category that still held
tasks made those tasks vanish — the test is now whether the root has a column.
**Today's header is a date block** (weekday small over a large tabular numeral,
month beside it) and the **Done list groups by day** with a divider that sticks
to the top of the scroller, web only. **Notes remember the open note across a
tab switch** — module scope, not storage, so a fresh launch still opens the
list — and the **open note carries its first tag's pastel** as a top edge and
on its TagRow chips. `components/ui/Card` deleted (barrel-exported, used
nowhere).

**DUMP REBUILT AS A DAY** (same batch). Four blocks: month calendar, brainstem
box, selected-day panel, today's journal — two columns above 900px, stacked
below with the calendar directly above the panel it drives. A day has ONE
journal entry: `tag: "journal"` + `note_date` is the single row the calendar
dot, the day panel and the journal box all refer to, and `journalFor()` picks
the newest when older data holds several. Two additive jsonb fields, no
migration: a `spark` tag for the brainstem box and `handwritten` on a journal
entry. The calendar dot is accent once a day's captures have reached Supabase
and warning while they are only local — **derived from `updated_at` vs the
collection's `lastSynced`, deliberately NOT from the engine's dirty set**,
which lives in a ref and never triggers a render; the derivation errs towards
"pending", never towards a false "synced". Undated captures (older ones, PWA
share-target ones) get a drawer under the grid rather than being unreachable.

**DUMP SCREEN v2** (2026-08-25, design canvas artifact
`18927991-2921-454a-9644-f5c6a14a470b`). Block D is **"Add a dump"**, not
"Today's dump": Today/Yesterday shortcut buttons beside a day dropdown, and once
a day has an entry the box collapses to a **receipt** (word count, time, Read it
/ Add more) instead of echoing the filed text back — the box is a place to put
something, not a mirror of what is filed.

Saving is deliberately **two-stage**, and that is what makes the receipt
legible. The 600ms autosave still runs (close the tab mid-sentence and nothing
is lost) but it writes a **draft**: `Dump.draft`, additive to the jsonb row, no
migration. A draft is invisible to the calendar dots, to Browse and to
`journalFor()` — only the compose box it belongs to shows it. **Save** clears
the flag. So the text leaving the box has a cause the user pressed rather than a
timer. Read the flag through `isFiled(d)`, never `d.draft` directly: rows
written before this have no field at all and must default to filed.
`journalFor(dumps, date, includeDraft?)` excludes drafts unless asked. "Add
more" APPENDS to the day's entry rather than making a second one — the
one-journal-row-per-day invariant is what the calendar dot and Browse both rely
on.

Block B is **"Brainstem ticklers"** with a count pill. Block C is **Browse**
(DayPanel deleted): full-text search over every capture, category chips
(`spark` displays as "Brainstem"), and a date range. **A calendar tap only sets
the date filter**, so the day view and the search results are one list — that is
what finally gives the calendar somewhere to point. Bounded ranges deliberately
exclude undated captures, which keep their drawer at the foot of the screen.
Calendar: the seven columns used to stretch to ~64px at full card width and read
as a table, so the grid is capped at 340px and centred with fixed 40px day
chips; the legend is one quiet right-aligned line under a rule.

**RN-Web Modal + reduced motion is a trap.** `ModalAnimation` only clears its
`animatedOut` style — which carries `pointerEvents: 'none'` — when the CSS
animation fires `animationend`. Under `prefers-reduced-motion: reduce` the
browser never runs the animation, so a `fade`/`slide` modal can strand an
inert, invisible copy of itself in the DOM and confuse the next open.
`animationType="none"` makes the library call its own end callback directly.
The journal expand modal and `MobileTabBar`'s sheet use `"none"`;
`TaskDetailModal`, `QuickAddModal`, `TableEditorModal` and NoteEditor's focus
mode still use `"fade"` and have the same exposure — not yet fixed.

August 25, notes formatting sweep: **the B button could only ever turn bold
ON.** `document.execCommand("bold")` decides between applying and removing by
reading the computed font-weight, and the editor stylesheet said
`.note-editor-body b { font-weight: normal }` — every other weight in the app is
carried by the family name alone, but here the computed value is load-bearing.
It is now `font-weight: 700`, which matches the Inter_700Bold @font-face exactly
(declared at 700) rather than synthesising a face. **Emphasis delimiters moved
to `lib/mdEmphasis.ts`** — one dependency-free module, three consumers (the web
editor's `markdownDom.ts`, `MarkdownView.tsx`, and `stripMarkdown` in
`lib/utils.ts`). They had each carried their own copy of the same four naive
regexes, and the copies drifted: a card previewed `file_name_here.txt` as
"filenamehere.txt" while the editor showed it intact. The shared patterns use
CommonMark flanking rules, so `snake_case`, `2 * 3 * 4` and `****` stay literal.
**Bold and italic now recurse**, so `**_both_**` is bold italic rather than a
bold run containing two underscores. `inlineNodeToMarkdown` reads a span's
inline `font-weight`/`font-style` (rich pastes and styleWithCSS emit those, and
the unknown-element branch used to flatten them away) and drops contentless
marks, since an empty `<b>` serialised to `****` and read back as an italicised
asterisk. Toolbar buttons show an active state off `selectionchange`.
`npm run test:markdown` runs 34 assertions over these rules — add a case there
before touching any of them.

In progress: —
Approved but not yet built (from the 2026-08-13 visual review): per-screen identity
from the accent only (a small accent-derived cue per screen, NOT per-screen surface
tints). Declined in the same review: a signature display typeface, and a reading-measure
cap on the notes editor.
Awaiting confirmation: the PWA padding fix could not be verified locally — the
web safe-area provider reads `env(safe-area-inset-*)` once at mount via a hidden
probe div whose listener uses the legacy `webkitTransitionEnd` event Chrome no
longer fires, so insets can't be simulated after load. Needs an on-device check.
Not started: audit the four remaining `animationType="fade"` modals against
`prefers-reduced-motion` (see the August 25 batch); point the quick-add FAB at
`TaskDetailModal` and delete
`TaskComposerForm` (last duplicate task-creation surface); web push for task
reminders (postponed by the user 2026-07-27); Settings screen full visual
redesign (deferred, tracked separately); `notes.tsx` module split (readability
only — the audit's parse-cost rationale was wrong, on web the route is already
its own lazy chunk); Supabase storage bucket (note images) policies not yet
reviewed — table RLS shipped 2026-07-12; two-browser sync drill.
Declined by the user, do not re-raise: the dual FAB stack, the Home/Today
overlap, and the third light/dark control in Settings.

> Update "In progress" and "Not started" at the start of each session.

## Deploy
`npm run deploy` — exports web build and deploys to Cloudflare Pages via Wrangler. Uses `--commit-dirty=true` so does not require a clean working tree. Web only; native builds are not in scope.
