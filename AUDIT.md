# harry-notes audit — 2026-07-26

Broad sweep, not a line-by-line read. Prioritised toward things worth acting on.

Effort key: **XS** <30 min · **S** ~1 h · **M** half a day · **L** a day or more.
Measurements were taken in the built-in browser pane at 375×812 (mobile) and 1280×800 (desktop).

Items fixed during this session are listed under [Already resolved](#already-resolved) rather than
as findings.

---

## 1. UI redundancy

### Three ways to reach Settings
`components/nav/PersistentHeader.tsx:96` (mobile gear) · `app/(tabs)/index.tsx:178` (gear in the
greeting row) · `components/nav/Sidebar.tsx` (pinned, desktop) · plus the mobile **More** sheet.
On the mobile dashboard two gears are visible at once, ~40px apart.
**Why it matters:** duplicated affordances make the header feel unconsidered and cost dashboard
width that the greeting row needs.
**Fix:** drop the greeting-row gear — the header one is on every screen. **XS**

### Magnifier above a full search input
`app/(tabs)/index.tsx:175` sits directly above the always-visible `SearchBar`.
**Careful:** the magnifier opens the command palette, and the palette is the *only* route to the
Lists and Calendar screens (`components/CommandPalette.tsx:23-24` — both are `href: null` in the
tab navigator). Deleting the icon strands two screens.
**Fix:** decide Lists/Calendar first (§3), then either fold the palette into the SearchBar's focus
state or keep one entry point, not both. **S**

### Two floating action buttons over the notes grid
`app/(tabs)/_layout.tsx:114-147` — a 44px "new note" button stacked above a 52px quick-add, bottom
right, 104px of stack. They float over the two-column notes grid and obscure card content.
**Why it matters:** the notes grid is the densest screen in the app and the FABs land on it.
**Fix:** one FAB with a long-press/secondary action, or move "new note" into the Notes screen
header where it already has a "New note" button on desktop. **S**

### Three controls for light/dark
`app/settings.tsx` Appearance card has a **Dark mode** switch *and* a **Theme & Colours** row that
also carries the light/dark choice; `PersistentHeader.tsx:69` is a third (the header sun/moon).
**Fix:** drop the Settings switch; the header toggle is the one people use. **XS**

### Dashboard section actions duplicate the tabs
Each dashboard card has an "All tasks" / "See all" action into the same screen the tab bar already
links. Not wrong, but combined with the greeting row it means the dashboard's first screen is
mostly navigation.
**Fix:** none required — flagging as context for §2. **—**

---

## 2. Information density and hierarchy

### The greeting block costs a quarter of the first screen
`app/(tabs)/index.tsx:155`: `paddingTop: spacing[8]` (32) + 62px of greeting/date + `paddingBottom:
spacing[5]` (20) = **114px**, and the first content card starts at **y=222** on an 800px viewport —
~28% of the fold. On a 375×812 phone the 42px header and the ~89px tab bar eat into what's left.
**Why it matters:** for a daily driver the answer to "what do I need to do" should be above the
fold. Right now the greeting, the date, two icons and a search box are.
**Fix:** shrink to a single line (greeting + date inline, `size="xl"`), drop `paddingTop` to
`spacing[4]`. Recovers ~60px. **XS**

### The dashboard has two search affordances and neither is the tab bar
SearchBar plus command palette (see §1). One is enough.
**Fix:** covered by §1. **S**

---

## 3. Navigation

Current split (`components/nav/navConfig.ts`): six `NAV_ITEMS` — Home, Today, Tasks, Notes,
Courses, Dump. Mobile bar shows the first four plus **More** (Courses, Dump, Settings); the desktop
sidebar shows all six plus Settings. **Lists** and **Calendar** exist as screens but are
`href: null` and appear in neither.

**Assessment: the four-tab split is right.** Home/Today/Tasks/Notes are the daily surfaces; Courses
and Dump are episodic and belong behind More.

Two real problems:

### Lists and Calendar are effectively unreachable
`app/(tabs)/lists.tsx` (860 lines) and `app/(tabs)/calendar.tsx` (476 lines) are only reachable via
dashboard → magnifier → command palette. Both are fully built. Lists is additionally superseded:
the June migration turned lists into notes with checkbox blocks
(`lib/migrateListsToNotes.ts`), so Lists is a second UI over data Notes already owns.
**Fix — pick one:** (a) add Calendar to the More sheet and delete Lists, or (b) delete both. Either
removes ~1,300 lines. Deleting Lists needs a check that no note still depends on the lists store.
**M**

### Home and Today overlap
The dashboard renders a `TodayPanel` (`app/(tabs)/index.tsx:45`) next to a dedicated Today tab.
**Fix:** worth deciding deliberately — either the dashboard panel is a preview that links out
(current), or Today absorbs the dashboard. No change recommended without your call. **—**

---

## 4. Consistency

### Raw `Text` from react-native in screens
CLAUDE.md's hard rule says always use `components/ui/`. Ten files import `Text` from
`react-native` directly: all seven `app/(tabs)/*.tsx`, `app/+not-found.tsx`,
`app/settings/appearance.tsx`, `components/nav/PersistentHeader.tsx`.
**Why it matters:** those call sites bypass the type-scale and font-family tokens, so they drift
whenever typography changes.
**Fix:** mechanical swap; the props differ slightly (`size`/`weight` vs `style`). **M**

### Hardcoded scrim colour, five copies
`#00000055` at `components/nav/MobileTabBar.tsx:119`,
`components/dashboard/QuickAddModal.tsx:142`, `components/tasks/TaskComposerModal.tsx:157`,
`components/courses/TableEditorModal.tsx:88`, `app/(tabs)/tasks.tsx:483` — plus
`rgba(0,0,0,0.5)`/`0.55`/`0.6` variants elsewhere (20 `rgba()` literals across app + components,
several of them modal scrims at three different opacities).
**Fix:** add `colors.scrim` to `lib/theme.ts` and replace. Also fixes the inconsistent opacity. **S**

### `color="#fff"` on icons
`components/ui/TaskRow.tsx:242,250` and `components/ui/FocusTimer.tsx:146` should be
`colors.textInverse`. Breaks on light themes where the accent is pale. **XS**

### Ad-hoc modal widths
`width: 360` (dump), `340` (notes desktop column), `280` (lists pane), `260` (Select panel) —
`lib/theme.ts`'s `layout.maxWidth` tokens exist but aren't used for these.
**Fix:** extend the `layout` tokens with a modal scale. **S**

---

## 5. Performance

### `TaskRow` is the only list row that isn't memoised
`components/ui/TaskRow.tsx` — while `TaskCard`, `NoteCard`, `NoteIndexRow`, `Chip`,
`CategoryBadge`, `Section`, `MetaRow`, `PrioritySelector` all are. TaskRow is rendered in a loop on
the dashboard (`index.tsx:260`), the calendar (`calendar.tsx:458`) and search results
(`SearchResults.tsx:113`), so every parent re-render re-renders every row and its swipe handlers.
**Fix:** wrap in `React.memo`; check the `onPress` closure is stable at each call site. **S**

### The always-mounted header subscribes to all seven sync contexts
`PersistentHeader` calls `useSyncAll()` (added this session), which reads seven contexts, so the
header re-renders whenever any domain's `syncStatus` or `lastSynced` changes — including the 90 s
background pull. Cheap per render, but it's the one component mounted on every screen.
**Fix:** if it shows up in a profile, memoise the chip subtree or push the roll-up into a selector
context. Not urgent. **S**

### Seven independent 90-second pull timers
`lib/useSyncedCollection.ts` sets `PULL_INTERVAL_MS = 90_000` per collection, and seven providers
mount it — seven timers and up to seven concurrent request bursts every 90 s.
**Fix:** a single shared scheduler that walks the domains would halve the wake-ups and let the
requests be serialised. **M**

### Very large screen modules
`app/(tabs)/lists.tsx` 860 lines / 8 components, `app/(tabs)/notes.tsx` ~500,
`app/(tabs)/calendar.tsx` 476, `app/settings.tsx` ~560. On web these are separate lazy bundles, so
the parse cost lands on first navigation to that tab.
**Fix:** extract components into `components/<domain>/` as the pattern already does for tasks and
notes. Highest value on `lists.tsx` — which may be deleted anyway (§3). **M**

### Calendar builds its grids inline
`app/(tabs)/calendar.tsx` has 2 `useMemo`/`useCallback` uses in 476 lines and calls
`getDaysInMonth`/`getWeekStart`/`addDays` during render. Already recorded as deferred in CLAUDE.md,
and the screen is currently unreachable (§3) — no action while that's true. **—**

---

## 6. Dead or half-built code

| What | Where | Note |
|---|---|---|
| `useTasks()` / `useNotes()` / `useLists()` | `lib/TasksContext.tsx:315`, `NotesContext.tsx:237`, `ListsContext.tsx:282` | Marked `@deprecated`; **zero call sites** remain. Safe delete. **XS** |
| Lists + Calendar screens | `app/(tabs)/lists.tsx`, `calendar.tsx` | Built, hidden from all navigation (§3). ~1,300 lines. |
| One-shot migrations still running | `lib/migrateListsToNotes.ts`, `lib/migrateBlocksToBody.ts`, called from `app/_layout.tsx:94-95` | Guarded by `lists_migrated_v1` / `blocks_migrated_v1` flags, so they no-op forever on existing installs. Two modules + an effect kept alive for a case that can't recur. Delete after you're satisfied no device is unmigrated. **S** |
| Legacy `Note.blocks` handling | `app/settings.tsx:275` (Markdown export) | Blocks were migrated to markdown bodies; the export still branches on them. **XS** |
| Legacy `today_items_<date>` importer | `lib/TodayContext.tsx:95` | Same shape of thing — one-time, still on the load path. Lower priority: it's cheap and only runs when the new store is empty. |
| Metro `ENOENT scandir 'fonts'` log | dev only | Already documented in CLAUDE.md as harmless. No action. |

---

## 7. Feature suggestions, ranked by effort-to-value

Against the declared roadmap (field-level conflict merge, web push, PWA share target, iOS widgets,
Reminders/Google Tasks sync).

1. **PWA share target → Dump** — **S**. `share_target` in the manifest plus a route that creates a
   dump from the shared title/text/url. Turns Dump into an OS-level inbox from any app's share
   sheet, which is exactly what a frictionless-capture screen wants. Highest value per hour on the
   list, and it needs no new backend.
2. **Field-level conflict merge for note bodies** — **M**. The engine is last-write-wins per row
   (`lib/useSyncedCollection.ts` `doMerge`), so editing the same note on two devices loses one
   side's text. Everything else in the app is small-field data where LWW is fine; note bodies are
   the one place it hurts. Scope it to `notes.body` rather than a general CRDT.
3. **Web push for task reminders** — **M–L**. Needs a service worker, VAPID keys and an endpoint to
   send from; Cloudflare Pages Functions could host it, so it fits the deploy pipeline. Value
   depends on whether you want reminders on desktop — native notifications already cover iOS.
4. **Native iOS widget (WidgetKit)** — **L**. Needs an Xcode/EAS native build, which is outside the
   web-only pipeline. The Scriptable widget already covers the use case. Not worth it unless you
   move to native builds for other reasons.
5. **Reminders / Google Tasks two-way sync** — **L**. Two sources of truth, OAuth, and a
   conflict story of its own. Low value while this is single-user and the app is already the
   system of record.

Smaller wins worth folding into any of the above: `colors.scrim` token (§4), `React.memo` on
`TaskRow` (§5), deleting the deprecated context aliases (§6).

---

## Already resolved

Fixed in this session, listed so they aren't re-reported:

- Bottom safe-area inset had no single owner; `Platform.OS === "ios"` offsets never fired in the
  iOS PWA, leaving the FAB stack and toasts behind the tab bar. Now derived from the tab bar's
  reported height (`lib/TabBarHeightContext.tsx`).
- `components/ui/SyncStatusBadge.tsx` — a tappable chip imported nowhere. Deleted.
- `layout.tabBarHeight` — a token read nowhere. Deleted.
- `lib/useSyncStatus.ts` rolled up only 5 of 7 sync domains, so the header could read "synced"
  while Dumps were erroring.
- Settings carried four rows of sync status, four rows of sync-key controls, and an About card of
  static text. Collapsed to two rows plus disclosures and a footer line.
- The Dump date field defaulted every capture to today with no way to express "no date".
