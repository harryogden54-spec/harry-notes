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
import { storage } from "@/lib/storage";
import { getTodayStr, getTomorrowStr, stripMarkdown } from "@/lib/utils";
import { MiniCalendar }       from "@/components/dashboard/MiniCalendar";
import { QuickAddModal }      from "@/components/dashboard/QuickAddModal";
import { QuickAddNoteSheet }  from "@/components/dashboard/QuickAddNoteSheet";
import { StickyNoteModal }    from "@/components/dashboard/StickyNoteModal";
import { SearchResults }      from "@/components/dashboard/SearchResults";
import { StickyCard }         from "@/components/dashboard/StickyCard";

// ─── Pastel palette ───────────────────────────────────────────────────────────

const NOTE_PASTELS      = ["#FFF9C4","#FCE4EC","#E8F5E9","#E3F2FD","#EDE7F6","#FBE9E7"];
const NOTE_PASTEL_BORDERS = ["#F0E68C","#F8BBD9","#C8E6C9","#BBDEFB","#D1C4E9","#FFCCBC"];
const NOTE_PASTEL_TEXT  = "#1A1A2E";

function getPastelIndex(noteId: string): number {
  let h = 0;
  for (let i = 0; i < noteId.length; i++) h = (h * 31 + noteId.charCodeAt(i)) >>> 0;
  return h % NOTE_PASTELS.length;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatHeaderDate(d: Date): string {
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
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

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;

// ─── Priority dot colours ─────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#EF4444",
  high:   "#F97316",
  medium: "#EAB308",
  low:    "#6B7280",
};

// ─── Lists Grid Card (compact, 2-per-row) ────────────────────────────────────

function ListGridCard({ list, onPress }: { list: any; onPress: () => void }) {
  const { colors } = useTheme();
  const items = list.items ?? [];
  const doneCount  = items.filter((i: any) => i.done).length;
  const totalCheck = items.filter((i: any) => i.type === "checkbox").length;
  const pct        = totalCheck === 0 ? 0 : Math.round((doneCount / totalCheck) * 100);
  const listColor  = list.color ?? colors.accent;

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Surface style={{ padding: spacing[2.5], gap: spacing[1.5], flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
          <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: listColor }} />
          <Text size="xs" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{list.name}</Text>
          <Text size="xs" style={{ color: colors.textTertiary }}>{items.length}</Text>
        </View>
        {/* Linear progress bar */}
        {totalCheck > 0 && (
          <View style={{ height: 3, borderRadius: 99, backgroundColor: `${listColor}25`, overflow: "hidden" }}>
            <View style={{ height: 3, width: `${pct}%` as any, borderRadius: 99, backgroundColor: listColor }} />
          </View>
        )}
        {items.length === 0 && (
          <Text size="xs" secondary>Empty</Text>
        )}
      </Surface>
    </Pressable>
  );
}

// ─── Today Card ───────────────────────────────────────────────────────────────

