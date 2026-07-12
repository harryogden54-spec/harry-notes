// harry. — Today widget (Scriptable)
//
// Home-screen widget for the "harry." app (https://harry-notes.pages.dev).
// Shows today's checklist (today_items) and tasks due today/overdue,
// pulled straight from Supabase over REST.
//
// SETUP — read docs/scriptable-widget.md in the harry-notes repo for the
// full walkthrough. Short version:
//   1. Install Scriptable from the App Store.
//   2. Create a new script in Scriptable, paste this whole file in.
//   3. In the app: Settings → Sync Key → tap the eye icon to reveal it,
//      then Copy key.
//   4. Replace SYNC_KEY below with the copied value.
//   5. Long-press your home screen → add a Scriptable widget (small or
//      medium) → configure it to run this script.
//
// The Supabase URL and anon key below are the SAME ones already shipped
// inside the public web app bundle — they are not a new secret. The only
// thing that gates your data is the sync key, which is why it is NOT
// pre-filled here: paste your own in the line below.

const SUPABASE_URL = "https://vbegnnwyrbxiqdnzvhwk.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZWdubnd5cmJ4aXFkbnp2aHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTEzMjIsImV4cCI6MjA4NzU2NzMyMn0.K2zZrYYh2b34jyqjjzVBhty3lHz0LU2q_-8RIb_0S1M";

// ⬇️ Replace this with the sync key from Settings → Sync Key in the app.
const SYNC_KEY = "PASTE-YOUR-SYNC-KEY-HERE";

const APP_URL = "https://harry-notes.pages.dev";
const REFRESH_MINUTES = 15;

// ---- Obsidian theme palette (matches lib/theme.ts in the app) ----
const COLORS = {
  bg: new Color("#0D0D0D"),
  textPrimary: new Color("#EDEDED"),
  textSecondary: new Color("#A0A0A5"),
  textTertiary: new Color("#6E6E73"),
  accent: new Color("#5B6AD0"),
  overdue: new Color("#D0705B"),
};

// ---------------------------------------------------------------------------
// Date helpers — always compute from LOCAL time, never UTC.
// ---------------------------------------------------------------------------

function pad2(n) {
  return String(n).padStart(2, "0");
}

function localTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function shortHeaderDate() {
  const d = new Date();
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  return `${weekday} ${d.getDate()}`;
}

