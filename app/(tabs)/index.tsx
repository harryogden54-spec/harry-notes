import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, ScrollView, SafeAreaView, Pressable,
  Platform, KeyboardAvoidingView, TextInput, RefreshControl,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, SearchBar, EmptyState, Surface, GradientBackground, Skeleton, SectionHeader, TaskRow } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useTasks } from "@/lib/TasksContext";
import { useLists } from "@/lib/ListsContext";
import { useNotes } from "@/lib/NotesContext";
import { useStickyNotes, type StickyNote } from "@/lib/StickyNotesContext";
import { webContentStyle } from "@/lib/webLayout";
import { getTodayStr, getTomorrowStr, stripMarkdown } from "@/lib/utils";
import { MiniCalendar }       from "@/components/dashboard/MiniCalendar";
import { QuickAddSheet }      from "@/components/dashboard/QuickAddSheet";
import { QuickAddNoteSheet }  from "@/components/dashboard/QuickAddNoteSheet";
import { StickyNoteModal }    from "@/components/dashboard/StickyNoteModal";
import { SearchResults }      from "@/components/dashboard/SearchResults";
import { ListShelfCard }      from "@/components/dashboard/ListShelfCard";
import { PinnedListCard }     from "@/components/dashboard/PinnedListCard";
import { StickyCard }         from "@/components/dashboard/StickyCard";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Dashboard screen ─────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { colors }             = useTheme();
  const { tasks, addTask, loaded: tasksLoaded, syncNow: syncTasks } = useTasks();
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
  const today                  = getTodayStr();
  const tomorrow               = getTomorrowStr();
  const now                    = new Date();
  const [calSelected, setCalSelected] = useState(today);

  const noteFabScale = useSharedValue(1);
  const taskFabScale = useSharedValue(1);
  const noteFabStyle = useAnimatedStyle(() => ({ transform: [{ scale: noteFabScale.value }] }));
  const taskFabStyle = useAnimatedStyle(() => ({ transform: [{ scale: taskFabScale.value }] }));

  const openTasks = tasks
    .filter(t => !t.done)
    .sort((a, b) => {
      const aOverdue = !!a.due_date && a.due_date < today;
      const bOverdue = !!b.due_date && b.due_date < today;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      const aDate = a.due_date ?? "9999-99-99";
      const bDate = b.due_date ?? "9999-99-99";
      return aDate.localeCompare(bDate);
    });

  const tasksByDate: Record<string, typeof tasks[number][]> = {};
  for (const task of tasks) {
    if (task.due_date) {
      if (!tasksByDate[task.due_date]) tasksByDate[task.due_date] = [];
      tasksByDate[task.due_date].push(task);
    }
  }

  const overdueCount = tasks.filter(t => !t.done && !!t.due_date && t.due_date < today).length;
  const todayCount   = tasks.filter(t => !t.done && t.due_date === today).length;
  const pinnedList   = lists.find(l => l.pinned);

  const recentNote = notes.length > 0
    ? [...notes].sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))[0]
    : null;

  const handleGoToLists = useCallback(() => router.push("/(tabs)/lists"), [router]);
  const handleGoToTasks = useCallback(() => router.push("/(tabs)/tasks"), [router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncTasks().catch(() => {});
    setRefreshing(false);
  }, [syncTasks]);

  const handleQuickAddTask = useCallback((title: string, dueDate?: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addTask(title, dueDate);
  }, [addTask]);

  const handleQuickAddNote = useCallback((content: string, colour: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addStickyNote(content, colour);
  }, [addStickyNote]);

  // Web keyboard shortcuts
  useEffect(() => {
    if (Platform.OS !== "web") return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setShowTaskSheet(true); }
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "t" || e.key === "T") { e.preventDefault(); router.push("/(tabs)/today"); }
      if (e.key === "Escape") { setShowTaskSheet(false); setShowNoteSheet(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <GradientBackground>
    <SafeAreaView style={{ flex: 1 }}>
      {/* Sheet backdrop */}
      {(showTaskSheet || showNoteSheet) && (
        <Pressable
          onPress={() => { setShowTaskSheet(false); setShowNoteSheet(false); }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 10 }}
        />
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ padding: spacing[4], paddingBottom: spacing[24] }, webContentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
          }
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
                    <Pressable
                      onPress={() => router.push("/(tabs)/tasks?filter=overdue" as any)}
                      style={{ backgroundColor: `${colors.danger}18`, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 3, borderWidth: 1, borderColor: `${colors.danger}40` }}
                    >
                      <Text size="xs" weight="medium" style={{ color: colors.danger }}>{overdueCount} overdue</Text>
                    </Pressable>
                  )}
                  {todayCount > 0 && (
                    <Pressable
                      onPress={() => router.push("/(tabs)/tasks?filter=today" as any)}
                      style={{ backgroundColor: `${colors.accent}18`, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 3, borderWidth: 1, borderColor: `${colors.accent}40` }}
                    >
                      <Text size="xs" weight="medium" style={{ color: colors.accent }}>{todayCount} today</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
            <Pressable onPress={() => router.push("/settings")} hitSlop={12} style={{ padding: spacing[1], marginTop: spacing[1] }}>
              <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* ── Search ───────────────────────────────────────────────────── */}
          <SearchBar value={search} onChange={setSearch} placeholder="Search tasks, lists, notes… (/)" inputRef={searchRef} />

          {search.trim() ? (
            <View style={{ marginTop: spacing[3] }}>
              <SearchResults
                tasks={tasks} lists={lists} notes={notes}
                query={search.trim()}
                onTaskPress={id => router.push(`/(tabs)/tasks?taskId=${id}` as any)}
              />
            </View>
          ) : (
            <>
              {/* ── Tasks ────────────────────────────────────────────────── */}
              <View style={{ marginTop: spacing[4], marginBottom: spacing[5] }}>
                <SectionHeader label="Tasks" count={tasksLoaded ? openTasks.length : undefined} action={{ label: "See all", onPress: handleGoToTasks }} />
                {!tasksLoaded ? (
                  <Surface style={{ padding: spacing[4], gap: spacing[3] }}>
                    <Skeleton height={16} borderRadius={6} />
                    <Skeleton height={16} borderRadius={6} width="80%" />
                    <Skeleton height={16} borderRadius={6} width="65%" />
                  </Surface>
                ) : openTasks.length === 0 ? (
                  <EmptyState type="tasks" title="All clear" subtitle="No open tasks — enjoy the moment." />
                ) : (
                  <Surface style={{ overflow: "hidden" }}>
                    {overdueCount > 0 && (
                      <View style={{ paddingHorizontal: spacing[3], paddingTop: spacing[3], paddingBottom: spacing[1] }}>
                        <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.danger, fontFamily: fontFamily.semibold, textTransform: "uppercase" }}>
                          Overdue
                        </Text>
                      </View>
                    )}
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
                  </Surface>
                )}
              </View>

              {/* ── Quick Notes (Sticky) ─────────────────────────────────── */}
              {stickyNotes.length > 0 && (
                <View style={{ marginBottom: spacing[5] }}>
                  <SectionHeader label="Quick Notes" count={stickyNotes.length} action={{ label: "See all", onPress: () => router.push("/(tabs)/notes") }} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[1] }}>
                    {stickyNotes.map(n => (
                      <StickyCard key={n.id} note={n} onPress={() => setEditingNote(n)} />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* ── Calendar ─────────────────────────────────────────────── */}
              <View style={{ marginBottom: spacing[2] }}>
                <SectionHeader label="Calendar" />
                <MiniCalendar tasksByDate={tasksByDate} selected={calSelected} onSelect={setCalSelected} today={today} />
                {(() => {
                  const dayTasks = (tasksByDate[calSelected] ?? []).filter(t => !t.done);
                  if (dayTasks.length === 0) return null;
                  const label = calSelected === today ? "Today"
                    : calSelected === tomorrow ? "Tomorrow"
                    : new Date(calSelected + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                  return (
                    <View style={{ marginBottom: spacing[4] }}>
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

              {/* ── Pinned list ──────────────────────────────────────────── */}
              {pinnedList && (
                <View style={{ marginBottom: spacing[2] }}>
                  <SectionHeader label="Pinned list" action={{ label: "All lists", onPress: handleGoToLists }} />
                  <PinnedListCard list={pinnedList} onPress={handleGoToLists} />
                </View>
              )}

              {/* ── Lists shelf ──────────────────────────────────────────── */}
              {!listsLoaded ? (
                <View style={{ marginBottom: spacing[5] }}>
                  <SectionHeader label="Lists" />
                  <View style={{ flexDirection: "row", gap: spacing[3] }}>
                    <Skeleton width={130} height={80} borderRadius={12} />
                    <Skeleton width={130} height={80} borderRadius={12} />
                  </View>
                </View>
              ) : lists.length > 0 ? (
                <View style={{ marginBottom: spacing[5] }}>
                  <SectionHeader label="Lists" action={{ label: "See all", onPress: handleGoToLists }} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[1] }}>
                    {lists.map(l => (
                      <ListShelfCard key={l.id} list={l} onPress={handleGoToLists} />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {/* ── Recent note ──────────────────────────────────────────── */}
              {recentNote && (
                <View style={{ marginBottom: spacing[5] }}>
                  <SectionHeader label="Recent note" action={{ label: "All notes", onPress: () => router.push("/(tabs)/notes") }} />
                  <Pressable onPress={() => router.push(`/(tabs)/notes?openId=${recentNote.id}` as any)}>
                    <Surface style={{ padding: spacing[4], gap: spacing[2] }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                        {recentNote.pinned && <Text size="xs" style={{ color: colors.accent }}>📌</Text>}
                        <Text size="sm" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                          {recentNote.title || "Untitled"}
                        </Text>
                        <Text size="xs" secondary>
                          {(() => {
                            const diff = Date.now() - new Date(recentNote.updated_at ?? recentNote.created_at).getTime();
                            const mins = Math.floor(diff / 60000);
                            const hours = Math.floor(diff / 3600000);
                            const days = Math.floor(diff / 86400000);
                            if (mins < 1) return "just now";
                            if (mins < 60) return `${mins}m ago`;
                            if (hours < 24) return `${hours}h ago`;
                            return `${days}d ago`;
                          })()}
                        </Text>
                      </View>
                      {recentNote.body.trim() && (
                        <Text size="xs" secondary numberOfLines={2} style={{ lineHeight: 18 }}>
                          {stripMarkdown(recentNote.body.split("\n").find(l => l.trim()) ?? "")}
                        </Text>
                      )}
                      <Text size="xs" style={{ color: colors.accent, marginTop: spacing[1] }}>→ Open</Text>
                    </Surface>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Dual FABs ────────────────────────────────────────────────────────── */}
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

      {/* ── Quick-add sheets ─────────────────────────────────────────────────── */}
      {(showTaskSheet || showNoteSheet) && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20 }} pointerEvents="box-none">
          {showTaskSheet && (
            <QuickAddSheet visible={showTaskSheet} onClose={() => setShowTaskSheet(false)} onAdd={handleQuickAddTask} />
          )}
          {showNoteSheet && (
            <QuickAddNoteSheet visible={showNoteSheet} onClose={() => setShowNoteSheet(false)} onAdd={handleQuickAddNote} />
          )}
        </View>
      )}

      {/* ── Sticky note edit modal ────────────────────────────────────────────── */}
      <StickyNoteModal note={editingNote} visible={!!editingNote} onClose={() => setEditingNote(null)} />
    </SafeAreaView>
    </GradientBackground>
  );
}