function TodayCard() {
  const { colors } = useTheme();
  const [items, setItems] = useState<TodayItem[]>([]);
  const todayKey = getTodayKey();

  useEffect(() => {
    storage.get<TodayItem[]>(todayKey).then(saved => { if (saved) setItems(saved); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active    = items.filter(i => !i.done);
  const completed = items.filter(i => i.done);

  if (items.length === 0) {
    return (
      <Surface style={{ padding: spacing[4], alignItems: "center" }}>
        <Text size="sm" secondary>Nothing added to today yet.</Text>
      </Surface>
    );
  }

  return (
    <Surface style={{ overflow: "hidden" }}>
      {active.map((item, i) => (
        <View key={item.id} style={{
          flexDirection: "row", alignItems: "center", gap: spacing[2.5],
          paddingHorizontal: spacing[3], paddingVertical: spacing[2.5],
          borderBottomWidth: i === active.length - 1 && completed.length === 0 ? 0 : 1,
          borderBottomColor: colors.bgBorder,
        }}>
          <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.bgBorder }} />
          <Text size="sm" style={{ flex: 1 }} numberOfLines={1}>{item.text}</Text>
        </View>
      ))}
      {completed.length > 0 && (
        <View style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
          <Text size="xs" style={{ color: colors.textTertiary }}>{completed.length} completed</Text>
        </View>
      )}
    </Surface>
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

  // Hydration guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const now = mounted ? new Date() : null;

  const noteFabScale = useSharedValue(1);
  const taskFabScale = useSharedValue(1);
  const noteFabStyle = useAnimatedStyle(() => ({ transform: [{ scale: noteFabScale.value }] }));
  const taskFabStyle = useAnimatedStyle(() => ({ transform: [{ scale: taskFabScale.value }] }));

  // All open tasks sorted by priority then due date (for dashboard card)
  const openTasks = tasks
    .filter(t => !t.done && !t.archived)
    .sort((a, b) => {
      const ai = a.priority ? PRIORITY_ORDER.indexOf(a.priority as any) : 99;
      const bi = b.priority ? PRIORITY_ORDER.indexOf(b.priority as any) : 99;
      if (ai !== bi) return ai - bi;
      const aDate = a.due_date ?? "9999-99-99";
      const bDate = b.due_date ?? "9999-99-99";
      return aDate.localeCompare(bDate);
    });

  const overdueTasks = openTasks.filter(t => !!t.due_date && t.due_date < today);
  const overdueCount = overdueTasks.length;

  const tasksByDate: Record<string, typeof tasks[number][]> = {};
  for (const task of tasks) {
    if (task.due_date) {
      if (!tasksByDate[task.due_date]) tasksByDate[task.due_date] = [];
      tasksByDate[task.due_date].push(task);
    }
  }

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
          {now ? formatHeaderDate(now) : ""}
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

  // Tasks card — all open tasks, sorted by priority then due date, max 5
  const tasksCardItems = openTasks.slice(0, 5);
  const tasksOverflow  = openTasks.length - 5;

  const tasksCard = (
    <View style={{ marginBottom: spacing[5] }}>
      <SectionHeader
        label="Tasks"
        count={tasksLoaded ? openTasks.length : undefined}
        action={{ label: "All tasks", onPress: handleGoToTasks }}
      />
      {!tasksLoaded ? (
        <Surface style={{ padding: spacing[4], gap: spacing[3] }}>
          <Skeleton height={16} borderRadius={6} />
          <Skeleton height={16} borderRadius={6} width="80%" />
        </Surface>
      ) : openTasks.length === 0 ? (
        <Surface style={{ padding: spacing[4], alignItems: "center" }}>
          <Text size="sm" secondary>No open tasks</Text>
        </Surface>
      ) : (
        <Surface style={{ overflow: "hidden" }}>
          {tasksCardItems.map((task, i) => (
            <View key={task.id} style={i === tasksCardItems.length - 1 && tasksOverflow <= 0 ? { borderBottomWidth: 0 } : undefined}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {task.priority && (
                  <View style={{ width: 3, position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: PRIORITY_COLORS[task.priority] }} />
                )}
                <View style={{ flex: 1 }}>
                  <TaskRow task={task} onPress={() => router.push(`/(tabs)/tasks?taskId=${task.id}` as any)} />
                </View>
              </View>
            </View>
          ))}
          {tasksOverflow > 0 && (
            <Pressable onPress={handleGoToTasks} style={{ padding: spacing[3], alignItems: "center", borderTopWidth: 1, borderTopColor: colors.bgBorder }}>
              <Text size="xs" style={{ color: colors.accent }}>View all {openTasks.length} tasks →</Text>
            </Pressable>
          )}
        </Surface>
      )}
    </View>
  );

  // Today card
  const todayCard = (
    <View style={{ marginBottom: spacing[5] }}>
      <SectionHeader label="Today" action={{ label: "Open", onPress: () => router.push("/(tabs)/today") }} />
      <TodayCard />
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

  // Lists grid — compact 2-per-row
  const listsGrid = listsLoaded && lists.length > 0 ? (
    <View style={{ marginBottom: spacing[5] }}>
      <SectionHeader label="Lists" count={lists.length} action={{ label: "See all", onPress: handleGoToLists }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        {lists.map(l => (
          <View key={l.id} style={{ width: "48%" as any }}>
            <ListGridCard list={l} onPress={handleGoToLists} />
          </View>
        ))}
      </View>
    </View>
  ) : !listsLoaded ? (
    <View style={{ marginBottom: spacing[5] }}>
      <SectionHeader label="Lists" />
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        <Skeleton width={130} height={60} borderRadius={12} />
        <Skeleton width={130} height={60} borderRadius={12} />
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
              style={{ width: "48%" as any }}
            >
              <View style={{
                backgroundColor: bg,
                borderWidth: 1, borderColor: border,
                borderRadius: 12,
                padding: spacing[3],
                gap: spacing[1],
                minHeight: 80,
              }}>
                <Text size="xs" weight="semibold" numberOfLines={1} style={{ color: NOTE_PASTEL_TEXT }}>
                  {note.title || "Untitled"}
                </Text>
                {note.body.trim() && (
                  <Text size="xs" numberOfLines={2} style={{ color: NOTE_PASTEL_TEXT, opacity: 0.75, lineHeight: 16 }}>
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

  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 720;

  const mainContent = (
    <>
      {overdueBanner}
      {isWide ? (
        <View style={{ flexDirection: "row", gap: spacing[4], marginBottom: spacing[5], alignItems: "flex-start" }}>
          <View style={{ flex: 3 }}>
            <SectionHeader
              label="Tasks"
              count={tasksLoaded ? openTasks.length : undefined}
              action={{ label: "All tasks", onPress: handleGoToTasks }}
            />
            {!tasksLoaded ? (
              <Surface style={{ padding: spacing[4], gap: spacing[3] }}>
                <Skeleton height={16} borderRadius={6} />
                <Skeleton height={16} borderRadius={6} width="80%" />
              </Surface>
            ) : openTasks.length === 0 ? (
              <Surface style={{ padding: spacing[4], alignItems: "center" }}>
                <Text size="sm" secondary>No open tasks</Text>
              </Surface>
            ) : (
              <Surface style={{ overflow: "hidden" }}>
                {tasksCardItems.map((task, i) => (
                  <View key={task.id} style={i === tasksCardItems.length - 1 && tasksOverflow <= 0 ? { borderBottomWidth: 0 } : undefined}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {task.priority && (
                        <View style={{ width: 3, position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: PRIORITY_COLORS[task.priority] }} />
                      )}
                      <View style={{ flex: 1 }}>
                        <TaskRow task={task} onPress={() => router.push(`/(tabs)/tasks?taskId=${task.id}` as any)} />
                      </View>
                    </View>
                  </View>
                ))}
                {tasksOverflow > 0 && (
                  <Pressable onPress={handleGoToTasks} style={{ padding: spacing[3], alignItems: "center", borderTopWidth: 1, borderTopColor: colors.bgBorder }}>
                    <Text size="xs" style={{ color: colors.accent }}>View all {openTasks.length} tasks →</Text>
                  </Pressable>
                )}
              </Surface>
            )}
          </View>
          <View style={{ flex: 2 }}>
            <SectionHeader label="Today" action={{ label: "Open", onPress: () => router.push("/(tabs)/today") }} />
            <TodayCard />
          </View>
        </View>
      ) : (
        <>
          {tasksCard}
          {todayCard}
        </>
      )}
      {calendarSection}
      {stickyRow}
      {listsGrid}
      {notesGrid}
    </>
  );

  return (
    <GradientBackground>
    <SafeAreaView style={{ flex: 1 }}>
      {showNoteSheet && (
        <Pressable
          onPress={() => setShowNoteSheet(false)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 10 }}
        />
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: spacing[4], paddingBottom: spacing[24] }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        >
          <View style={Platform.OS === "web" ? { alignSelf: "center", width: "100%", maxWidth: 860, paddingHorizontal: 80 } : { paddingHorizontal: spacing[4] }}>
            {headerSection}
            <SearchBar value={search} onChange={setSearch} placeholder="Search tasks, lists, notes… (/)" inputRef={searchRef} />

            {search.trim() ? (
              <View style={{ marginTop: spacing[3] }}>
                <SearchResults tasks={tasks} lists={lists} notes={notes} query={search.trim()}
                  onTaskPress={id => router.push(`/(tabs)/tasks?taskId=${id}` as any)} />
              </View>
            ) : mainContent}
          </View>
        </ScrollView>
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
