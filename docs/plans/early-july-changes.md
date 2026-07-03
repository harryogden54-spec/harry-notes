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
| 0 | Programme setup + C3 icon cache-bust | in progress | — |
| 1 | Accent palette expansion (C1) | not started | — |
| 2 | Tasks redesign — desktop web | not started | — |
| 3 | Task composer modal + mobile tasks | not started | — |
| 4 | Notes list/grid redesign | not started | — |
| 5 | WYSIWYG note editor (A + C2) | not started | — |
| 6 | Polish sweep (remaining B items) | not started | — |

## Decision log

- **Notes editor stays a side panel**, not the design's full-page layout — keeps the existing desktop master-detail pattern (notes list left, editor right).
- **C2 = true WYSIWYG.** Bold/italic/headers render live; no visible markdown markers; no Preview toggle on web. Markdown remains the underlying storage/sync format — the editor serialises to/from it.
- **Uncategorised tasks** render in a full-width "Unsorted" strip above the Personal/Uni columns (design only shows 2 columns; `category` is optional in the data model).
- **Accent IDs are preserved** — the 6 existing accent entries keep their ids/values verbatim; ~24-28 new entries are derived via HSL math. No storage migration needed for `accent_id_v2`.
- **WYSIWYG editor has an explicit fallback gate** (end of Phase 5a): if contentEditable proves too unstable, fall back to a styled markdown editor (syntax highlighting overlay, markers still visible) rather than shipping something broken.
- **Tech debt items from flagged_findings.md are excluded** from this programme (sync drill, deprecated context aliases, calendar memoization) — still tracked separately in memory for a future session.
- **RN-web Modal `pointerEvents` warning**: accepted as a known cosmetic issue, documented in CLAUDE.md rather than patched (no patch-package step in the deploy pipeline).

## Phase 0 checklist

- [x] Copy design file into `docs/design/`
- [x] Create this tracker
- [x] Cache-bust PWA icon hrefs (`scripts/inject-pwa-head.js`, `public/manifest.json`)
- [ ] Update `CLAUDE.md` "In progress"
- [ ] Update memory (`flagged_findings.md` note + project pointer to this doc)
- [ ] `npm run typecheck` green
- [ ] Commit + deploy + verify live icon URLs (`?v=2`)
- [ ] Harry re-pins the PWA shortcut to pick up the new icon
