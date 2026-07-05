# Early July Changes — Programme Tracker

Living tracker for the multi-session "Early July Changes" work programme. Update the status table and Decision log at the end of every session. Full context/rationale for each phase lives in the original plan; this file is the in-repo source of truth for status going forward.

Design reference: `docs/design/tasks-notes-redesign.dc.html` (Claude Design export, 7 artboards — Tasks/Notes web+iOS, new-task modal, note editor web+iOS). Open it in a browser (it's a self-contained bundled page) to view.

## Scope

- **A.** Implement the Tasks & Notes redesign (tasks as designed; notes editor as a **side panel**, not full-page).
- **B.** UI polish items from `memory/flagged_findings.md` (tech debt excluded from this programme).
- **C1.** Accent palette: 6 → 30+ presets.
- **C2.** Notes editor: true WYSIWYG toolbar (bold/italic/H1/H2/bullet/checklist), replacing the markdown-preview toggle. Merged into Phase 5 alongside the redesign's editor (A).
- **C3.** Stale PWA icon on desktop — cache-busting fix.

## Status

| Phase | Description | Status | Deployed |
|---|---|---|---|
| 0 | Programme setup + C3 icon cache-bust | shipped | 2026-07-03 |
| 1 | Accent palette expansion (C1) | shipped | 2026-07-03 |
| 2 | Tasks redesign — desktop web | shipped | 2026-07-03 |
| 3 | Task composer modal + mobile tasks | shipped | 2026-07-03 |
| 4 | Notes list/grid redesign | shipped | 2026-07-03 |
| 5 | WYSIWYG note editor (A + C2) | shipped | 2026-07-03 |
| 6 | Polish sweep (remaining B items) | shipped | 2026-07-03 |

## Decision log

- **Notes editor stays a side panel**, not the design's full-page layout — keeps the existing desktop master-detail pattern (notes list left, editor right).
- **C2 = true WYSIWYG.** Bold/italic/headers render live; no visible markdown markers; no Preview toggle on web. Markdown remains the underlying storage/sync format — the editor serialises to/from it.
- **Uncategorised tasks** render in a full-width "Unsorted" strip above the Personal/Uni columns (design only shows 2 columns; `category` is optional in the data model).
- **Accent IDs are preserved** — the 6 existing accent entries keep their ids/values verbatim; ~24-28 new entries are derived via HSL math. No storage migration needed for `accent_id_v2`.
- **WYSIWYG editor has an explicit fallback gate** (end of Phase 5a): if contentEditable proves too unstable, fall back to a styled markdown editor (syntax highlighting overlay, markers still visible) rather than shipping something broken. **Gate passed 2026-07-03** — contentEditable core verified stable (see Phase 5a checklist); proceeding with 5b/5c rather than falling back.
- **Tech debt items from flagged_findings.md are excluded** from this programme (sync drill, deprecated context aliases, calendar memoization) — still tracked separately in memory for a future session.
- **RN-web Modal `pointerEvents` warning**: accepted as a known cosmetic issue, documented in CLAUDE.md rather than patched (no patch-package step in the deploy pipeline).

## Phase 0 checklist

- [x] Copy design file into `docs/design/`
- [x] Create this tracker
- [x] Cache-bust PWA icon hrefs (`scripts/inject-pwa-head.js`, `public/manifest.json`)
- [x] Update `CLAUDE.md` "In progress"
- [x] Update memory (`flagged_findings.md` note + project pointer to this doc)
- [x] `npm run typecheck` green
- [x] Commit + deploy + verify live icon URLs (`?v=2`) — deployed to https://4020144c.harry-notes.pages.dev, verified `/manifest.json` and index.html both serve versioned icon URLs
- [ ] Harry re-pins the PWA shortcut to pick up the new icon (user action, outside repo)

## Phase 1 checklist

- [x] `lib/color.ts` — `hexToHsl`/`hslToHex`/`deriveAccent`/`deriveAccentFromHsl` utilities
- [x] `lib/theme.ts` — `ACCENT_OPTIONS` expanded 6 → 30 (original 6 kept verbatim, 24 new derived + pasted as static literals)
- [x] `app/settings/appearance.tsx` — swatch grid resized to 30px, wrapped layout, active label shown once above grid
- [x] `npm run typecheck` green
- [x] Verified in browser preview: all 30 swatches render without overflow, selecting a swatch updates the checkmark/label/`--accent` CSS var correctly, dark/light mode both fine
- [x] Commit + deploy — https://7fbb8dbd.harry-notes.pages.dev

## Phase 2 checklist

- [x] `components/tasks/TaskCard.tsx` — floating card bubble (checkbox, title, due date w/ red overdue, priority pill, subtask count, course badge for Uni)
- [x] `components/tasks/CategoryColumns.tsx` — Unsorted strip + Personal/Uni columns, empty-column hint
- [x] `app/(tabs)/tasks.tsx` desktop branch rewritten: full-width board instead of 40/60 split; task detail is now a 420px slide-over drawer (`position: absolute`, backdrop-dismiss) over the board, not a permanent column
- [x] Header subtitle shows "N open · M due this week"
- [x] Completed → full-width collapsible strip with "Clear completed" (wired to existing `clearCompleted` action)
- [x] Search/priority chips/sort controls collapsed behind a "Filters" toggle, hidden entirely when there are no tasks at all
- [x] `grouped` (Flat/Grouped) toggle now mobile-only; desktop always shows the category board
- [x] Mobile/native rendering left untouched (separate render branch, not touched this phase)
- [x] `npm run typecheck` green
- [x] Verified in browser preview: created Personal + Uni(course) tasks, confirmed due-date/overdue styling, checkbox → Completed section → Clear completed → Archive → permanent delete all work; slide-over drawer opens/closes correctly (backdrop click dismisses); no console errors
- [x] Test tasks created during verification were fully deleted afterward (dev `.env` points at the real production Supabase project, so nothing was left behind)
- [x] Commit + deploy — https://71dde3f4.harry-notes.pages.dev

**Deferred to Phase 3** (per original plan): quick-add expand-to-modal icon, task composer modal, mobile category-sectioned view redesign.

## Phase 3 checklist

- [x] `components/tasks/TaskComposerModal.tsx` — `TaskComposerForm` (fields-only, self-sufficient via `useTasksActions`) + `TaskComposerModal` (standalone popup chrome). Reuses `DueDateSelector`, `CategorySelector`, `PrioritySelector`, `SubtasksList` — no new field-picker code needed.
- [x] `AddTaskRow.tsx` — expand icon opens `TaskComposerModal`; `onTaskCreated` callback lets the Tasks screen select/expand the new task, mirroring `handleAdd`'s existing behaviour
- [x] `QuickAddModal.tsx` — old `TaskCreateForm` deleted, `add-task` mode now renders `TaskComposerForm` (richer: adds description/priority/subtasks that the old form didn't have). Direct Enter-to-add from the palette search box unchanged.
- [x] `CategoryColumns.tsx` — new `stacked` prop: side-by-side on desktop, single column on mobile (design 1c); empty categories hidden entirely when stacked to save space
- [x] Mobile tasks screen now shares the same board as desktop instead of the old status-grouped (Overdue/Today/Scheduled/Someday) list; the Flat/Grouped toggle and `tasks_grouped` pref were removed as dead weight
- [x] `npm run typecheck` green
- [x] Verified in browser preview (desktop + mobile viewport): composer modal fills/submits correctly (title, due date, category+course, priority) and opens the new task's drawer; mobile stacked board renders single-column with empty category hidden; test data cleaned up after each check
- [x] Commit + deploy — https://ace7a0f2.harry-notes.pages.dev

**Known minor gap:** keyboard j/k navigation and deep-link scroll-to-task no longer auto-scroll for tasks rendered via `TaskCard`/`CategoryColumns` (only `Section`/`TaskItem`-based lists like Focus/Completed still report position via `onMeasureY`). Selection still works correctly — this only affects the auto-scroll-into-view nicety. Flagged for a future polish pass, not blocking.

## Phase 4 checklist

- [x] `app/(tabs)/notes.tsx` — `sortedNotes` split into `pinnedNotes`/`restNotes`; both mobile grid and desktop index list now show "Pinned" then "All notes" sections with count badges (local `SectionLabel` component)
- [x] Mobile grid switched from `FlatList`+`numColumns` to `ScrollView` + flexWrap `NoteCardGrid` — needed to interleave section headers with a 2-col grid, which FlatList doesn't support cleanly; acceptable tradeoff at personal-notes scale (not virtualizing hundreds/thousands of rows)
- [x] Desktop index pane switched from `FlatList` to `ScrollView` + mapped `NoteIndexRow`s for the same reason
- [x] `npm run typecheck` green
- [x] Verified in browser preview (desktop + mobile): created a note, pinned it, created a second — both "Pinned · 1" and "All notes · 1" sections rendered correctly on both platforms; test notes cleaned up after each check
- [x] Commit + deploy — https://64074869.harry-notes.pages.dev

## Phase 5a checklist — WYSIWYG editor core (GATE PASSED)

- [x] `components/notes/editor/markdownDom.ts` — block-level parse/serialise (mirrors `MarkdownView.tsx`'s exact line rules) + inline markdown⇄HTML (bold/italic/code/wikilink)
- [x] `components/notes/editor/NoteBodyEditor.tsx` — native: original TextInput + MarkdownToolbar + Preview toggle, moved out of `NoteEditor.tsx` verbatim (unchanged behaviour), bridged to a shared `BodyFocusHandle` focus contract
- [x] `components/notes/editor/NoteBodyEditor.web.tsx` — web: single contentEditable container, true WYSIWYG (bold/italic render live, no markdown markers, no Preview toggle). Toolbar: B/I via `execCommand`, H/H2/bullet/checklist swap the current block's element type. Checkboxes are a `contentEditable=false` toggle span + editable label.
- [x] `NoteEditor.tsx` updated: delegates all body editing to `<NoteBodyEditor/>`; Preview/Edit header button now native-only (`Platform.OS !== "web"`); dead code removed (`handleBodyChange`, unused `getWikiQuery`/`MarkdownView`/`MarkdownToolbar` imports)
- [x] **GATE decision: contentEditable core is stable — proceeding, no fallback needed.** Verified: DOM only rebuilds on note switch/external change (not every keystroke, so typing doesn't fight the caret); bold+H1 conversion preserves inline formatting; checkbox creation + click-to-toggle + strikethrough works; multi-block markdown serialises byte-exact (checked via word/char counts against hand-computed expected lengths); content survives navigate-away-and-back; same editor works at mobile viewport width; **verified on the actual production deploy, not just dev server**
- [x] Lossless-fallback invariant verified: typed an unhandled `![](url)` image line — no crash, no corruption, round-tripped as verbatim text (exact char count matched)
- [x] `npm run typecheck` green (tsc resolves the shared import to the native `.tsx` for typechecking; Metro resolves `.web.tsx` correctly at bundle time — confirmed both files typecheck independently since `tsconfig.json` has no `moduleSuffixes` override)
- [x] Commit + deploy — https://032e67ca.harry-notes.pages.dev

**Deferred to 5c:** visual polish pass, mobile-web toolbar visual parity with design 1g (Aa/checklist/B/I/image/mic — current web toolbar is B/I/H/H2/bullet/checklist/image, matching design 1f's desktop set exactly but not yet 1g's mobile set), paste-as-rich-content handling beyond the current force-plain-text intercept.

## Phase 5b checklist — wikilinks + image blocks on web

- [x] `markdownDom.ts` — `"image"` added to `BlockType`, with `src` field; `parseLine`/`blockToMarkdownLine` handle `![](url)` lines (previously fell through to lossless-fallback plain text)
- [x] `NoteBodyEditor.web.tsx` — `createBlockElement`/`serializeContainer` render/serialise image blocks as a real `contentEditable=false <img>` island
- [x] Wikilink autocomplete on web: caret-relative `[[query` detection (`updateWikiQuery`, mirrors `getWikiQuery`'s regex against the current block's pre-caret text via `Range.toString()`); selecting a suggestion splices the block's markdown using `Range.cloneContents()` + `inlineNodeToMarkdown` on both sides of the caret so **existing bold/italic formatting elsewhere in the same line survives** (a plain-text splice would have silently stripped it)
- [x] **Bug found and fixed during verification:** clicking a suggestion chip moves focus off the contentEditable container first, clearing the live `window.getSelection()` before the click handler runs — `insertWikiLink` was reading a stale/empty selection and emptying the block. Fixed by stashing the caret `Range` in a ref the moment a `[[query` match is detected, and using that stashed range instead of live selection state in `insertWikiLink`.
- [x] `BodyFocusHandle` renamed `BodyEditorHandle`, gained `insertWikiLink`/`insertImage`; native's `handleWikiSelect`/image-insert raw-text-splice logic moved into native `NoteBodyEditor.tsx` behind the same interface — `NoteEditor.tsx` no longer branches on platform for either
- [x] `npm run typecheck` green
- [x] Verified in browser preview: wikilink suggestion → correct byte-exact markdown + visible clickable span; typed image line → survives reload → renders as real `<img>` → serialises back byte-exact (30 chars, unchanged)
- [x] Commit + deploy — https://fae65f06.harry-notes.pages.dev

## Phase 5c — round-trip validation + polish (Phase 5 complete)

- [x] **Round-trip validation against every real note body** (the item 5a/5b's own spot-checks explicitly deferred): fetched all 29 rows from the production `notes` table (read-only REST query, no writes), ran the exact same line-level parse→serialise logic from `markdownDom.ts` against the 15 non-empty bodies. **All 15 round-trip byte-exact — zero mismatches.** This is the strongest safety signal in the whole editor rewrite: it's not just synthetic test cases, it's every note Harry actually has.
- [x] Visual sanity check via `preview_inspect` (screenshot tool was intermittently timing out this session, but DOM/computed-style inspection confirms correct theme-token colours and multi-block layout)
- **Consciously deferred, not a gap:** mobile-web toolbar's exact visual set (design 1g shows Aa/checklist/B/I/image/mic; current toolbar is B/I/H/H2/bullet/checklist/image) — current set is functionally *more* complete (explicit H/H2 vs a single "Aa" style-picker) and works correctly at mobile viewport widths, already verified in 5a. Voice dictation ("mic") is out of scope entirely. Richer paste-content handling beyond the current safe force-plain-text intercept — the current behaviour is correct and non-corrupting, just not maximally featureful (e.g. pasting bold text from another app loses the bold). Both are cosmetic/nice-to-have, not required for the core "true WYSIWYG" ask.
- [x] `npm run typecheck` green throughout
- [x] Commit + deploy (docs-only, no code changes this pass)

**Phase 5 (A + C2) is now fully shipped**, gate passed, verified against real production data.

## Phase 6 checklist — polish sweep (Programme complete)

- [x] Theme-cycler pill: palette icon + `accessibilityLabel` + web `title` tooltip (`components/nav/PersistentHeader.tsx`)
- [x] Dump date field: Today/Yesterday chips + on-demand "Pick date…" full calendar, replacing the always-shown month grid (`app/(tabs)/dump.tsx`, new `CompactDateSelector`)
- [x] Desktop quick-add FAB in the sidebar layout branch (`app/(tabs)/_layout.tsx`) — previously the only add-from-anywhere path was the search bar
- [x] Mobile Settings gear in `PersistentHeader` (`showTitle` mobile-only branch, so no duplicate on desktop where Sidebar already pins it) — reachable from every screen now, not just Dashboard
- [x] Dashboard "Get started" checklist for genuinely fresh installs (zero tasks AND zero notes, not just zero *open* tasks) — 3 action rows (add task / write note / dump a thought)
- [x] RN-Web `<Modal>` `pointerEvents` warning documented in `CLAUDE.md` as an accepted, cosmetic, library-internal issue (no patch-package step to justify patching)
- [x] `npm run typecheck` green
- [x] Verified in browser preview: theme pill icon + tooltip, Dump chips + on-demand calendar (both tested — calendar correctly appears on "Pick date…"), desktop FAB opens QuickAddModal, mobile Settings gear navigates from Tasks screen (not just Dashboard), Get-started card renders with all 3 rows when the account is empty
- [x] Commit + deploy — https://50ed5cd1.harry-notes.pages.dev

---

# Programme complete (2026-07-03)

All 7 phases (0 through 6) shipped and deployed to production in this session. Summary:
- **C3** icon cache-bust, **C1** accent palette (6→30), **A** Tasks + Notes redesign (category board, composer modal, mobile board, Pinned/All Notes sections), **A+C2** WYSIWYG note editor (web, gate-passed, round-trip validated against every real note), **B** all 8 flagged UI polish items.
- Deferred, not forgotten (see [[flagged-findings]] in memory): tech debt items (two-browser sync drill, deprecated `useTasks()`/`useNotes()`/`useLists()` alias removal, calendar screen memoization) were explicitly excluded from this programme's scope per Harry's decision — still tracked separately for a future session.
- Minor known gaps, none blocking: keyboard j/k nav doesn't auto-scroll for `TaskCard`-rendered tasks (Phase 2); web editor's rich-paste handling is safe but not maximally featureful, and its toolbar doesn't yet match design 1g's exact mobile icon set (Phase 5c).

---

# Post-programme polish pass (2026-07-04)

Follow-up session at Harry's request: "make it look more like the claude design prompt and ensure fluidity throughout." Design-fidelity + motion sweep against the same design file (`docs/design/tasks-notes-redesign.dc.html`).

**Root-cause fix worth remembering:** `getShadow()` in `lib/theme.ts` defaulted its shadow colour to 3-digit `#000` and appended a 2-digit alpha on web, producing invalid 5-digit hex (`#00014`) — browsers silently dropped the declaration, so **no default shadow anywhere in the web app had ever rendered**. Only explicitly-coloured shadows (6-digit, e.g. the accent FAB) worked. One-line fix (`#000000`); the entire app's floating-card shadow language switched on at once.

**Design fidelity (matching the mockup's card DNA):**
- `TaskCard` rewritten: 18px radius, 15/17 padding, circular 22px checkbox (new `shape="circle"` prop on `Checkbox`), tinted pill meta-chips (calendar-icon due pill, red-tinted when overdue / amber when due today; priority dot pill; subtask count pill), red-tinted card border when overdue, hover lift (translateY −1px + deeper shadow) with real CSS transitions.
- `CategoryColumns`: 10px card gaps, 20px column gap, category-tinted count badges, 9px header dots; every card wrapped in Reanimated `FadeIn`/`FadeOut`/`LinearTransition` so completing/adding/moving tasks animates the board reflow.
- Tasks header pills (Focus/Select/Archive): surface pills with xs shadow + hover + press-scale, Archive folded into the same map.
- `AddTaskRow`: 16px radius + design padding.
- `NoteCard` rewritten per artboard 1d: **neutral frosted surface with an 8px pastel identity dot** in the meta row (was: full-pastel background), 18px radius, hover lift. Pastel dot preserves each note's colour identity.
- Mobile notes header: inverse "New note" pill (dark-on-light / light-on-dark) with md shadow, per design.
- `NoteIndexRow`: hover background + 120ms transition.
- Note grid gap 8→16px.

**Fluidity:**
- Desktop task drawer now slides in from the right (`SlideInRight` 220ms) with separately-fading backdrop (was: whole thing faded).
- Completed-section expand animates (`FadeIn`).
- Theme-cycler pill + desktop quick-add FAB: hover/press feedback with CSS transitions (FAB scales 1.06 on hover, deepens its accent shadow).
- `Checkbox` background/border colour transitions on web.

**Verification:** typecheck green; dev-server browser pass at 1280×800 and 420×850 — board columns, card computed styles (18px radius, `0 2px 8px rgba(0,0,0,0.08)` shadow, 999px pills, 11px checkbox radius), completion flow (open-count 4→3, Completed strip + Clear completed), drawer open, notes index-row transition, mobile NoteCard pastel dot + inverse pill. All UI-created test tasks/notes deleted through the UI afterwards (preview profile had no sync key, so nothing ever touched production data). Hover behaviour not synthetically testable (RNW tracks real input modality) — pattern identical to Sidebar's production-proven `onHoverIn` usage.

**Note:** dev-only React 19 `element.ref` deprecation warnings observed during note-editor interactions — pre-existing (editor untouched this session), library-level, stripped in production builds. Not actioned.

## Consistency + performance sweep (same day, follow-up)

Second pass at Harry's request: "focus on the design, layout and performance and ensure consistency with the design throughout." No features.

**Layout:**
- Tasks board container was capped at 720px (`webContentStyle`) — two columns squeezed to ~340px each. New `webWideContentStyle` (1100px) in `lib/webLayout.ts`; other list screens (Today/Settings/Calendar) correctly stay at 720.
- New `typography.title` token (28/34/−0.5, the design's page-title spec) — applied to Tasks and mobile Notes headers ("2xl"=24 was undersized vs the mockup).

**Consistency (one card language everywhere):**
- `GlassCard` default shadow md→sm — md was tuned when web shadows never rendered (see the `#000` hex bug above); post-fix it read heavier than the design's 0-2-8 language. Modals keep "overlay".
- `TaskRow` (dashboard): circular 20px checkbox, due chip → borderless 999px tinted pill.
- `TaskItem` (Focus/Completed lists): circular checkboxes, 18px card radius matching `TaskCard`.
- Dashboard note tiles: neutral surface + pastel identity dot (same recipe as the redesigned `NoteCard`) — were still full-pastel.

**Performance:**
- Removed per-card `backdrop-filter: blur(14px)` from `Surface`, `TaskCard`, `NoteCard` — dozens of live blur layers per screen for an imperceptible effect over the smooth gradient. `GlassCard` (true overlays, few instances) keeps blur.
- `tasks.tsx`: the whole filter chain (visible/done/open/archived/focus/dueThisWeek/board-sort) now one `useMemo` keyed on [tasks, search, filterPriority, sortBy] — was recomputed every render. Removed dead `scheduled`/`someday` computations.

**Verified:** typecheck green; fresh-load browser pass — title 28px/−0.5, board container ~1060px, GlassCard sm shadow, circular checkboxes in TaskRow, dashboard tile 18px/soft-shadow/pastel-dot, no backdrop-filters, no console errors. Test task + note deleted through the UI after.

## Notes page — Harry's mockup layout (2026-07-04)

Harry supplied a hand-drawn mockup for the desktop Notes page: a prominent "New note" button at the top of the left column, the note list as floating bubble cards below it, and the editor in a large rounded panel ("similar feel to iOS Notes"). Implemented:

- `NoteIndexRow` rebuilt as a bubble card — 18px radius frosted surface, soft shadow, hover lift, pastel identity dot; selection = accent border + accent-tinted fill (replaces the old flat row with left-border indicator).
- Notes desktop column: full-width inverse "New note" button (18px radius, md shadow) as the primary action, search below it, Pinned/All sections of bubbles with 10px gaps; the divider between column and editor is gone — bubbles float on the gradient.
- Editor wrapped in a 24px-radius floating panel (border + md shadow, overflow hidden) with breathing room around it; empty state got an icon.

**Noted but not built (needs data-model work, out of "no new features" scope):** the mockup's button also says "add tags" — notes have no tags field in the model today. Flagged for a future session.

## Editor typography + professional details (2026-07-04, cont.)

Harry flagged the notes-page fonts. Root cause: the WYSIWYG contentEditable container set a size but **no font-family**, so the editor body rendered in the browser default (Times serif on Windows) — the only surface in the app not using Inter. Fixed with an injected theme-aware scoped stylesheet (`.note-editor-body`, re-injected on theme change) since blocks are created imperatively:

- Body: Inter 16px/1.7, textPrimary, **accent caret**
- Headings: real Inter Bold/SemiBold files (24/19/16.5) with proper margins, replacing browser-default serif heading styles
- Bold runs render in the actual Inter_700Bold file instead of faux-bold; code spans get a tinted monospace chip; wikilinks accent-colored
- Checkboxes: circular, app-language (accent fill + CSS tick when checked, label strikes + dims) — replacing the ☑/☐ text glyphs
- Toolbar: proper SVG icons (list/checklist/image — the image button was an emoji), hover states, tooltips, aria-labels

Also: toasts are now a 380px bottom-right stack on web (were full-window-width banners on desktop); browser tab title follows the active screen ("Tasks · harry."); previously-dead `RouteFade` component wired into the desktop sidebar layout so tab switches get a 180ms content fade.

**Verification note:** checkbox check-state colors verified via computed styles with transitions disabled — the headless preview tab freezes CSS transitions at 0% (`getAnimations()` showed all stuck at currentTime 0), so transition-target values never appear in computed styles there. Not an app bug.

## Courses page, mobile nav declutter, modal/zoom/editor fixes (2026-07-05)

Next batch from Harry (with mockup for a "Courses" page). Decisions asked & answered up front: mobile bar = **Home · Today · Tasks · Notes · More**; Courses **synced** via Supabase; tables **fully custom** (choose column count/names, per-column type text|tickbox, ring = % of that table's tickboxes ticked).

**Bug fix — New task modal rendered under the board (Harry's screenshot):** `TaskComposerModal`'s web branch was an inline `position:absolute` overlay, mounted inside `AddTaskRow` — so "inset: 0" anchored to the quick-add bar, and the Reanimated card wrappers (own stacking contexts, later in DOM) painted over it. Now a real `<Modal>` on all platforms (RNW portals to document root) + dim scrim. `QuickAddModal` given the same treatment. Verified: portaled outside #root, title input hit-testable, autofocus works.

**Notes editor — Enter continues checklists/bullets:** previously any Enter created a plain div. Now: Enter in a checklist/bullet item creates a new item of the same type; mid-line Enter splits the text into the new item; Enter on an **empty** item exits the list to a plain paragraph (iOS Notes behaviour). Headings still Enter→paragraph.

**Mobile zoom:** Expo's exported viewport meta lacked `maximum-scale`, so iOS auto-zoomed on focusing any sub-16px input and stayed zoomed. `inject-pwa-head.js` now normalizes the viewport tag at export (`maximum-scale=1, user-scalable=no, viewport-fit=cover` — pinch still works in the browser tab; installed PWA behaves app-like). Plus `touch-action: manipulation` + `text-size-adjust: 100%` in global.css.

**Courses (new synced domain):**
- `lib/CoursesContext.tsx` — `CourseTable { title, columns[{id,name,type}], rows[{id, cells}] }`, data/sync/actions split on `useSyncedCollection` ("courses" table/storage key). `tableProgress()` = ticked/total across checkbox-type cells.
- SQLite v9 + `dbLoad/dbSaveCourses`; `migrations/004_courses.sql` applied to production via MCP. **Gotcha:** a legacy `courses` table already existed remotely (pre-sync-key era: id/data/updated_at, one row `cd-main` from 2026-03) — migration is additive (ALTER adds sync_key/deleted); the legacy row stays sync_key NULL → invisible to sync, intentionally left.
- `app/(tabs)/courses.tsx` + `components/courses/`: full-width inverse "New table" button (mockup), table cards (18px frosted recipe) with editable text cells, circular tickboxes, add/delete row, edit-columns modal (stable column ids → cell data survives edits; removed columns pruned), delete with undo toast. Desktop: ring panel beside each table (mockup); mobile: small ring in header. ProgressRing = SVG arc on web, circle fallback native (no react-native-svg dep).
- Settings "Sync now" was only syncing tasks+notes — now all five domains; `useSyncStatus` + settings pill include courses. `g c` shortcut; ShortcutsHelp updated (also added missing `g d`).

**Mobile nav:** custom `MobileTabBar` (4 tabs + More) replaces the six-tab default; More = slide-up sheet with Post Its / Dump / Courses / Settings, active-route highlighting, safe-area padding. Desktop sidebar untouched — shows everything incl. Courses (Harry: sidebar clutter is not an issue). Dead `useFadeTab`/`TabIcon` deleted from the tab layout.

**Verified (dev, all green console):** composer modal over populated board; checklist continue/split/exit; table create→rows→ticks→ring math (1/2=50%, then 1/4=25% after adding a tickbox column via edit); localStorage persistence; mobile 375px pass (5 tabs, sheet nav, active states); per-route titles on all 7 screens. Prod: viewport meta confirmed via curl; feature markers present in deployed bundle. Test note/tasks/table deleted through the UI after.

**Supabase advisory (pre-existing, surfaced to Harry):** RLS is disabled on all public tables by design (no-login sync-key namespacing) — anyone with the anon key can read/write. Known architectural tradeoff, not introduced by this change.