function longHeaderDate() {
  const d = new Date();
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${month} ${d.getDate()}`;
}

function nowHHMM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Data fetching — REST against PostgREST. Row counts are small (tens of
// rows), so we fetch and filter client-side rather than fighting jsonb
// query operators.
// ---------------------------------------------------------------------------

async function fetchTable(table) {
  const url =
    `${SUPABASE_URL}/rest/v1/${table}` +
    `?select=data&deleted=is.false&sync_key=eq.${encodeURIComponent(SYNC_KEY)}`;

  const req = new Request(url);
  req.headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    // Required once RLS is enabled on these tables — rows are scoped to
    // whichever sync key is presented in this header. Sent as defense in
    // depth even while RLS is still off.
    "x-sync-key": SYNC_KEY,
  };

  const rows = await req.loadJSON();

  const status = req.response && req.response.statusCode;
  if (typeof status === "number" && (status < 200 || status >= 300)) {
    throw new Error(`${table} request failed with HTTP ${status}`);
  }
  if (!Array.isArray(rows)) {
    // Wrong/expired key or a PostgREST error body — never trust the shape.
    throw new Error(`Unexpected response shape for ${table}`);
  }

  return rows.map(r => r && r.data).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Filtering — mirrors the shapes documented for today_items / tasks.
// ---------------------------------------------------------------------------

function filterTodayItems(items, todayStr) {
  return items
    .filter(it => !it.done && it.date === todayStr)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function filterDueTasks(tasks, todayStr) {
  return tasks
    .filter(t => !t.done && !t.archived && t.due_date && t.due_date <= todayStr)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0))
    .map(t => ({ ...t, overdue: t.due_date < todayStr }));
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function addRow(container, label, opts = {}) {
  const row = container.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const bullet = row.addText(opts.overdue ? "!" : "•");
  bullet.font = Font.semiboldSystemFont(11);
  bullet.textColor = opts.overdue ? COLORS.overdue : COLORS.accent;

  row.addSpacer(5);

  const text = row.addText(label || "");
  text.font = Font.systemFont(opts.size || 12);
  text.textColor = COLORS.textPrimary;
  text.lineLimit = 1;
  text.minimumScaleFactor = 0.85;

  return row;
}

function addMoreLine(container, remaining, size = 11) {
  if (remaining <= 0) return;
  const more = container.addText(`+${remaining} more`);
  more.font = Font.systemFont(size);
  more.textColor = COLORS.textTertiary;
}

function addWordmark(widget) {
  const wordmark = widget.addText("harry.");
  wordmark.font = Font.semiboldSystemFont(14);
  wordmark.textColor = COLORS.accent;
}

function addEmptyState(container, { centered = false } = {}) {
  if (centered) {
    const row = container.addStack();
    row.addSpacer();
    const empty = row.addText("All clear ✦");
    empty.font = Font.systemFont(13);
    empty.textColor = COLORS.textSecondary;
    row.addSpacer();
  } else {
    const empty = container.addText("All clear ✦");
    empty.font = Font.systemFont(12);
    empty.textColor = COLORS.textSecondary;
  }
}

function renderSetupState(widget) {
  addWordmark(widget);
  widget.addSpacer(8);

  const msg = widget.addText("Set your sync key");
  msg.font = Font.mediumSystemFont(12);
  msg.textColor = COLORS.textPrimary;

  widget.addSpacer(4);

  const sub = widget.addText(
    "Open this script in Scriptable and replace SYNC_KEY with the code from Settings → Sync Key in the app."
  );
  sub.font = Font.systemFont(11);
  sub.textColor = COLORS.textSecondary;
  sub.lineLimit = 5;

  widget.addSpacer();
}

function renderErrorState(widget) {
  addWordmark(widget);
  widget.addSpacer(8);

  const msg = widget.addText("Couldn't sync");
  msg.font = Font.mediumSystemFont(12);
  msg.textColor = COLORS.textPrimary;

  widget.addSpacer(4);

  const sub = widget.addText(`Last attempt: ${nowHHMM()}`);
  sub.font = Font.systemFont(11);
  sub.textColor = COLORS.textTertiary;

  widget.addSpacer();
}

function renderSmall(widget, todayList, dueList) {
  const header = widget.addText(shortHeaderDate());
  header.font = Font.semiboldSystemFont(13);
  header.textColor = COLORS.accent;

  widget.addSpacer(8);

  const combined = [
    ...todayList.map(i => ({ label: i.text, overdue: false })),
    ...dueList.map(t => ({ label: t.title, overdue: t.overdue })),
  ];

  if (combined.length === 0) {
    widget.addSpacer();
    addEmptyState(widget);
    widget.addSpacer();
    return;
  }

  const shown = combined.slice(0, 3);
  for (const item of shown) {
    addRow(widget, item.label, { overdue: item.overdue });
    widget.addSpacer(6);
  }

  addMoreLine(widget, combined.length - shown.length);
  widget.addSpacer();
}

function renderColumn(container, title, items, opts) {
  const col = container.addStack();
  col.layoutVertically();

  const label = col.addText(title);
  label.font = Font.semiboldSystemFont(10);
  label.textColor = COLORS.textTertiary;

  col.addSpacer(6);

  if (items.length === 0) {
    const none = col.addText(opts.emptyLabel);
    none.font = Font.systemFont(11);
    none.textColor = COLORS.textTertiary;
    return;
  }

  const shown = items.slice(0, opts.max);
  for (const item of shown) {
    addRow(col, opts.getLabel(item), { overdue: opts.getOverdue ? opts.getOverdue(item) : false });
    col.addSpacer(5);
  }
  addMoreLine(col, items.length - shown.length, 10);
}

function renderMedium(widget, todayList, dueList) {
  const header = widget.addText(longHeaderDate());
  header.font = Font.semiboldSystemFont(13);
  header.textColor = COLORS.accent;

  widget.addSpacer(8);

  if (todayList.length === 0 && dueList.length === 0) {
    widget.addSpacer();
    addEmptyState(widget, { centered: true });
    widget.addSpacer();
    return;
  }

  const columns = widget.addStack();
  columns.layoutHorizontally();

  renderColumn(columns, "TODAY", todayList, {
    max: 5,
    emptyLabel: "Nothing scheduled",
    getLabel: i => i.text,
  });

  columns.addSpacer(16);

  renderColumn(columns, "DUE", dueList, {
    max: 5,
    emptyLabel: "Nothing due",
    getLabel: t => t.title,
    getOverdue: t => t.overdue,
  });

  widget.addSpacer();
}

// ---------------------------------------------------------------------------
// Widget assembly
// ---------------------------------------------------------------------------

async function buildWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.bg;
  widget.url = APP_URL;
  widget.setPadding(14, 14, 14, 14);
  widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);

  const family = (typeof config !== "undefined" && config.widgetFamily) || "medium";

  if (!SYNC_KEY || SYNC_KEY === "PASTE-YOUR-SYNC-KEY-HERE") {
    renderSetupState(widget);
    return widget;
  }

  let todayItemsRaw;
  let tasksRaw;
  try {
    [todayItemsRaw, tasksRaw] = await Promise.all([
      fetchTable("today_items"),
      fetchTable("tasks"),
    ]);
  } catch (err) {
    renderErrorState(widget);
    return widget;
  }

  const todayStr = localTodayStr();
  const todayList = filterTodayItems(todayItemsRaw, todayStr);
  const dueList = filterDueTasks(tasksRaw, todayStr);

  if (family === "small") {
    renderSmall(widget, todayList, dueList);
  } else {
    // Treat "large" (and anything unrecognized) as medium — this widget
    // does not have a distinct large layout.
    renderMedium(widget, todayList, dueList);
  }

  return widget;
}

// ---------------------------------------------------------------------------
// Entry point — never let anything throw unhandled out of the script.
// ---------------------------------------------------------------------------

async function run() {
  let widget;
  try {
    widget = await buildWidget();
  } catch (err) {
    // Absolute last-resort fallback.
    widget = new ListWidget();
    widget.backgroundColor = COLORS.bg;
    widget.url = APP_URL;
    const t = widget.addText("harry. — widget error");
    t.font = Font.systemFont(12);
    t.textColor = COLORS.textTertiary;
  }

  if (typeof config !== "undefined" && config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    // Running inside the Scriptable app directly — show a preview.
    await widget.presentMedium();
  }
  Script.complete();
}

run();
