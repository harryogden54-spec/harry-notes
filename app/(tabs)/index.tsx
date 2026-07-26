import React, { useState, useCallback, useRef, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, ScrollView, Pressable,
  Platform, KeyboardAvoidingView, TextInput, RefreshControl,
  useWindowDimensions,
} from "react-native";
// Screens sit below PersistentHeader (which owns the top inset) and above the
// tab bar (bottom inset) — pad the side notches only, or standalone-PWA/native
// would double-pad the top.
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, SearchBar, Surface, GlassCard, GradientBackground, Skeleton, SectionHeader, TaskRow } from "@/components/ui";
import { spacing, fontFamily, getNotePastelIndex, getShadow } from "@/lib/theme";
import { useScrollBottomPadding } from "@/lib/TabBarHeightContext";
import { useTasksData, useTasksActions, useTasksSync } from "@/lib/TasksContext";
import { useCategoriesData } from "@/lib/TaskCategoriesContext";
import { useToast } from "@/lib/ToastContext";
import { useNotesData } from "@/lib/NotesContext";
import { useTodayData } from "@/lib/TodayContext";
import { getTodayStr, formatHeaderDate, cmpRecentDesc } from "@/lib/utils";
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

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;

// ─── Today panel ──────────────────────────────────────────────────────────────
// Reads the same synced store as the Today tab (lib/TodayContext.tsx) — carry-
// forward and the done-item retention sweep both live there now, so this
// panel just filters to today's active items.

function TodayPanel() {
  const { colors } = useTheme();
  const { items: allTodayItems } = useTodayData();
  const todayStr = getTodayStr();

  const active = allTodayItems.filter(i => i.date === todayStr && !i.done);

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
  const scrollBottom = useScrollBottomPadding(spacing[24]);
  const { tasks, loaded: tasksLoaded } = useTasksData();
  const { addTask, updateTask } = useTasksActions();
  const { syncNow: syncTasks } = useTasksSync();
  const { categories: taskCategories } = useCategoriesData();
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

  const sortedNotes = useMemo(
    // Documents only — notes with parent_id are pages inside another note.
    () => notes.filter(n => !n.archived && !n.parent_id).sort(cmpRecentDesc),
    [notes]
  );

  const handleGoToTasks   = useCallback(() => router.push("/(tabs)/tasks"), [router]);
  const handleGoToNotes   = useCallback(() => router.push("/(tabs)/notes"), [router]);
  const handleGoToDump    = useCallback(() => router.push("/(tabs)/dump"), [router]);

  // Genuinely fresh install — no tasks or notes at all (not just none open),
  // so the dashboard doesn't end up with a lot of empty vertical space.
  const isFreshInstall = tasksLoaded && notesLoaded && tasks.length === 0 && notes.length === 0;

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
        <Text
          size="display"
          weight="bold"
          // Web: ink → accent gradient across the greeting; plain text on native.
          style={Platform.OS === "web" ? ({
            backgroundImage: `linear-gradient(100deg, ${colors.textPrimary} 45%, ${colors.accent} 110%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            alignSelf: "flex-start",
          } as any) : undefined}
        >
          {mounted ? greeting() : "Good morning"}
        </Text>
        <Text size="sm" secondary style={{ marginTop: spacing[1] }}>
          {now ? formatHeaderDate(now) : ""}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[1] }}>
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

  const categoryLabel: Record<string, string> = Object.fromEntries(taskCategories.map(c => [c.id, c.name]));

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
                  {categoryLabel[cat] ?? cat}
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
              {/* Neutral card + pastel identity dot — same recipe as NoteCard */}
              <View style={{
                backgroundColor: `${colors.bgSecondary}D0`,
                borderWidth: 1, borderColor: `${colors.bgBorder}88`,
                borderRadius: 18,
                padding: spacing[3],
                gap: spacing[1],
                minHeight: 100,
                ...getShadow("sm", scheme),
              }}>
                <Text size="xs" weight="semibold" numberOfLines={1} style={{ color: note.title ? colors.textPrimary : colors.textTertiary }}>
                  {note.title || "Untitled"}
                </Text>
                {preview ? (
                  <Text size="xs" numberOfLines={3} style={{ color: colors.textSecondary, lineHeight: 16 }}>
                    {preview}
                  </Text>
                ) : null}
                {mounted && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: "auto" as any }}>
                    <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: notePastels.bg[pi], borderWidth: 1, borderColor: notePastels.border[pi] }} />
                    <Text size="xs" style={{ color: colors.textTertiary, fontSize: 11 }}>
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
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  ) : null;

  // ─── Getting started (fresh installs only — fills the empty space below
  // the empty tasks/today cards with something actionable instead of blank
  // scroll) ──────────────────────────────────────────────────────────────────

  const gettingStarted = isFreshInstall ? (
    <View style={{ marginBottom: spacing[6] }}>
      <SectionHeader label="Get started" />
      <GlassCard style={{ overflow: "hidden" }}>
        {[
          { icon: "checkbox-outline" as const, label: "Add your first task", onPress: () => searchRef.current?.focus() },
          { icon: "document-text-outline" as const, label: "Write a note", onPress: handleGoToNotes },
          { icon: "cloud-upload-outline" as const, label: "Dump a quick thought", onPress: handleGoToDump },
        ].map((item, i, arr) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            style={{
              flexDirection: "row", alignItems: "center", gap: spacing[3],
              paddingHorizontal: spacing[4], paddingVertical: spacing[3],
              borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: colors.bgBorder,
            }}
          >
            <Ionicons name={item.icon} size={17} color={colors.accent} />
            <Text size="sm" style={{ flex: 1, color: colors.textPrimary }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
          </Pressable>
        ))}
      </GlassCard>
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
      {notesRow}
      {gettingStarted}
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
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: spacing[2], paddingBottom: scrollBottom }}
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

