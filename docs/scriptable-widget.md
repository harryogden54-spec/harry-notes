# iOS home-screen widget (via Scriptable)

This gives you a home-screen widget for **harry.** showing today's checklist,
any tasks due today or overdue, and — on the large size — your pinned notes
too. It's built with [Scriptable](https://scriptable.app), a free iOS app
that runs small JavaScript scripts and can render them as home-screen
widgets — no Apple developer account or app build required.

The widget talks directly to the same Supabase database the app syncs to,
so it always reflects your latest data (refreshed roughly every 15 minutes,
per iOS's own widget scheduling).

The widget follows the system's Light/Dark Mode setting automatically —
every color swaps to a matching light or dark variant, same as the app
itself, so it looks right whichever appearance your phone is using.

## 1. Install Scriptable

Install **Scriptable** from the App Store (it's free): <https://apps.apple.com/app/scriptable/id1405459188>

## 2. Create the script

1. On the iPhone, open the script's **raw** file in Safari:
   <https://raw.githubusercontent.com/harryogden54-spec/harry-notes/master/widget/scriptable-today.js>
   (sign in to GitHub first if the repo is private).

   ⚠️ Always copy from the **raw** view. Copying the code out of a chat app,
   an email, Notes, or GitHub's *rendered* file view can silently mangle it —
   long lines get wrapped, and characters like `` ` ``, `*` and `_` get eaten
   by markdown formatting — which produces baffling syntax errors when the
   script runs (e.g. `Unexpected identifier`, `Expected ')'`).
2. Tap-and-hold → **Select All** → **Copy**.
3. Open Scriptable and tap the **+** button (top right) to create a new script.
4. Select all the placeholder code Scriptable gives you, delete it, and paste.
5. Tap the script's name at the top ("Untitled Script") and rename it to
   something you'll recognize later, e.g. `harry Today`.

If you're **updating** an existing script to a newer version: open the script,
Select All, delete, and paste the new copy — don't paste below or above the
old code, and re-add your sync key afterwards (step 4 below).

## 3. Find your sync key in the app

The widget needs your **sync key** so it knows which data is yours (the
same key you'd enter on a second device to sync with it).

1. Open the harry. app → **Settings**.
2. Under **Sync Key**, tap the **eye icon** next to "Sync key" to reveal it
   (it's masked by default).
3. Tap **Copy key** to copy it to your clipboard. (If you don't have a
   sync key set yet, tap **Set sync key** or **Generate new key** first —
   the widget can't show anything until sync is turned on.)

## 4. Paste your key into the script

Back in Scriptable, find this line near the top of the script:

```js
const SYNC_KEY = "PASTE-YOUR-SYNC-KEY-HERE";
```

Replace `PASTE-YOUR-SYNC-KEY-HERE` with the key you copied, keeping the
quotes, e.g.:

```js
const SYNC_KEY = "ABCD-1234-WXYZ";
```

Tap **Done** (top left) to save.

You can preview it right away — tap the **Play** button at the bottom of
the editor. It should show a preview of the large-size widget (TODAY / DUE
/ PINNED NOTES sections) so you can see everything the widget can display
in one go, regardless of which size you actually place on your home
screen. If something looks off, see Troubleshooting below.

## 5. Add the widget to your home screen

1. Long-press an empty area of your home screen until the icons jiggle.
2. Tap the **+** button in the top corner.
3. Search for **Scriptable** and choose a size:
   - **Small** — a compact combined list of today's items and due tasks.
   - **Medium** — a two-column layout: a TODAY column and a DUE column.
   - **Large** — stacked full-width sections, top to bottom: TODAY, DUE,
     then **PINNED NOTES** (the titles of any notes you've pinned in the
     app). Empty sections are skipped entirely, and each section shows a
     "+N more" line if there's more than fits.
4. Tap **Add Widget**, then tap the newly placed widget on your home
   screen to configure it.
5. Set:
   - **Script** → the script you created (e.g. `harry Today`)
   - **When Interacting** → "Run Script" (default is fine)
6. Tap outside the widget to finish.

## What to expect

- The header shows today's date, then your undone **Today** items for
  today, and tasks that are **due today or overdue**. Done items never
  show up in any size — small, medium, or large.
- On the **large** size only, a third **PINNED NOTES** section lists the
  titles of notes you've pinned in the app (most recently updated first).
  Note *pages* (the tabs inside a multi-page note) and archived notes are
  never shown here — only top-level pinned notes.
- Each large-widget section is skipped entirely if it has nothing to show,
  and the space is reused by whichever section still has content — e.g. an
  empty TODAY section lets DUE show more rows than it normally would.
- The whole widget follows **system Light/Dark Mode** — background, text,
  and accent colors all swap automatically, matching the app's own light
  and dark palettes.
- Tapping the widget opens the harry. app in Safari
  (`https://harry-notes.pages.dev`).
- iOS decides exactly when to refresh widgets — the script asks for a
  refresh roughly every **15 minutes**, but iOS may refresh sooner or
  later depending on battery and usage. Pulling down the widget doesn't
  force a refresh; if you need the very latest data right now, open the
  app instead.
- If there's nothing due, scheduled, or pinned, it shows a quiet
  "All clear ✦".

## Troubleshooting

**"Exception occurred — Syntax Error" (e.g. `Unexpected identifier`, `Expected ')' to end an argument list`)**
The pasted copy of the script got corrupted in transit — this happens when
the code is copied from anywhere other than the raw file (rendered GitHub
view, a chat message, Mail, Notes…): markdown-significant characters
(backticks, `*`, `_`) get stripped and long lines get re-wrapped. The file
in the repo is valid. Fix: delete everything in the Scriptable editor and
re-paste from the **raw** URL in step 2 above, then re-add your sync key.
A widget already placed on the home screen keeps running its own saved copy
of whichever script it points at, so it can keep working (or keep showing
old behavior) while your edited copy is broken — the two are independent.

**Widget is empty or just says "Set your sync key"**
The `SYNC_KEY` placeholder wasn't replaced, or the quotes got deleted
when editing. Re-open the script in Scriptable and check the line looks
like `const SYNC_KEY = "YOUR-ACTUAL-KEY";` with no extra spaces.

**Widget shows nothing even though you have tasks/today items**
Most likely the sync key doesn't match. Go back to Settings → Sync Key
in the app, copy it again (tap the eye icon first to make sure you copy
the real key, not the masked `••••` version), and re-paste it into the
script exactly.

**Widget says "Couldn't sync"**
This means the request to Supabase failed (no network, or Supabase was
briefly unreachable). It'll clear up on the next refresh — no action
needed unless it persists, in which case check your phone has an internet
connection and try re-running the script from inside Scriptable to see
a more detailed error.

**Widget looks stale / doesn't seem to update**
This is normal iOS behavior — widget refresh timing is controlled by the
OS, not the script, and is not instant. Opening the app itself always
shows live data.

**I changed my sync key later**
If you generate a new sync key or change it in the app, you'll need to
edit the script in Scriptable and paste the new key in, then re-run it
once from inside Scriptable so the widget picks up the change.
