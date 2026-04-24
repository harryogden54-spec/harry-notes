import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, ScrollView, SafeAreaView, Pressable,
  Platform, KeyboardAvoidingView, TextInput, RefreshControl,
  useWindowDimensions,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, SearchBar, EmptyState, Surface, GradientBackground, Skeleton, SectionHeader, TaskRow } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useTasks } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { useLists } from "@/lib/ListsContext";
import { useNotes } from "@/lib/NotesContext";
import { useStickyNotes, type StickyNote } from "@/lib/StickyNotesContext";
import { webContentStyle } from "@/lib/webLayout";
import { storage } from "@/lib/storage";
import { getTodayStr, getTomorrowStr, stripMarkdown } from "@/lib/utils";
import { MiniCalendar }       from "@/components/dashboard/MiniCalendar";
import { QuickAddModal }      from "@/components/dashboard/QuickAddModal";
import { QuickAddNoteSheet }  from "@/components/dashboard/QuickAddNoteSheet";
import { StickyNoteModal }    from "@/components/dashboard/StickyNoteModal";
import { SearchResults }      from "@/components/dashboard/SearchResults";
import { StickyCard }         from "@/components/dashboard/StickyCard";

// ─── Pastel palette (mirrors notes.tsx) ──────────────────────────────────────

const NOTE_PASTELS      = ["#FFF9C4","#FCE4EC","#E8F5E9","#E3F2FD","#EDE7F6","#FBE9E7"];
const NOTE_PASTEL_BORDERS = ["#F0E68C","#F8BBD9","#C8E6C9","#BBDEFB","#D1C4E9","#FFCCBC"];
const NOTE_PASTEL_TEXT  = "#1A1A2E";

function getPastelIndex(noteId: string): number {
  let h = 0;
  for (let i = 0; i < noteId.length; i++) h = (h * 31 + noteId.charCodeAt(i)) >>> 0;
  return h % NOTE_PASTELS.length;
}

// ─── Circular progress ring ───────────────────────────────────────────────────

