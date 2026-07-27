# harry-notes audit

Originally written 2026-07-26; **updated 2026-07-27** after the follow-up work landed.

Single-user app — one person, two devices (iPhone home-screen PWA as the primary
surface, desktop web secondary). Judgements below are about whether *you* can get
at your own data quickly, not about a userbase.

Effort key: **XS** <30 min · **S** ~1 h · **M** half a day · **L** a day or more.
Measurements were taken in the built-in browser pane at 390×844 / 375×812 (mobile)
and 1280×800 / 1440×900 (desktop).

---

## Still open

### Two floating action buttons over the notes grid
`app/(tabs)/_layout.tsx` — a 44px "new note" button stacked above a 52px
quick-add, bottom right, ~104px of stack, floating over the two-column notes
grid. **You declined this one** (2026-07-27), so it stays; recorded only so it
isn't re-raised as new. **S**

### Home and Today overlap
The dashboard renders a `TodayPanel` next to a dedicated Today tab. **You
declined** changing this. **—**

### Three controls for light/dark
The Settings Appearance card has a **Dark mode** switch *and* a **Theme &
Colours** row that also carries the light/dark choice; the header sun/moon is a
third. **You declined.** **XS**

### QuickAddModal is a second task-creation surface
Creating and editing tasks were unified into one centred `TaskDetailModal`
(2026-07-27), but the quick-add FAB still opens `QuickAddModal`, which embeds
`TaskComposerForm` — a different set of fields with its own draft state and its
own `addTask` call. That is now the only place two task-creation UIs disagree.
**Fix:** point the quick-add FAB at `TaskDetailModal` too, and delete
`TaskComposerForm`. **S**

### `notes.tsx` is still a large single module
~560 lines, most of it one screen component. Worth knowing before acting: the
original audit claimed extracting components reduces parse cost. **That was
wrong** — on web the route is already its own lazy chunk, and a sibling module
lands in the same chunk. The only gain is navigability, so this is a
readability task, not a performance one. `app/settings.tsx` was split this way
(its 115 lines of row primitives now live in `components/settings/rows.tsx`).
**M**

### Legacy `today_items_<date>` importer
`lib/TodayContext.tsx` — one-time migration still on the load path. Cheap (only
runs when the new store is empty) and deliberately kept one more cycle. **XS**

### Legacy `Note.blocks` readers
`app/settings.tsx` Markdown export and `notePreview` still branch on `blocks`.
The original audit called these dead. **They are not** — three notes still carry
a `blocks` array server-side ("Mini projects", "New changes", "Wishlist", one
empty block each). Nothing is at risk today, but a reader that ignores `blocks`
is a silent-data-loss path while the field remains in the type, so these stay.
`blocksToMarkdown` also survives in `components/notes/utils.ts` as NoteEditor's
convert-on-open fallback. **—**

### Supabase storage bucket policies never reviewed
Table RLS shipped 2026-07-12, but the `note-images` bucket's policies have never
been looked at. **S**

### Web push for task reminders
Postponed by you (2026-07-27). Needs a service worker, VAPID keys and a send
endpoint; Cloudflare Pages Functions could host it. **M–L**

### Settings screen full visual redesign
Deferred, tracked separately. The 2026-07-26 pass was structural (row count),
not visual.

---

## Resolved

### 2026-07-27
- **PWA padding bands.** `react-native-safe-area-context@5.6.2` disagrees with
  itself: native fills a missing `edges` entry with `'off'`, but
  `SafeAreaView.web.tsx` leaves it `undefined` and `getEdgeValue`'s `default:`
  branch is `'additive'`. So `edges={["left","right"]}` **added** the top and
  bottom insets on web, on top of the header and tab bar that already own them —
  a ~47px band under the header and ~34px above the tab bar in the installed
  PWA, invisible in a browser tab where insets are 0. Fixed by
  `components/ui/SideSafeArea`, which passes the explicit object form.
- **Dashboard and search task rows could not be opened.** `TaskRow`'s title sits
  in a second `Pressable` carrying the rename gestures, with no `onPress`;
  react-native-web handles the click there rather than letting it bubble, so
  tapping the title — most of the row — did nothing. Confirmed pre-existing by
  reproducing it on the live site.
- Task create and edit unified into one centred `TaskDetailModal`, replacing the
  desktop drawer, the mobile sheet and `TaskComposerModal`.
