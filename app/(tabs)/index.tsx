import React, { useState, useCallback } from "react";
import {
  View, ScrollView, SafeAreaView, Pressable,
  Platform, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox, SearchBar, EmptyState, GlassCard } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { useTasks, type Task, type Priority } from "@/lib/TasksContext";
import { useLists, type NoteList } from "@/lib/ListsContext";
import { useNotes, type Note } from "@/lib/NotesContext";
import { webContentStyle } from "@/lib/webLayout";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "#F26464", high: "#F5A623", medium: "#E8C84A", low: "#5B6AD0",
};

function getTodayStr() { return new Date().toISOString().slice(0, 10); }
function getTomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

function toStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDueDate(date: string, today: string, tomorrow: string): { label: string; color: string } {
  if (date < today)      return { label: "Overdue",  color: "#F26464" };
  if (date === today)    return { label: "Today",    color: "#E8C84A" };
  if (date === tomorrow) return { label: "Tomorrow", color: "#5B6AD0" };
  return {
    label: new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    color: "#9A9A9A",
  };
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^---+$/gm, "")
    .trim();
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label, count, subtitle, action }: {
  label: string;
  count?: number;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[3] }}>
      <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1, flex: 1 }}>
        {label}{count !== undefined ? ` · ${count}` : ""}
      </Text>
      {subtitle && <Text size="xs" secondary>{subtitle}</Text>}
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text size="xs" style={{ color: colors.accent }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({ tasksByDate, selected, onSelect, today }: {
  tasksByDate: Record<string, Task[]>;
  selected: string;
  onSelect: (d: string) => void;
  today: string;
}) {
  const { colors } = useTheme();
  const now = new Date(today + "T00:00:00");
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const firstDay    = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <GlassCard style={{ marginBottom: spacing[5], padding: spacing[4] }}>
      {/* Month nav */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[3] }}>
        <Pressable onPress={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })} hitSlop={12} style={{ padding: spacing[1] }}>
          <Text style={{ color: colors.textSecondary, fontSize: 20 }}>‹</Text>
        </Pressable>
        <Pressable onPress={() => { const n = new Date(); setView({ y: n.getFullYear(), m: n.getMonth() }); }} hitSlop={8}>
          <Text size="sm" weight="semibold">{MONTHS[view.m]} {view.y}</Text>
        </Pressable>
        <Pressable onPress={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 })} hitSlop={12} style={{ padding: spacing[1] }}>
          <Text style={{ color: colors.textSecondary, fontSize: 20 }}>›</Text>
        </Pressable>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: "row", marginBottom: spacing[1] }}>
        {DAYS.map(d => (
          <View key={d} style={{ flex: 1, alignItems: "center", paddingVertical: spacing[0.5] }}>
            <Text size="xs" tertiary weight="semibold" style={{ letterSpacing: 0.5 }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: "row" }}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={{ flex: 1, height: 38 }} />;
            const str       = toStr(view.y, view.m, day);
            const isToday   = str === today;
            const isSel     = str === selected;
            const dayTasks  = tasksByDate[str] ?? [];
            const openTasks = dayTasks.filter(t => !t.done);
            const hasOpen   = openTasks.length > 0;
            const isPast    = str < today;
            const topP      = openTasks.find(t => t.priority === "urgent")?.priority
              ?? openTasks.find(t => t.priority === "high")?.priority
              ?? openTasks.find(t => t.priority === "medium")?.priority
              ?? openTasks.find(t => t.priority === "low")?.priority;
            const dotColor  = topP ? PRIORITY_COLOR[topP] : colors.accent;

            return (
              <Pressable
                key={col}
                onPress={() => onSelect(str)}
                style={{
                  flex: 1, height: 38, alignItems: "center", justifyContent: "center",
                  borderRadius: radius.md,
                  backgroundColor: isSel ? colors.accent : isToday ? `${colors.accent}22` : "transparent",
                }}
              >
                <Text
                  size="sm"
                  weight={isToday ? "bold" : undefined}
                  style={{ color: isSel ? "#fff" : isToday ? colors.accent : isPast ? colors.textTertiary : colors.textPrimary }}
                >
                  {day}
                </Text>
                {hasOpen && (
                  <View style={{
                    width: 4, height: 4, borderRadius: 99,
                    backgroundColor: isSel ? "#ffffff88" : dotColor,
                    marginTop: 1,
                  }} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </GlassCard>
  );
}

// ─── List shelf card ──────────────────────────────────────────────────────────

function ListShelfCard({ list, onPress }: { list: NoteList; onPress: () => void }) {
  const { colors } = useTheme();
  const color    = list.color ?? "#5B6AD0";
  const items    = list.items ?? [];
  const total    = items.filter(i => i.type === "checkbox").length;
  const done     = items.filter(i => i.type === "checkbox" && i.done).length;
  const progress = total > 0 ? done / total : null;

  return (
    <Pressable onPress={onPress} style={{ marginRight: spacing[3] }}>
      <GlassCard style={{
        width: 130,
        borderTopWidth: 3,
        borderTopColor: color,
        padding: spacing[3],
        gap: spacing[2],
      }}>
        <View style={{ height: 5, width: 40, borderRadius: 99, backgroundColor: color }} />
        <Text size="sm" weight="semibold" numberOfLines={1}>{list.name}</Text>
        <Text size="xs" secondary>
          {items.length === 0 ? "Empty" : `${items.length} item${items.length !== 1 ? "s" : ""}`}
        </Text>
        {progress !== null && (
          <View style={{ height: 3, backgroundColor: colors.bgTertiary, borderRadius: 99 }}>
            <View style={{ height: 3, width: `${Math.round(progress * 100)}%` as any, backgroundColor: color, borderRadius: 99 }} />
          </View>
        )}
      </GlassCard>
    </Pressable>
  );
}

// ─── Pinned list card ─────────────────────────────────────────────────────────

function PinnedListCard({ list, onPress }: { list: NoteList; onPress: () => void }) {
  const { colors } = useTheme();
  const { toggleItem } = useLists();
  const color = list.color ?? "#5B6AD0";
  const items = list.items ?? [];
  const activeItems = items.filter(i => !i.done).slice(0, 5);
  const doneCount   = items.filter(i => i.done).length;

  return (
    <GlassCard style={{ marginBottom: spacing[5], borderTopWidth: 3, borderTopColor: color }}>
      <View style={{ padding: spacing[4], paddingBottom: activeItems.length > 0 ? spacing[2] : spacing[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: activeItems.length > 0 ? spacing[3] : 0 }}>
          <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: color }} />
          <Text size="sm" weight="semibold" style={{ flex: 1 }}>{list.name}</Text>
          <Pressable onPress={onPress} hitSlop={8}>
            <Text size="xs" style={{ color: colors.accent }}>See all</Text>
          </Pressable>
        </View>
        {activeItems.map(item => (
          <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[1.5] }}>
            {item.type === "checkbox" ? (
              <Checkbox checked={item.done} onToggle={() => toggleItem(list.id, item.id)} size={15} />
            ) : (
              <View style={{ width: 4, height: 4, borderRadius: 99, backgroundColor: colors.textTertiary, marginHorizontal: 4 }} />
            )}
            <Text size="sm" numberOfLines={1} style={{ flex: 1 }}>{item.content}</Text>
          </View>
        ))}
        {doneCount > 0 && (
          <Text size="xs" secondary style={{ marginTop: spacing[1] }}>{doneCount} completed</Text>
        )}
        {items.length === 0 && (
          <Text size="sm" secondary>Empty list</Text>
        )}
      </View>
    </GlassCard>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onPress }: { task: Task; onPress: () => void }) {
  const { colors } = useTheme();
  const { toggleTask } = useTasks();
  const priorityColor = task.priority ? PRIORITY_COLOR[task.priority] : undefined;
  const due           = task.due_date ? formatDueDate(task.due_date, getTodayStr(), getTomorrowStr()) : null;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[3],
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.bgBorder,
      }}
    >
      <Checkbox
        checked={task.done}
        onToggle={() => toggleTask(task.id)}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          size="sm"
          weight="medium"
          numberOfLines={1}
          style={{
            color: task.done ? colors.textTertiary : colors.textPrimary,
            textDecorationLine: task.done ? "line-through" : "none",
          }}
        >
          {task.title}
        </Text>
        {(task.tags ?? []).length > 0 && (
          <View style={{ flexDirection: "row", gap: spacing[1] }}>
            {(task.tags ?? []).slice(0, 3).map(tag => (
              <Text key={tag} size="xs" style={{ color: colors.textTertiary }}>#{tag}</Text>
            ))}
          </View>
        )}
      </View>
      {due && (
        <View style={{
          backgroundColor: `${due.color}18`,
          borderRadius: radius.sm,
          paddingHorizontal: spacing[2],
          paddingVertical: 3,
          borderWidth: 1,
          borderColor: `${due.color}40`,
        }}>
          <Text size="xs" weight="medium" style={{ color: due.color }}>{due.label}</Text>
        </View>
      )}
      {priorityColor && (
        <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: priorityColor }} />
      )}
    </Pressable>
  );
}