function ProgressRing({ done, total, size = 32, color = "#5B6AD0" }: { done: number; total: number; size?: number; color?: string }) {
  const pct = total === 0 ? 0 : Math.max(0, Math.min(1, done / total));
  const deg = Math.round(pct * 360);
  if (Platform.OS === "web") {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          // @ts-ignore
          background: `conic-gradient(${color} ${deg}deg, rgba(120,120,120,0.15) ${deg}deg)`,
        }}>
          {/* Donut hole */}
          <View style={{
            position: "absolute", top: 5, left: 5,
            width: size - 10, height: size - 10,
            borderRadius: (size - 10) / 2,
            backgroundColor: "transparent",
          }} />
        </View>
      </View>
    );
  }
  // Native fallback: plain ring
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 3, borderColor: `${color}30`,
      borderTopColor: pct > 0 ? color : `${color}30`,
    }} />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function syncedAgo(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 10) return "Synced just now";
  if (diff < 60) return `Synced ${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `Synced ${m}m ago`;
  const h = Math.floor(m / 60);
  return `Synced ${h}h ago`;
}

function getTodayKey() {
  return `today_items_${new Date().toISOString().slice(0, 10)}`;
}

type TodayItem = { id: string; text: string; done: boolean };

// ─── Today Checklist Widget (desktop right column) ────────────────────────────

function TodayWidget() {
  const { colors } = useTheme();
  const { addTask } = useTasks();
  const [items, setItems] = useState<TodayItem[]>([]);
  const [input, setInput] = useState("");
  const todayKey = getTodayKey();

  useEffect(() => {
    storage.get<TodayItem[]>(todayKey).then(saved => { if (saved) setItems(saved); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    storage.set(todayKey, items);
  }, [items, todayKey]);

  function addItem() {
    const text = input.trim();
    if (!text) return;
    setItems(prev => [{ id: `t_${Date.now()}`, text, done: false }, ...prev]);
    setInput("");
  }

  function toggleItem(id: string) {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const rest = prev.filter(i => i.id !== id);
      return item.done ? [{ ...item, done: false }, ...rest] : [...rest, { ...item, done: true }];
    });
  }

  const active    = items.filter(i => !i.done);
  const completed = items.filter(i => i.done);
  const today     = getTodayStr();

  return (
    <View style={{ flex: 1, padding: spacing[5], gap: spacing[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text size="base" weight="semibold">Today's checklist</Text>
        <Text size="xs" style={{ color: colors.textTertiary }}>
          {active.length > 0 ? `${active.length} remaining` : completed.length > 0 ? "All done ✓" : ""}
        </Text>
      </View>

      {/* Add input */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: spacing[2],
        backgroundColor: colors.bgTertiary, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.bgBorder,
        paddingHorizontal: spacing[3], paddingVertical: spacing[2],
      }}>
        <Text style={{ color: colors.accent, fontSize: 16 }}>+</Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={addItem}
          placeholder="Add to today…"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          style={[
            { flex: 1, color: colors.textPrimary, fontSize: 14 },
            // @ts-ignore
            { outlineStyle: "none" },
          ]}
        />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {active.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => toggleItem(item.id)}
            style={{
              flexDirection: "row", alignItems: "center", gap: spacing[3],
              paddingVertical: spacing[2.5], borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
            }}
          >
            <View style={{
              width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
              borderColor: colors.bgBorder, backgroundColor: "transparent",
            }} />
            <Text size="sm" style={{ flex: 1, color: colors.textPrimary }}>{item.text}</Text>
            <Pressable
              onPress={() => {
                addTask(item.text, today);
                setItems(prev => prev.filter(i => i.id !== item.id));
              }}
              hitSlop={8}
              style={{ paddingHorizontal: spacing[1.5], paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}
            >
              <Text size="xs" style={{ color: colors.textTertiary }}>→ Tasks</Text>
            </Pressable>
          </Pressable>
        ))}
        {completed.length > 0 && (
          <View style={{ marginTop: spacing[3], gap: spacing[1] }}>
            <Text size="xs" style={{ color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: spacing[1] }}>Done</Text>
            {completed.map(item => (
              <Pressable key={item.id} onPress={() => toggleItem(item.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[1.5] }}>
                <View style={{
                  width: 18, height: 18, borderRadius: 9,
                  backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ color: "#fff", fontSize: 11, lineHeight: 18 }}>✓</Text>
                </View>
                <Text size="sm" style={{ flex: 1, color: colors.textTertiary, textDecorationLine: "line-through" }}>{item.text}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {items.length === 0 && (
          <View style={{ paddingTop: spacing[6], alignItems: "center" }}>
            <Text size="sm" secondary>Your today list is empty</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Lists Grid Card ──────────────────────────────────────────────────────────

function ListGridCard({ list, onPress }: { list: any; onPress: () => void }) {
  const { colors } = useTheme();
  const items = list.items ?? [];
  const doneCount = items.filter((i: any) => i.done).length;
  const preview = items.filter((i: any) => !i.done).slice(0, 3);

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Surface style={{ padding: spacing[3], gap: spacing[2], flex: 1 }}>
        {/* Header: color dot + name + progress ring */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
          <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: list.color }} />
          <Text size="sm" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{list.name}</Text>
          {items.length > 0 && (
            <ProgressRing done={doneCount} total={items.length} size={28} color={list.color ?? colors.accent} />
          )}
        </View>
        {/* Preview items */}
        {preview.length > 0 ? (
          <View style={{ gap: spacing[0.5] }}>
            {preview.map((item: any) => (
              <Text key={item.id} size="xs" secondary numberOfLines={1}>
                {item.content}
              </Text>
            ))}
          </View>
        ) : items.length > 0 ? (
          <Text size="xs" style={{ color: colors.accent }}>All done ✓</Text>
        ) : (
          <Text size="xs" secondary>Empty</Text>
        )}
        {items.length > 0 && (
          <Text size="xs" style={{ color: colors.textTertiary }}>
            {doneCount}/{items.length} done
          </Text>
        )}
      </Surface>
    </Pressable>
  );
}

// ─── Dashboard screen ─────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { colors }             = useTheme();
  const { tasks, addTask, updateTask, loaded: tasksLoaded, syncNow: syncTasks, lastSynced } = useTasks();
  const { showToast } = useToast();
  const { lists, loaded: listsLoaded } = useLists();
  const { notes }              = useNotes();
  const { notes: stickyNotes, addNote: addStickyNote } = useStickyNotes();
  const router                 = useRouter();
  const searchRef              = useRef<TextInput | null>(null);
  const [search, setSearch]    = useState("");
  const [showTaskSheet, setShowTaskSheet]   = useState(false);
  const [showNoteSheet, setShowNoteSheet]   = useState(false);
  const [editingNote, setEditingNote]       = useState<StickyNote | null>(null);
  const [refreshing, setRefreshing]         = useState(false);
  const [showShortcuts, setShowShortcuts]   = useState(false);
  const today                  = getTodayStr();
  const tomorrow               = getTomorrowStr();
  const [calSelected, setCalSelected] = useState(today);
  const { width }              = useWindowDimensions();
  const isDesktop              = Platform.OS === "web" && width > 1024;

  // Hydration guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const now = mounted ? new Date() : null;

  const noteFabScale = useSharedValue(1);
  const taskFabScale = useSharedValue(1);
  const noteFabStyle = useAnimatedStyle(() => ({ transform: [{ scale: noteFabScale.value }] }));
  const taskFabStyle = useAnimatedStyle(() => ({ transform: [{ scale: taskFabScale.value }] }));

  const openTasks = tasks
    .filter(t => !t.done && !t.archived)
    .sort((a, b) => {
      const aOverdue = !!a.due_date && a.due_date < today;
      const bOverdue = !!b.due_date && b.due_date < today;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      const aDate = a.due_date ?? "9999-99-99";
      const bDate = b.due_date ?? "9999-99-99";
      return aDate.localeCompare(bDate);
    });

  const overdueTasks = openTasks.filter(t => !!t.due_date && t.due_date < today);
  const todayTasks   = tasks.filter(t => !t.done && !t.archived && t.due_date === today);
  const overdueCount = overdueTasks.length;
  const todayCount   = todayTasks.length;

  const tasksByDate: Record<string, typeof tasks[number][]> = {};
  for (const task of tasks) {
    if (task.due_date) {
      if (!tasksByDate[task.due_date]) tasksByDate[task.due_date] = [];
      tasksByDate[task.due_date].push(task);
    }
  }

  const recentNote = notes.length > 0
    ? [...notes].sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))[0]
    : null;
  const sortedNotes = [...notes].sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at));

  const handleGoToLists = useCallback(() => router.push("/(tabs)/lists"), [router]);
  const handleGoToTasks = useCallback(() => router.push("/(tabs)/tasks"), [router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await syncTasks(); } catch { showToast("Sync failed — check your connection"); }
    setRefreshing(false);
  }, [syncTasks, showToast]);

  const handleQuickAddTask = useCallback((title: string, dueDate?: string, category?: import("@/lib/TasksContext").TaskCategory, uniCourse?: import("@/lib/TasksContext").UniCourse) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id = addTask(title, dueDate);
    if (category) updateTask(id, { category, uniCourse: category === "uni" ? uniCourse : undefined });
    // Silent add — do not open detail panel
  }, [addTask, updateTask]);

  const handleQuickAddNote = useCallback((content: string, colour: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addStickyNote(content, colour);
  }, [addStickyNote]);

  // Web keyboard shortcuts
  useEffect(() => {
    if (Platform.OS !== "web") return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "Escape") { setShowTaskSheet(false); setShowNoteSheet(false); setShowShortcuts(false); return; }
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setShowTaskSheet(true); }
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "t" || e.key === "T") { e.preventDefault(); router.push("/(tabs)/today"); }
      if (e.key === "?") { e.preventDefault(); setShowShortcuts(v => !v); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // ─── Shared section blocks ──────────────────────────────────────────────────

  const headerSection = (
    <View style={{ paddingTop: spacing[4], paddingBottom: spacing[3], flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
      <View style={{ flex: 1 }}>
        <Text size="2xl" weight="bold">{mounted ? greeting() : "Good morning"}</Text>
        <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
          {now ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : ""}
        </Text>
        {mounted && syncedAgo(lastSynced) && (
          <Text size="xs" style={{ color: colors.textTertiary, marginTop: 2 }}>
            {syncedAgo(lastSynced)}
          </Text>
        )}
      </View>
      <Pressable onPress={() => router.push("/settings")} hitSlop={12} style={{ padding: spacing[1], marginTop: spacing[1] }}>
        <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
      </Pressable>
    </View>
  );

  // Overdue warning banner
  const overdueBanner = overdueCount > 0 ? (
    <Pressable
      onPress={() => router.push("/(tabs)/tasks?filter=overdue" as any)}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing[2],
        backgroundColor: `${colors.danger}14`, borderRadius: radius.lg,
        borderWidth: 1, borderColor: `${colors.danger}35`,
        paddingHorizontal: spacing[3], paddingVertical: spacing[2.5],
        marginBottom: spacing[4],
      }}
    >
      <Ionicons name="warning-outline" size={15} color={colors.danger} />
      <Text size="sm" weight="medium" style={{ color: colors.danger, flex: 1 }}>
        {overdueCount} overdue task{overdueCount !== 1 ? "s" : ""}
      </Text>
      <Text size="xs" style={{ color: colors.danger }}>View →</Text>
    </Pressable>
  ) : null;

  // Today's tasks section
  const todayTasksSection = (
    <View style={{ marginBottom: spacing[5] }}>
      <SectionHeader
        label="Today"
        count={tasksLoaded ? todayCount + overdueCount : undefined}
        action={{ label: "All tasks", onPress: handleGoToTasks }}
      />
      {!tasksLoaded ? (
        <Surface style={{ padding: spacing[4], gap: spacing[3] }}>
          <Skeleton height={16} borderRadius={6} />
          <Skeleton height={16} borderRadius={6} width="80%" />
        </Surface>
      ) : todayTasks.length === 0 && overdueCount === 0 ? (
        <Surface style={{ padding: spacing[4], alignItems: "center" }}>
          <Text size="sm" secondary>No tasks due today</Text>
        </Surface>
      ) : (
        <Surface style={{ overflow: "hidden" }}>
          {overdueTasks.length > 0 && (
            <View style={{ paddingHorizontal: spacing[3], paddingTop: spacing[3], paddingBottom: spacing[1] }}>
              <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.danger, fontFamily: fontFamily.semibold, textTransform: "uppercase" }}>
                Overdue
              </Text>
            </View>
          )}
          {[...overdueTasks, ...todayTasks].slice(0, 8).map((task, i, arr) => (
            <View key={task.id} style={i === Math.min(arr.length, 8) - 1 ? { borderBottomWidth: 0 } : undefined}>
              <TaskRow task={task} onPress={() => router.push(`/(tabs)/tasks?taskId=${task.id}` as any)} />
            </View>
          ))}
          {overdueTasks.length + todayTasks.length > 8 && (
            <Pressable onPress={handleGoToTasks} style={{ padding: spacing[3], alignItems: "center", borderTopWidth: 1, borderTopColor: colors.bgBorder }}>
              <Text size="xs" style={{ color: colors.accent }}>{overdueTasks.length + todayTasks.length - 8} more tasks</Text>
            </Pressable>
          )}
        </Surface>
      )}
    </View>
  );

  // Sticky notes row
  const stickyRow = stickyNotes.length > 0 ? (
    <View style={{ marginBottom: spacing[5] }}>
      <SectionHeader label="Quick Notes" count={stickyNotes.length} action={{ label: "See all", onPress: () => router.push("/(tabs)/notes") }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[1] }}>
        {stickyNotes.map(n => (
          <StickyCard key={n.id} note={n} onPress={() => setEditingNote(n)} />
        ))}
      </ScrollView>
    </View>
  ) : null;

  // Calendar section
  const calendarSection = (
    <View style={{ marginBottom: spacing[5] }}>
      <SectionHeader label="Calendar" />
      <MiniCalendar tasksByDate={tasksByDate} selected={calSelected} onSelect={setCalSelected} today={today} />
      {(() => {
        const dayTasks = (tasksByDate[calSelected] ?? []).filter(t => !t.done);
        if (dayTasks.length === 0) return null;
        const label = calSelected === today ? "Today"
          : calSelected === tomorrow ? "Tomorrow"
          : new Date(calSelected + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        return (
          <View style={{ marginTop: spacing[3] }}>
            <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.textSecondary, fontFamily: fontFamily.semibold, textTransform: "uppercase", marginBottom: spacing[2] }}>
              {label} · {dayTasks.length}
            </Text>
            <Surface style={{ overflow: "hidden" }}>
              {dayTasks.map((task, i) => (
                <View key={task.id} style={i === dayTasks.length - 1 ? { borderBottomWidth: 0 } : undefined}>
                  <TaskRow task={task} onPress={() => router.push(`/(tabs)/tasks?taskId=${task.id}` as any)} />
                </View>
              ))}
            </Surface>
          </View>
        );
      })()}
    </View>
  );

  // Lists grid
  const listsGrid = listsLoaded && lists.length > 0 ? (
    <View style={{ marginBottom: spacing[5] }}>
      <SectionHeader label="Lists" count={lists.length} action={{ label: "See all", onPress: handleGoToLists }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
        {lists.map(l => (
          <View key={l.id} style={{ width: "47%" as any }}>
            <ListGridCard list={l} onPress={handleGoToLists} />
          </View>
        ))}
      </View>
    </View>
  ) : !listsLoaded ? (
    <View style={{ marginBottom: spacing[5] }}>
      <SectionHeader label="Lists" />
      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <Skeleton width={130} height={80} borderRadius={12} />
        <Skeleton width={130} height={80} borderRadius={12} />
      </View>
    </View>
  ) : null;

  // Notes grid (pastel cards, max 4)
  const notesGrid = sortedNotes.length > 0 ? (
    <View style={{ marginBottom: spacing[5] }}>
      <SectionHeader label="Notes" count={sortedNotes.length} action={{ label: "All notes", onPress: () => router.push("/(tabs)/notes") }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        {sortedNotes.slice(0, 4).map(note => {
          const pi = getPastelIndex(note.id);
          const bg = NOTE_PASTELS[pi];
          const border = NOTE_PASTEL_BORDERS[pi];
          return (
            <Pressable
              key={note.id}
              onPress={() => router.push(`/(tabs)/notes?openId=${note.id}` as any)}
              style={{ width: isDesktop ? "23.5%" as any : "48%" as any }}
            >
              <View style={{
                backgroundColor: bg,
                borderWidth: 1, borderColor: border,
                borderRadius: 12,
                padding: spacing[3],
                gap: spacing[1],
                minHeight: 90,
              }}>
                <Text size="xs" weight="semibold" numberOfLines={1} style={{ color: NOTE_PASTEL_TEXT }}>
                  {note.title || "Untitled"}
                </Text>
                {note.body.trim() && (
                  <Text size="xs" numberOfLines={3} style={{ color: NOTE_PASTEL_TEXT, opacity: 0.75, lineHeight: 16 }}>
                    {stripMarkdown(note.body.split("\n").find(l => l.trim()) ?? "")}
                  </Text>
                )}
                {mounted && (
                  <Text size="xs" style={{ color: NOTE_PASTEL_TEXT, opacity: 0.45, marginTop: "auto" as any }}>
                    {(() => {
                      const diff = Date.now() - new Date(note.updated_at ?? note.created_at).getTime();
                      const mins = Math.floor(diff / 60000);
                      const hours = Math.floor(diff / 3600000);
                      const days = Math.floor(diff / 86400000);
                      if (mins < 1) return "just now";
                      if (mins < 60) return `${mins}m ago`;
                      if (hours < 24) return `${hours}h ago`;
                      return `${days}d ago`;
                    })()}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  ) : null;

  return (
    <GradientBackground>
    <SafeAreaView style={{ flex: 1 }}>
      {/* Note sheet backdrop */}
      {showNoteSheet && (
        <Pressable
          onPress={() => setShowNoteSheet(false)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 10 }}
        />
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {isDesktop ? (
          // ─── Desktop: two-column above fold ───────────────────────────────
          <View style={{ flex: 1, flexDirection: "row" }}>
            {/* Left column: tasks + below-fold content */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing[5], paddingBottom: spacing[16] }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
            >
              {headerSection}
              <SearchBar value={search} onChange={setSearch} placeholder="Search tasks, lists, notes… (/)" inputRef={searchRef} />

              {search.trim() ? (
                <View style={{ marginTop: spacing[3] }}>
                  <SearchResults tasks={tasks} lists={lists} notes={notes} query={search.trim()}
                    onTaskPress={id => router.push(`/(tabs)/tasks?taskId=${id}` as any)} />
                </View>
              ) : (
                <>
                  {overdueBanner}
                  {todayTasksSection}
                  {calendarSection}
                  {stickyRow}
                  {listsGrid}
                  {notesGrid}
                </>
              )}
            </ScrollView>

            {/* Right column: Today checklist widget */}
            <View style={{
              width: 340,
              borderLeftWidth: 1, borderLeftColor: colors.bgBorder,
              backgroundColor: colors.bgSecondary,
            }}>
              <TodayWidget />
            </View>
          </View>
        ) : (
          // ─── Mobile: stacked ───────────────────────────────────────────────
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[{ padding: spacing[4], paddingBottom: spacing[24] }, webContentStyle]}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
          >
            {headerSection}
            <SearchBar value={search} onChange={setSearch} placeholder="Search tasks, lists, notes… (/)" inputRef={searchRef} />

            {search.trim() ? (
              <View style={{ marginTop: spacing[3] }}>
                <SearchResults tasks={tasks} lists={lists} notes={notes} query={search.trim()}
                  onTaskPress={id => router.push(`/(tabs)/tasks?taskId=${id}` as any)} />
              </View>
            ) : (
              <>
                {overdueBanner}
                {todayTasksSection}
                {calendarSection}
                {stickyRow}
                {listsGrid}
                {notesGrid}
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* ── Dual FABs ─────────────────────────────────────────────────────────── */}
      <View
        style={{ position: "absolute", bottom: spacing[8], right: spacing[5], alignItems: "flex-end", gap: spacing[2] }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => { setShowNoteSheet(true); setShowTaskSheet(false); }}
          onPressIn={() => { noteFabScale.value = withSpring(0.9, { damping: 20, stiffness: 300 }); }}
          onPressOut={() => { noteFabScale.value = withSpring(1.0, { damping: 20, stiffness: 300 }); }}
        >
          <Animated.View style={[noteFabStyle, {
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.bgSecondary,
            borderWidth: 1, borderColor: colors.bgBorder,
            alignItems: "center", justifyContent: "center",
          }]}>
            <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
          </Animated.View>
        </Pressable>
        <Pressable
          onPress={() => { setShowTaskSheet(true); setShowNoteSheet(false); }}
          onPressIn={() => { taskFabScale.value = withSpring(0.9, { damping: 20, stiffness: 300 }); }}
          onPressOut={() => { taskFabScale.value = withSpring(1.0, { damping: 20, stiffness: 300 }); }}
        >
          <Animated.View style={[taskFabStyle, {
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: colors.accent,
            alignItems: "center", justifyContent: "center",
          }]}>
            <Ionicons name="add" size={26} color="#fff" />
          </Animated.View>
        </Pressable>
      </View>

      {/* ── Quick-add modals ──────────────────────────────────────────────────── */}
      <QuickAddModal visible={showTaskSheet} onClose={() => setShowTaskSheet(false)} onAdd={handleQuickAddTask} />
      <QuickAddNoteSheet visible={showNoteSheet} onClose={() => setShowNoteSheet(false)} onAdd={handleQuickAddNote} />

      {/* ── Sticky note edit modal ────────────────────────────────────────────── */}
      <StickyNoteModal note={editingNote} visible={!!editingNote} onClose={() => setEditingNote(null)} />

      {/* ── Keyboard shortcuts modal ──────────────────────────────────────────── */}
      {showShortcuts && Platform.OS === "web" && (
        <Pressable
          onPress={() => setShowShortcuts(false)}
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50, alignItems: "center", justifyContent: "center" } as any}
        >
          <Pressable onPress={e => e.stopPropagation()} style={{
            backgroundColor: colors.bgSecondary,
            borderWidth: 1, borderColor: colors.bgBorder,
            borderRadius: radius.xl, padding: spacing[6], width: 360, gap: spacing[4],
          }}>
            <Text size="base" weight="semibold">Keyboard shortcuts</Text>
            <View style={{ flexDirection: "row", gap: spacing[8] }}>
              <View style={{ flex: 1, gap: spacing[2] }}>
                {([["N", "New task"], ["/", "Focus search"], ["T", "Go to Today"]] as [string, string][]).map(([key, desc]) => (
                  <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text size="sm" secondary>{desc}</Text>
                    <View style={{ backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 }}>
                      <Text size="xs" weight="medium" style={{ color: colors.textPrimary, fontFamily: "monospace" as any }}>{key}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={{ flex: 1, gap: spacing[2] }}>
                {([["?", "Show shortcuts"], ["Esc", "Close"]] as [string, string][]).map(([key, desc]) => (
                  <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text size="sm" secondary>{desc}</Text>
                    <View style={{ backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 }}>
                      <Text size="xs" weight="medium" style={{ color: colors.textPrimary, fontFamily: "monospace" as any }}>{key}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Pressable>
        </Pressable>
      )}
    </SafeAreaView>
    </GradientBackground>
  );
}
