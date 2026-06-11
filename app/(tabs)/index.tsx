import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, ScrollView, SafeAreaView, Pressable,
  Platform, KeyboardAvoidingView, TextInput, RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useCommandPalette } from "@/lib/CommandPaletteContext";
import { Text, SearchBar, Surface, GlassCard, GradientBackground, Skeleton, SectionHeader, TaskRow } from "@/components/ui";
import { spacing, radius, fontFamily, getNotePastelIndex, getShadow } from "@/lib/theme";
import { useTasksData, useTasksActions, useTasksSync } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { useNotesData } from "@/lib/NotesContext";
import { storage } from "@/lib/storage";
import { getTodayStr, getLocalDateStr, formatHeaderDate, cmpRecentDesc } from "@/lib/utils";
import { carryForwardToday } from "@/lib/todayCarry";
import { useMounted } from "@/lib/useMounted";
import { notePreview } from "@/components/notes/utils";
import { SearchResults }      from "@/components/dashboard/SearchResults";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayKey() {
  return `today_items_${getLocalDateStr()}`;
}

type TodayItem = { id: string; text: string; done: boolean };

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;

// ─── Today panel ──────────────────────────────────────────────────────────────

function TodayPanel() {
  const { colors } = useTheme();
  const [items, setItems] = useState<TodayItem[]>([]);
  const todayKey = getTodayKey();

  useEffect(() => {
    (async () => {
      await carryForwardToday();
      const saved = await storage.get<TodayItem[]>(todayKey);
      if (saved) setItems(saved);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = items.filter(i => !i.done);

  if (active.length === 0) {
    return (
      <View style={{ paddingVertical: spacing[3] }}>
        <Text size="sm" secondary>Nothing left for today.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing[1] }}>
      {active.map((item) => (
        <View key={item.id} style={{
          flexDirection: "row", alignItems: "center", gap: spacing[2.5],
          paddingVertical: spacing[1.5],
        }}>
          <View style={{
            width: 5, height: 5, borderRadius: 99,
            backgroundColor: colors.textTertiary,
            marginHorizontal: 5.5,
          }} />
          <Text size="sm" style={{ flex: 1, color: colors.textPrimary }} numberOfLines={1}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}


// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardScreen() {
  const { colors, notePastels, scheme } = useTheme();
  const { open: openPalette }  = useCommandPalette();
  const { tasks, loaded: tasksLoaded } = useTasksData();
  const { addTask, updateTask } = useTasksActions();
  const { syncNow: syncTasks } = useTasksSync();
  const { showToast }          = useToast();
  const { notes, loaded: notesLoaded } = useNotesData();
  const router                 = useRouter();
  const searchRef              = useRef<TextInput | null>(null);
  const [search, setSearch]       = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const today                       = getTodayStr();

  const mounted = useMounted();
  const now = mounted ? new Date() : null;

  const allOpenTasks = useMemo(() => tasks
    .filter(t => !t.done && !t.archived)
    .sort((a, b) => {
      const ai = a.priority ? PRIORITY_ORDER.indexOf(a.priority as any) : 99;
      const bi = b.priority ? PRIORITY_ORDER.indexOf(b.priority as any) : 99;
      if (ai !== bi) return ai - bi;
      const aDate = a.due_date ?? "9999-99-99";
      const bDate = b.due_date ?? "9999-99-99";
      return aDate.localeCompare(bDate);
    }), [tasks]);

  // Unique categories that exist in open tasks, for the filter chips.
  const availableCategories = useMemo(() =>
    [...new Set(allOpenTasks.map(t => t.category).filter(Boolean))] as string[],
    [allOpenTasks]
  );

  // Apply category filter if selected (auto-clear if that category disappears).
  const openTasks = useMemo(() => {
    if (!categoryFilter || !availableCategories.includes(categoryFilter)) return allOpenTasks;
    return allOpenTasks.filter(t => t.category === categoryFilter);
  }, [allOpenTasks, categoryFilter, availableCategories]);

  const overdueTasks = useMemo(() => openTasks.filter(t => !!t.due_date && t.due_date < today), [openTasks, today]);
  const overdueCount = overdueTasks.length;

  const { sortedNotes, sortedPostIts } = useMemo(() => {
    const allSorted = [...notes].sort(cmpRecentDesc);
    return {
      sortedNotes:   allSorted.filter(n => n.type !== "postit"),
      sortedPostIts: allSorted.filter(n => n.type === "postit"),
    };
  }, [notes]);

  const handleGoToTasks   = useCallback(() => router.push("/(tabs)/tasks"), [router]);
  const handleGoToNotes   = useCallback(() => router.push("/(tabs)/notes"), [router]);
  const handleGoToPostIts = useCallback(() => router.push("/(tabs)/postits"), [router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await syncTasks(); } catch { showToast("Sync failed — check your connection"); }
    setRefreshing(false);
  }, [syncTasks, showToast]);


  const { width } = useWindowDimensions();
  const isWide   = width >= 768;
  const isMobile = Platform.OS !== "web" && width < 768;

  // ─── Header ───────────────────────────────────────────────────────────────────

  const header = (
    <View style={{ paddingTop: spacing[8], paddingBottom: spacing[5], flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
      <View style={{ flex: 1 }}>
        <Text size="display" weight="bold">
          {mounted ? greeting() : "Good morning"}
        </Text>
        <Text size="sm" secondary style={{ marginTop: spacing[1] }}>
          {now ? formatHeaderDate(now) : ""}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[1] }}>
        <Pressable onPress={openPalette} hitSlop={12} style={{ padding: spacing[1] }}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={() => router.push("/settings")} hitSlop={12} style={{ padding: spacing[1] }}>
          <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  // ─── Overdue banner ───────────────────────────────────────────────────────────

  const overdueBanner = overdueCount > 0 ? (
    <Pressable
      onPress={() => router.push("/(tabs)/tasks?filter=overdue" as any)}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing[1.5],
        alignSelf: "flex-start",
        backgroundColor: `${colors.danger}14`, borderRadius: 99,
        borderWidth: 1, borderColor: `${colors.danger}30`,
        paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
        marginBottom: spacing[4],
      }}
    >
      <Ionicons name="warning-outline" size={12} color={colors.danger} />
      <Text style={{ fontSize: 12, fontFamily: fontFamily.medium, color: colors.danger }}>
        {overdueCount} overdue
      </Text>
      <Text style={{ fontSize: 11, color: colors.danger, opacity: 0.7 }}>→</Text>
    </Pressable>
  ) : null;

  // ─── Tasks card ───────────────────────────────────────────────────────────────

  const CATEGORY_LABEL: Record<string, string> = { personal: "Personal", uni: "Uni" };

  const tasksCardItems = openTasks.slice(0, 5);
  const tasksOverflow  = openTasks.length - 5;

  const tasksCard = (
    <View style={{ flex: 1 }}>
      <SectionHeader
        label="Tasks"
        count={tasksLoaded ? allOpenTasks.length : undefined}
        action={{ label: "All tasks", onPress: handleGoToTasks }}
      />
      {/* Per-category filter chips — only shown when multiple categories exist */}
      {tasksLoaded && availableCategories.length > 1 && (
        <View style={{ flexDirection: "row", gap: spacing[1.5], marginBottom: spacing[2], flexWrap: "wrap" }}>
          {availableCategories.map(cat => {
            const active = categoryFilter === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategoryFilter(prev => prev === cat ? null : cat)}
                style={{
                  paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
                  borderRadius: 99, borderWidth: 1,
                  borderColor: active ? colors.accent : colors.bgBorder,
                  backgroundColor: active ? `${colors.accent}18` : "transparent",
                }}
              >
                <Text size="xs" style={{ color: active ? colors.accent : colors.textSecondary }}>
                  {CATEGORY_LABEL[cat] ?? cat}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {!tasksLoaded ? (
        <GlassCard style={{ padding: spacing[4], gap: spacing[3] }}>
          <Skeleton height={16} borderRadius={6} />
          <Skeleton height={16} borderRadius={6} width="80%" />
        </GlassCard>
      ) : openTasks.length === 0 ? (
        <GlassCard style={{ padding: spacing[4], alignItems: "center" }}>
          <Text size="sm" secondary>No open tasks</Text>
        </GlassCard>
      ) : (
        <GlassCard style={{ overflow: "hidden" }}>
          {tasksCardItems.map((task, i) => (
            <View key={task.id} style={i === tasksCardItems.length - 1 && tasksOverflow <= 0 ? { borderBottomWidth: 0 } : undefined}>
              <TaskRow task={task} onPress={() => router.push(`/(tabs)/tasks?taskId=${task.id}` as any)} />
            </View>
          ))}
          {tasksOverflow > 0 && (
            <Pressable onPress={handleGoToTasks} style={{ padding: spacing[3], alignItems: "center", borderTopWidth: 1, borderTopColor: colors.bgBorder }}>
              <Text size="xs" style={{ color: colors.accent }}>View all {openTasks.length} tasks →</Text>
            </Pressable>
          )}
        </GlassCard>
      )}
    </View>
  );

  // ─── Today card ───────────────────────────────────────────────────────────────

  const todayCard = (
    <View style={{ flex: 1 }}>
      <SectionHeader label="Today" action={{ label: "Open", onPress: () => router.push("/(tabs)/today") }} />
      <View style={{ paddingVertical: spacing[1], flex: 1 }}>
        <TodayPanel />
      </View>
    </View>
  );

  // ─── Notes row ────────────────────────────────────────────────────────────────

  const notesRow = !notesLoaded ? (
    <View style={{ marginBottom: spacing[6] }}>
      <SectionHeader label="Notes" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} width={isWide ? `${(100 - 4.5 * 3) / 4}%` as any : "48%" as any} height={100} borderRadius={12} />
        ))}
      </View>
    </View>
  ) : sortedNotes.length > 0 ? (
    <View style={{ marginBottom: spacing[6] }}>
      <SectionHeader label="Notes" count={sortedNotes.length} action={{ label: "See all", onPress: handleGoToNotes }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        {sortedNotes.slice(0, 4).map(note => {
          const pi = getNotePastelIndex(note.id);
          const bg = notePastels.bg[pi];
          const border = notePastels.border[pi];
          const preview = notePreview(note, 80);
          return (
            <Pressable
              key={note.id}
              onPress={() => router.push(`/(tabs)/notes?openId=${note.id}` as any)}
              style={{
                width: isWide ? `${(100 - 4.5 * 3) / 4}%` as any : "48%" as any,
                minWidth: 140,
              }}
            >
              <View style={{
                backgroundColor: bg,
                borderWidth: 1, borderColor: border,
                borderRadius: 12,
                padding: spacing[3],
                gap: spacing[1],
                minHeight: 100,
              }}>
                <Text size="xs" weight="semibold" numberOfLines={1} style={{ color: notePastels.text }}>
                  {note.title || "Untitled"}
                </Text>
                {preview ? (
                  <Text size="xs" numberOfLines={3} style={{ color: notePastels.text, opacity: 0.75, lineHeight: 16 }}>
                    {preview}
                  </Text>
                ) : null}
                {mounted && (
                  <Text size="xs" style={{ color: notePastels.text, opacity: 0.45, marginTop: "auto" as any }}>
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

  // ─── Post Its preview ─────────────────────────────────────────────────────────

  const postItsRow = !notesLoaded ? (
    <View style={{ marginBottom: spacing[6] }}>
      <SectionHeader label="Post Its" />
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} width={140} height={72} borderRadius={radius.lg} />
        ))}
      </View>
    </View>
  ) : sortedPostIts.length > 0 ? (
    <View style={{ marginBottom: spacing[6] }}>
      <SectionHeader label="Post Its" count={sortedPostIts.length} action={{ label: "See all", onPress: handleGoToPostIts }} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: spacing[3] }}
      >
        {sortedPostIts.slice(0, 6).map(n => {
          const pi = getNotePastelIndex(n.id);
          return (
            <Pressable
              key={n.id}
              onPress={handleGoToPostIts}
              style={{ width: 140, marginRight: spacing[2] }}
            >
              <View style={{
                backgroundColor: notePastels.bg[pi],
                borderWidth: 1,
                borderColor: notePastels.border[pi],
                borderRadius: radius.lg,
                padding: spacing[3],
                minHeight: 72,
                justifyContent: "center",
                ...getShadow("xs", scheme),
              }}>
                <Text size="xs" numberOfLines={3} style={{ color: notePastels.text, lineHeight: 18 }}>
                  {n.title || "…"}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  ) : null;

  // ─── Main content ─────────────────────────────────────────────────────────────

  const mainContent = (
    <>
      {overdueBanner}
      {isWide ? (
        <View style={{ flexDirection: "row", gap: spacing[4], marginBottom: spacing[6], alignItems: "flex-start" }}>
          {tasksCard}
          {todayCard}
        </View>
      ) : (
        <>
          <View style={{ marginBottom: spacing[4] }}>{tasksCard}</View>
          <View style={{ marginBottom: spacing[6] }}>{todayCard}</View>
        </>
      )}
      {postItsRow}
      {notesRow}
    </>
  );

  // ─── Layout (web: centred max-width; mobile: edge-to-edge cards) ─────────────

  const outerPadding = Platform.OS === "web"
    ? { alignSelf: "center" as const, width: "100%", maxWidth: 1200, paddingHorizontal: 20 }
    : isMobile
      ? { paddingHorizontal: spacing[3] }
      : { paddingHorizontal: spacing[4] };

  return (
    <GradientBackground>
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: spacing[2], paddingBottom: spacing[24] }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        >
          <View style={outerPadding as any}>
            {header}
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search tasks, lists, notes…"
              inputRef={searchRef}
              shortcutKey="/"
              onSubmitEditing={() => {
                const q = search.trim();
                if (q) { addTask(q); setSearch(""); showToast(`Added: ${q}`); }
              }}
            />

            {search.trim() ? (
              <View style={{ marginTop: spacing[3] }}>
                <SearchResults
                  tasks={tasks} notes={notes} query={search.trim()}
                  onTaskPress={id => router.push(`/(tabs)/tasks?taskId=${id}` as any)}
                  onAdd={title => { addTask(title); setSearch(""); showToast(`Added: ${title}`); }}
                />
              </View>
            ) : (
              <View style={{ marginTop: spacing[2] }}>{mainContent}</View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
    </GradientBackground>
  );
}

export default function DashboardScreenBounded() {
  return <ErrorBoundary><DashboardScreen /></ErrorBoundary>;
}