- One level of task subcategories (`Category.parent_id`, additive to the jsonb
  row — no migration).
- Urgency added to the inline new-task row, beside date and category.
- Desktop notes tile view when no note is open.
- Courses tables condense to header + progress ring, with "Condense all".
- Design pass: type scale widened above `base`, borders-vs-shadows split by
  scheme, semantic elevation ladder documented, one motion curve
  (`motion.easing` + `transition()`), notes-grid mount stagger, and the app
  icon's star replacing the pin on pinned notes.

### 2026-07-26
- **Sync "Sync failed", attributed to Courses.** Server data was clean; the
  defect was cadence. Each collection ran its own 90s pull timer and six
  providers mount together, so they stayed in phase and fired concurrent bursts.
  A partly-failed burst left one domain in `error` with nothing scheduled to
  clear it — the only retry was the next tick 90s later, and a domain that gets
  no further writes never clears at all. `lib/syncScheduler.ts` now owns cadence:
  one heartbeat, domains walked serially, exponential backoff on failure.
  `OfflineBanner` also keyed "Sync failed" on Tasks alone, so its retry button
  re-synced the wrong domain.
- **Three-way merge for note bodies** (`lib/textMerge.ts`). Last-write-wins was
  discarding one side when the same note was edited on two devices. Line-based
  diff3 with a `sync:base:<table>` common ancestor; overlapping edits become an
  inline conflict block rather than a silent winner. `npm run test:merge`.
- Lists, Calendar and the command palette deleted (~2,080 lines). Both Supabase
  tables left intact as backup.
- PWA share target into Dump. Note the audit ranked this "highest value per
  hour", which was optimistic: **iOS Safari does not implement Web Share
  Target**, so on the primary device it needs the Shortcut in
  `docs/share-target.md`.
- Greeting block shrunk to a single line on narrow screens (114px → 60px) and
  the duplicate dashboard gear removed.
- `colors.scrim` and `layout.panel` tokens; `colors.textInverse` replacing
  `color="#fff"`.
- Raw `react-native` `Text` swept out of nav chrome. The audit claimed ten files
  including every tab screen — the real count was **three**; the screens already
  used `components/ui`.
- `React.memo` on `TaskRow` (its `onPress` had to take an id first, or the memo
  was worthless), and the sync chip moved into a memoised `SyncChip` leaf so
  every domain's status change stopped re-rendering the whole header.
- Deprecated `useTasks()`/`useNotes()` aliases, `SyncStatusBadge`,
  `layout.tabBarHeight`, `migrateListsToNotes`, and the bulk
  `migrateBlocksToBody` pass all deleted.
- Bottom safe-area inset given a single owner (`lib/TabBarHeightContext.tsx`)
  after `Platform.OS === "ios"` turned out to be false in the iOS PWA.
- Settings trimmed; Dump date field made optional with d/m/y dropdowns.

---

## Environment gotchas worth remembering

- **`Platform.OS === "ios"` is `false` in the iOS home-screen PWA** (it is
  `"web"`). Never gate safe-area or layout geometry on it.
- **`edges={[...]}` on `SafeAreaView` does not mean "only these edges" on web** —
  see above. Use `components/ui/SideSafeArea`.
- **react-native-web's `onLayout` may never deliver an initial callback.**
  Anything depending on a measured size needs a deterministic fallback.
- **`useWindowDimensions` does not update on a programmatic (CDP) viewport
  resize** — reload after resizing or you will measure the previous layout.
- **A dismissed nested RN `<Modal>` can linger in the DOM on web.** Prefer a
  conditionally rendered panel.
- **Metro's dev server reports a spurious `X is not defined`** from a lazily
  loaded module that gains a brand-new import mid-session: a shallow module
  bundle cannot resolve a dependency absent from the client's registry. It is a
  Fast Refresh artifact — verify on `expo export` output, not the dev server.
- **The web safe-area provider reads `env(safe-area-inset-*)` once at mount**
  through a hidden probe div, and its listener uses the legacy
  `webkitTransitionEnd` event Chrome no longer fires. Insets therefore cannot be
  simulated after load; inset-dependent layout needs a real device.
- `127.0.0.1:8081` is a **separate origin** from `localhost:8081`, which gives a
  clean localStorage for sync testing without touching existing dev data.
