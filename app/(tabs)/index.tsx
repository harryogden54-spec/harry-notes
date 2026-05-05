import React, { useState, useCallback, useEffect } from "react";
import {
  View, ScrollView, SafeAreaView, Pressable,
  Platform, RefreshControl,
  useWindowDimensions,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Surface, GradientBackground, Skeleton, SectionHeader, TaskRow } from "@/components/ui";
import { spacing } from "@/lib/theme";
import { useTasks } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { useLists } from "@/lib/ListsContext";
import { useNotes } from "@/lib/NotesContext";
import { storage } from "@/lib/storage";
import { getTodayStr, stripMarkdown } from "@/lib/utils";
import { QuickAddModal }      from "@/components/dashboard/QuickAddModal";
import { useNoteColors } from "@/lib/useNoteColors";

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
  const { tasks, addTask, updateTask, loaded: tasksLoaded, syncNow: syncTasks } = useTasks();
  const { showToast } = useToast();
  const { lists, loaded: listsLoaded } = useLists();
  const { notes }              = useNotes();
  const noteColors             = useNoteColors();
  const router                 = useRouter();
  const [showTaskSheet, setShowTaskSheet]   = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  const today                  = getTodayStr();

  // Hydration guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const now = mounted ? new Date() : null;

  const taskFabScale = useSharedValue(1);
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

  // Web keyboard shortcuts (dashboard-local: N = new task, T = go to today)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "Escape") { setShowTaskSheet(false); return; }
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setShowTaskSheet(true); }
      if (e.key === "t" || e.key === "T") { e.preventDefault(); router.push("/(tabs)/today"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 768;
  const isNarrowMobile = Platform.OS !== "web" && width < 768;
  // Cards own their own horizontal margin on narrow mobile (outer container has no padding)
  const cm = isNarrowMobile ? { marginHorizontal: spacing[3] } : {};

  // ─── Shared section blocks ──────────────────────────────────────────────────

  const headerSection = (
    <View style={[{ paddingTop: spacing[4], paddingBottom: spacing[3], flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, cm]}>
      <View style={{ flex: 1 }}>
        <Text size="2xl" weight="bold">{mounted ? greeting() : "Good morning"}</Text>
        <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
          {now ? formatHeaderDate(now) : ""}
        </Text>
      </View>
      <Pressable onPress={() => router.push("/settings")} hitSlop={12} style={{ padding: spacing[1], marginTop: spacing[1] }}>
        <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
      </Pressable>
    </View>
  );

  // Tasks card — all open tasks, sorted by priority then due date, max 5
  const tasksCardItems = openTasks.slice(0, 5);
  const tasksOverflow  = openTasks.length - 5;

  const tasksCardContent = (
    <>
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
    </>
  );

  // Notes horizontal row (4 cards)
  const notesRow = sortedNotes.length > 0 ? (
    <View style={{ marginBottom: spacing[5] }}>
      <View style={cm}><SectionHeader label="Notes" count={sortedNotes.length} action={{ label: "All notes", onPress: () => router.push("/(tabs)/notes") }} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2], paddingHorizontal: isNarrowMobile ? spacing[3] : 0, paddingBottom: spacing[1] }}>
        {sortedNotes.slice(0, 4).map(note => {
          const override = noteColors.getNoteColorIdx(note.id);
          const pi = override !== null ? override : getPastelIndex(note.id);
          const bg = NOTE_PASTELS[pi];
          const border = NOTE_PASTEL_BORDERS[pi];
          return (
            <Pressable
              key={note.id}
              onPress={() => router.push(`/(tabs)/notes?openId=${note.id}` as any)}
              style={{ width: 160 }}
            >
              <View style={{ backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 12, padding: spacing[3], gap: spacing[1], minHeight: 90 }}>
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
      </ScrollView>
    </View>
  ) : null;

  // Lists horizontal shelf
  const listsShelf = lists.length > 0 ? (
    <View style={{ marginBottom: spacing[5] }}>
      <View style={cm}><SectionHeader label="Lists" count={lists.length} action={{ label: "See all", onPress: handleGoToLists }} /></View>
      {!listsLoaded ? (
        <View style={{ flexDirection: "row", gap: spacing[2], paddingHorizontal: isNarrowMobile ? spacing[3] : 0 }}>
          <Skeleton width={140} height={60} borderRadius={12} />
          <Skeleton width={140} height={60} borderRadius={12} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2], paddingHorizontal: isNarrowMobile ? spacing[3] : 0, paddingBottom: spacing[1] }}>
          {lists.map(l => (
            <View key={l.id} style={{ width: 160 }}>
              <ListGridCard list={l} onPress={handleGoToLists} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  ) : null;

  const mainContent = (
    <>
      {isWide ? (
        <View style={{ flexDirection: "row", gap: spacing[4], marginBottom: spacing[5], alignItems: "flex-start" }}>
          <View style={{ flex: 3 }}>
            <SectionHeader label="Tasks" count={tasksLoaded ? openTasks.length : undefined} action={{ label: "All tasks", onPress: handleGoToTasks }} />
            {tasksCardContent}
          </View>
          <View style={{ flex: 2 }}>
            <SectionHeader label="Today" action={{ label: "Open", onPress: () => router.push("/(tabs)/today") }} />
            <TodayCard />
          </View>
        </View>
      ) : (
        <>
          <View style={[{ marginBottom: spacing[5] }, cm]}>
            <SectionHeader label="Tasks" count={tasksLoaded ? openTasks.length : undefined} action={{ label: "All tasks", onPress: handleGoToTasks }} />
            {tasksCardContent}
          </View>
          <View style={[{ marginBottom: spacing[5] }, cm]}>
            <SectionHeader label="Today" action={{ label: "Open", onPress: () => router.push("/(tabs)/today") }} />
            <TodayCard />
          </View>
        </>
      )}
      {notesRow}
      {listsShelf}
    </>
  );

  return (
    <GradientBackground>
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: spacing[4], paddingBottom: spacing[24] }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
      >
        <View style={
          Platform.OS === "web"
            ? { alignSelf: "center", width: "100%", maxWidth: 860, paddingHorizontal: 80 }
            : isNarrowMobile ? {} : { paddingHorizontal: spacing[4] }
        }>
          {headerSection}
          {mainContent}
        </View>
      </ScrollView>

      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
      <View
        style={{ position: "absolute", bottom: spacing[8], right: spacing[5] }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => setShowTaskSheet(true)}
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

      <QuickAddModal visible={showTaskSheet} onClose={() => setShowTaskSheet(false)} onAdd={handleQuickAddTask} />
    </SafeAreaView>
    </GradientBackground>
  );
}