// ─── Search results ───────────────────────────────────────────────────────────

function SearchResults({ tasks, lists, notes, query, onTaskPress }: {
  tasks: Task[];
  lists: NoteList[];
  notes: Note[];
  query: string;
  onTaskPress: (id: string) => void;
}) {
  const { colors } = useTheme();
  const q = query.toLowerCase();
  const matchTasks = tasks.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.description?.toLowerCase().includes(q) ||
    (t.tags ?? []).some(tag => tag.includes(q))
  );
  const matchLists = lists.filter(l =>
    l.name.toLowerCase().includes(q) ||
    (l.items ?? []).some(i => i.content.toLowerCase().includes(q))
  );
  const matchNotes = notes.filter(n =>
    n.title.toLowerCase().includes(q) ||
    n.body.toLowerCase().includes(q)
  );

  if (matchTasks.length === 0 && matchLists.length === 0 && matchNotes.length === 0) {
    return (
      <EmptyState type="search" title="No results" subtitle={`Nothing found for "${query}".`} />
    );
  }

  return (
    <View>
      {matchTasks.length > 0 && (
        <View style={{ marginBottom: spacing[5] }}>
          <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[2] }}>
            Tasks · {matchTasks.length}
          </Text>
          <GlassCard style={{ overflow: "hidden" }}>
            {matchTasks.map((t, i) => (
              <View key={t.id} style={i === matchTasks.length - 1 ? { borderBottomWidth: 0 } : undefined}>
                <TaskRow task={t} onPress={() => onTaskPress(t.id)} />
              </View>
            ))}
          </GlassCard>
        </View>
      )}
      {matchNotes.length > 0 && (
        <View style={{ marginBottom: spacing[5] }}>
          <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[2] }}>
            Notes · {matchNotes.length}
          </Text>
          {matchNotes.map(n => {
            const preview = stripMarkdown(n.body.split("\n").find(l => l.trim()) ?? "");
            return (
              <Pressable key={n.id} onPress={() => router.push(`/(tabs)/notes?openId=${n.id}` as any)}>
                <GlassCard style={{ padding: spacing[3], marginBottom: spacing[2] }}>
                  <Text size="sm" weight="semibold" numberOfLines={1}>{n.title || "Untitled"}</Text>
                  {preview ? <Text size="xs" secondary numberOfLines={1} style={{ marginTop: 2 }}>{preview}</Text> : null}
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      )}
      {matchLists.length > 0 && (
        <View>
          <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[2] }}>
            Lists · {matchLists.length}
          </Text>
          {matchLists.map(l => {
            const color = l.color ?? "#5B6AD0";
            const items = l.items ?? [];
            return (
              <GlassCard key={l.id} style={{ padding: spacing[3], marginBottom: spacing[2], borderLeftWidth: 3, borderLeftColor: color }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                  <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: color }} />
                  <Text size="sm" weight="semibold">{l.name}</Text>
                  <Text size="xs" secondary style={{ marginLeft: "auto" as any }}>{items.length} items</Text>
                </View>
              </GlassCard>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Dashboard screen ─────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { colors }            = useTheme();
  const { tasks }             = useTasks();
  const { lists }             = useLists();
  const { notes }             = useNotes();
  const router                = useRouter();
  const [search, setSearch]   = useState("");
  const [fabOpen, setFabOpen] = useState(false);
  const today                 = getTodayStr();
  const tomorrow              = getTomorrowStr();
  const now                   = new Date();
  const [calSelected, setCalSelected] = useState(today);

  const openTasks = tasks
    .filter(t => !t.done)
    .sort((a, b) => {
      const aDate = a.due_date ?? "9999-99-99";
      const bDate = b.due_date ?? "9999-99-99";
      return aDate.localeCompare(bDate);
    });

  const tasksByDate: Record<string, Task[]> = {};
  for (const task of tasks) {
    if (task.due_date) {
      if (!tasksByDate[task.due_date]) tasksByDate[task.due_date] = [];
      tasksByDate[task.due_date].push(task);
    }
  }

  const overdueCount = tasks.filter(t => !t.done && !!t.due_date && t.due_date < today).length;
  const todayCount   = tasks.filter(t => !t.done && t.due_date === today).length;

  const pinnedList = lists.find(l => l.pinned);

  const handleGoToLists = useCallback(() => router.push("/(tabs)/lists"), [router]);
  const handleGoToTasks = useCallback(() => router.push("/(tabs)/tasks"), [router]);

  const fabActions = [
    { label: "New Note",  icon: "✎", onPress: () => { setFabOpen(false); router.push("/(tabs)/notes?create=1" as any); } },
    { label: "New List",  icon: "≡", onPress: () => { setFabOpen(false); router.push("/(tabs)/lists?create=1" as any); } },
    { label: "New Task",  icon: "+", onPress: () => { setFabOpen(false); router.push("/(tabs)/tasks?create=1" as any); } },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {/* Background blobs for glass depth */}
      <View style={{ position: "absolute", top: 80,  left: -60,  width: 260, height: 260, borderRadius: 130, backgroundColor: colors.accent, opacity: 0.05 }} pointerEvents="none" />
      <View style={{ position: "absolute", top: 320, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: colors.accent, opacity: 0.04 }} pointerEvents="none" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ padding: spacing[4], paddingBottom: spacing[24] }, webContentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ───────────────────────────────────────────────────── */}
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5], flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text size="2xl" weight="bold">{greeting()}</Text>
              <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
                {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </Text>
              {(overdueCount > 0 || todayCount > 0) && (
                <View style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[2] }}>
                  {overdueCount > 0 && (
                    <View style={{ backgroundColor: "#F2646418", borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 3, borderWidth: 1, borderColor: "#F2646440" }}>
                      <Text size="xs" weight="medium" style={{ color: "#F26464" }}>{overdueCount} overdue</Text>
                    </View>
                  )}
                  {todayCount > 0 && (
                    <View style={{ backgroundColor: `${colors.accent}18`, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 3, borderWidth: 1, borderColor: `${colors.accent}40` }}>
                      <Text size="xs" weight="medium" style={{ color: colors.accent }}>{todayCount} today</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <Pressable
              onPress={() => router.push("/settings")}
              hitSlop={12}
              style={{ padding: spacing[1], marginTop: spacing[1] }}
            >
              <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* ── Search ───────────────────────────────────────────────────── */}
          <SearchBar value={search} onChange={setSearch} placeholder="Search tasks, lists, notes…" />

          {search.trim() ? (
            <View style={{ marginTop: spacing[3] }}>
              <SearchResults
                tasks={tasks}
                lists={lists}
                notes={notes}
                query={search.trim()}
                onTaskPress={id => router.push(`/(tabs)/tasks?taskId=${id}` as any)}
              />
            </View>
          ) : (
            <>
              {/* ── Tasks ──────────────────────────────────────────────── */}
              <View style={{ marginTop: spacing[4], marginBottom: spacing[5] }}>
                <SectionHeader
                  label="Tasks"
                  count={openTasks.length}
                  action={{ label: "See all", onPress: handleGoToTasks }}
                />
                {openTasks.length === 0 ? (
                  <EmptyState type="tasks" title="All clear" subtitle="No open tasks — enjoy the moment." />
                ) : (
                  <GlassCard style={{ overflow: "hidden" }}>
                    {openTasks.slice(0, 8).map((task, i) => (
                      <View
                        key={task.id}
                        style={i === Math.min(openTasks.length, 8) - 1 ? { borderBottomWidth: 0 } : undefined}
                      >
                        <TaskRow task={task} onPress={() => router.push(`/(tabs)/tasks?taskId=${task.id}` as any)} />
                      </View>
                    ))}
                    {openTasks.length > 8 && (
                      <Pressable onPress={handleGoToTasks} style={{ padding: spacing[3], alignItems: "center", borderTopWidth: 1, borderTopColor: colors.bgBorder }}>
                        <Text size="xs" style={{ color: colors.accent }}>{openTasks.length - 8} more tasks</Text>
                      </Pressable>
                    )}
                  </GlassCard>
                )}
              </View>

              {/* ── Calendar ───────────────────────────────────────────── */}
              <View style={{ marginBottom: spacing[2] }}>
                <SectionHeader label="Calendar" />
                <MiniCalendar
                  tasksByDate={tasksByDate}
                  selected={calSelected}
                  onSelect={setCalSelected}
                  today={today}
                />
                {/* Selected day tasks */}
                {(() => {
                  const dayTasks = (tasksByDate[calSelected] ?? []).filter(t => !t.done);
                  if (dayTasks.length === 0) return null;
                  return (
                    <View style={{ marginBottom: spacing[4] }}>
                      <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[2] }}>
                        {calSelected === today ? "Today" : calSelected === tomorrow ? "Tomorrow" : new Date(calSelected + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {dayTasks.length}
                      </Text>
                      <GlassCard style={{ overflow: "hidden" }}>
                        {dayTasks.map((task, i) => (
                          <View key={task.id} style={i === dayTasks.length - 1 ? { borderBottomWidth: 0 } : undefined}>
                            <TaskRow task={task} onPress={() => router.push(`/(tabs)/tasks?taskId=${task.id}` as any)} />
                          </View>
                        ))}
                      </GlassCard>
                    </View>
                  );
                })()}
              </View>

              {/* ── Pinned list ─────────────────────────────────────────── */}
              {pinnedList && (
                <View style={{ marginBottom: spacing[2] }}>
                  <SectionHeader label="Pinned list" action={{ label: "All lists", onPress: handleGoToLists }} />
                  <PinnedListCard list={pinnedList} onPress={handleGoToLists} />
                </View>
              )}

              {/* ── Lists shelf ────────────────────────────────────────── */}
              {lists.length > 0 && (
                <View style={{ marginBottom: spacing[5] }}>
                  <SectionHeader label="Lists" action={{ label: "See all", onPress: handleGoToLists }} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: spacing[1] }}
                  >
                    {lists.map(l => (
                      <ListShelfCard key={l.id} list={l} onPress={handleGoToLists} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FAB backdrop */}
      {fabOpen && (
        <Pressable
          onPress={() => setFabOpen(false)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}

      {/* ── FAB ──────────────────────────────────────────────────────────── */}
      <View style={{ position: "absolute", bottom: spacing[8], right: spacing[5], alignItems: "flex-end", gap: spacing[2] }} pointerEvents="box-none">
        {fabOpen && fabActions.map(action => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            style={{
              flexDirection: "row", alignItems: "center", gap: spacing[2],
              backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.bgBorder,
              borderRadius: radius.xl, paddingHorizontal: spacing[4], paddingVertical: spacing[2.5],
            }}
          >
            <Text size="sm" style={{ color: colors.textSecondary }}>{action.icon}</Text>
            <Text size="sm" weight="medium">{action.label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setFabOpen(v => !v)}
          style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: fabOpen ? colors.bgTertiary : colors.accent,
            alignItems: "center", justifyContent: "center",
            borderWidth: 1, borderColor: fabOpen ? colors.bgBorder : "transparent",
          }}
        >
          <Text style={{ color: fabOpen ? colors.textSecondary : "#fff", fontSize: 24, lineHeight: 28, marginTop: -2 }}>
            {fabOpen ? "✕" : "+"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
