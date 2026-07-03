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
| 5 | WYSIWYG note editor (A + C2) | 5a+5b shipped, 5c remaining | 2026-07-03 |
| 6 | Polish sweep (remaining B items) | not started | — |

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
