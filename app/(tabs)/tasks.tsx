import React, { useState, useRef, useCallback, useEffect } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, TextInput, Pressable, ScrollView, SafeAreaView,
  KeyboardAvoidingView, Platform, RefreshControl, Modal,
  type ScrollView as RNScrollView, useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";

import { useTheme } from "@/lib/useTheme";
import { Text, SearchBar, EmptyState, GradientBackground, Skeleton } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";
import { useTasksData, useTasksActions, useTasksSync, type Task, type Priority, type TaskCategory, type UniCourse } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { storage } from "@/lib/storage";
import { getTodayStr } from "@/lib/utils";

import {
  Chip, AddTaskRow, Section, TaskDetailPanel, EmptyDetailPane,
  PRIORITY_CONFIG, type SortBy,
  isOverdue, isToday, isScheduled, isSomeday, applySort, matchesSearch,
} from "@/components/tasks";

function TasksScreen() {
  const { colors } = useTheme();
  const { tasks, loaded } = useTasksData();
  const { addTask, deleteTask, archiveTask, unarchiveTask, toggleTask, reorderTask, setSectionOrder, updateTask } = useTasksActions();
  const { syncStatus, syncNow } = useTasksSync();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ create?: string; taskId?: string; filter?: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 1024;

  const [expandedId, setExpandedId]             = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId]     = useState<string | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [search, setSearch]                     = useState("");
  const [filterPriority, setFilterPriority]     = useState<Priority | null>(null);
  const [focusMode, setFocusMode]               = useState(false);
  const [selectMode, setSelectMode]             = useState(false);
  const [selectedIds, setSelectedIds]           = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId]           = useState<string | null>(null);
  const [sortBy, setSortBy]                     = useState<SortBy>("priority");
  const [grouped, setGrouped]                   = useState(false);
  // Default compact on mobile — the meta line wraps awkwardly on small screens.
  const [compact, setCompact]                   = useState(Platform.OS !== "web");
  const [showArchive, setShowArchive]           = useState(false);
  const prefsLoaded = useRef(false);
  const addInputRef    = useRef<TextInput | null>(null);
  const scrollViewRef  = useRef<RNScrollView>(null);
  const taskYPositions = useRef<Record<string, number>>({});
  // Refs for keyboard navigation (j/k/x) — keep current values accessible
  // inside the stable keyboard-handler closure without re-registering on every render.
  const navTasksRef      = useRef<Task[]>([]);
  const selectedIdRef    = useRef<string | null>(null);
  const isDesktopRef     = useRef(false);

  const handleTaskMeasureY = useCallback((id: string, y: number) => {
    taskYPositions.current[id] = y;
  }, []);

  // Load persisted task-view prefs on mount
  useEffect(() => {
    Promise.all([
      storage.get<boolean>("tasks_grouped"),
      storage.get<boolean>("tasks_compact"),
      storage.get<string>("tasks_sort_by"),
    ]).then(([g, c, s]) => {
      if (g !== null && g !== undefined) setGrouped(g);
      if (c !== null && c !== undefined) setCompact(c);
      if (s !== null && s !== undefined) setSortBy(s as SortBy);
      prefsLoaded.current = true;
    });
  }, []);

  // Persist prefs when changed (after initial load)
  useEffect(() => { if (prefsLoaded.current) storage.set("tasks_grouped", grouped); }, [grouped]);
  useEffect(() => { if (prefsLoaded.current) storage.set("tasks_compact", compact); }, [compact]);
  useEffect(() => { if (prefsLoaded.current) storage.set("tasks_sort_by", sortBy); }, [sortBy]);

  useEffect(() => {
    if (params.filter === "overdue" || params.filter === "today") setFocusMode(true);
    if (params.create === "1") setTimeout(() => addInputRef.current?.focus(), 300);
    if (params.taskId) {
      setExpandedId(params.taskId);
      setHighlightId(params.taskId);
      if (isDesktop) setSelectedTaskId(params.taskId);
      setTimeout(() => {
        const y = taskYPositions.current[params.taskId!];
        if (y !== undefined) scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
        setTimeout(() => setHighlightId(null), 2000);
      }, 350);
    }
  }, [params.create, params.taskId, isDesktop]);

  // Web keyboard shortcuts
  useEffect(() => {
    if (Platform.OS !== "web") return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); addInputRef.current?.focus(); }
      if (e.key === "Escape") { setExpandedId(null); setSelectedTaskId(null); setSelectMode(false); setSelectedIds(new Set()); }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); setFocusMode(v => !v); }
      // j/k navigate task list; x toggles the currently selected task.
      if (e.key === "j" || e.key === "J" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        const tasks = navTasksRef.current;
        if (tasks.length === 0) return;
        const currId  = selectedIdRef.current;
        const currIdx = tasks.findIndex(t => t.id === currId);
        const nextIdx = e.key === "j" || e.key === "J"
          ? Math.min(currIdx + 1, tasks.length - 1)
          : Math.max(currIdx - 1, 0);
        const nextId = tasks[Math.max(nextIdx, 0)]?.id;
        if (!nextId) return;
        if (isDesktopRef.current) setSelectedTaskId(nextId);
        else { setExpandedId(nextId); setSelectedTaskId(nextId); }
        // Scroll the newly focused task into view
        setTimeout(() => {
          const y = taskYPositions.current[nextId];
          if (y !== undefined) scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
        }, 0);
      }
      if (e.key === "x" || e.key === "X") {
        const id = selectedIdRef.current;
        if (id) toggleTask(id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleTask]); // toggleTask is stable (useCallback with stable deps)

  const handleAdd = useCallback((title: string, due_date?: string, category?: TaskCategory, uniCourse?: UniCourse) => {
    const id = addTask(title, due_date);
    if (category) updateTask(id, { category, uniCourse: category === "uni" ? uniCourse : undefined });
    setExpandedId(id);
    if (isDesktop) setSelectedTaskId(id);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [addTask, updateTask, isDesktop]);

  const handleToggleExpand = useCallback((id: string) => {
    if (isDesktop) {
      setSelectedTaskId(prev => prev === id ? null : id);
    } else {
      setExpandedId(prev => prev === id ? null : id);
      setSelectedTaskId(id);
      setShowMobileDetail(true);
    }
  }, [isDesktop]);

  const handleDelete = useCallback((id: string) => {
    const undo = deleteTask(id);
    setExpandedId(null);
    if (selectedTaskId === id) { setSelectedTaskId(null); setShowMobileDetail(false); }
    showToast("Task deleted", { label: "Undo", onPress: undo });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [deleteTask, showToast, selectedTaskId]);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleLongPress = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  function handleBulkComplete() {
    selectedIds.forEach(id => { const t = tasks.find(t => t.id === id); if (t && !t.done) toggleTask(id); });
    showToast(`${selectedIds.size} task${selectedIds.size !== 1 ? "s" : ""} completed`);
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  function handleBulkDelete() {
    const count = selectedIds.size;
    const undos: Array<() => void> = [];
    selectedIds.forEach(id => undos.push(deleteTask(id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    showToast(`${count} task${count !== 1 ? "s" : ""} deleted`, { label: "Undo", onPress: () => undos.forEach(u => u()) });
  }

  const visible    = tasks.filter(t => !t.archived && matchesSearch(t, search) && (filterPriority ? t.priority === filterPriority : true));
  const overdue    = visible.filter(isOverdue);
  const todayTasks = visible.filter(isToday);
  const scheduled  = visible.filter(isScheduled);
  const someday    = visible.filter(isSomeday);
  const done       = visible.filter(t => t.done);
  const open       = tasks.filter(t => !t.done && !t.archived);
  const archived   = tasks.filter(t => t.archived);
  const focusTasks = [...overdue, ...todayTasks];

  // Keep refs in sync for the stable keyboard handler below.
  navTasksRef.current   = focusMode ? focusTasks : visible.filter(t => !t.done);
  selectedIdRef.current = isDesktop ? selectedTaskId : expandedId;
  isDesktopRef.current  = isDesktop;

  const effectiveExpandedId = isDesktop ? selectedTaskId : expandedId;
  const sectionProps = {
    expandedId: effectiveExpandedId,
    onToggleExpand: handleToggleExpand,
    selectMode, selectedIds,
    onSelect: handleSelect,
    onDelete: handleDelete,
    onReorderUp: (id: string) => reorderTask(id, "up"),
    onReorderDown: (id: string) => reorderTask(id, "down"),
    onReorder: setSectionOrder,
    highlightId, onTaskMeasureY: handleTaskMeasureY,
    sortBy, onLongPress: handleLongPress,
    onUpdate: updateTask,
    compact,
  };

  // Sync status pill
  const [pillText, setPillText] = useState<string | null>(null);
  useEffect(() => {
    if (syncStatus === "syncing") {
      setPillText("Syncing…");
    } else if (syncStatus === "synced") {
      setPillText("Synced");
      const t = setTimeout(() => setPillText(null), 2000);
      return () => clearTimeout(t);
    } else {
      setPillText(null);
    }
  }, [syncStatus]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);

  if (!loaded) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ padding: spacing[4], gap: spacing[3] }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} height={52} borderRadius={10} />
            ))}
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        {pillText && (
          <View style={{ alignItems: "center", paddingVertical: spacing[1] }}>
            <View style={{ backgroundColor: `${colors.accent}20`, borderRadius: 99, paddingHorizontal: spacing[3], paddingVertical: 3 }}>
              <Text size="xs" style={{ color: colors.accent }}>{pillText}</Text>
            </View>
          </View>
        )}

        <View style={{ flex: 1, flexDirection: isDesktop ? "row" : "column" }}>
          <KeyboardAvoidingView
            style={{
              flex: isDesktop ? undefined : 1,
              width: isDesktop ? "40%" : undefined,
              borderRightWidth: isDesktop ? 1 : 0,
              borderRightColor: colors.bgBorder,
              overflow: "hidden",
            }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16], ...webContentStyle }}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
              }
            >
              {/* Header */}
              <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5] }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text size="2xl" weight="bold">Tasks</Text>
                  <View style={{ flexDirection: "row", gap: spacing[2] }}>
                    {([ ["focus", focusMode, () => setFocusMode(v => !v), "Focus"],
                        ["select", selectMode, () => { setSelectMode(v => !v); setSelectedIds(new Set()); }, selectMode ? "Cancel" : "Select"],
                    ] as [string, boolean, () => void, string][]).map(([key, active, onPress, label]) => (
                      <Pressable key={key} onPress={onPress} style={{
                        paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
                        borderRadius: radius.sm, borderWidth: 1,
                        borderColor: active ? colors.accent : colors.bgBorder,
                        backgroundColor: active ? `${colors.accent}18` : "transparent",
                      }}>
                        <Text size="xs" weight="medium" style={{ color: active ? colors.accent : colors.textSecondary }}>{label}</Text>
                      </Pressable>
                    ))}
                    {archived.length > 0 && (
                      <Pressable onPress={() => setShowArchive(v => !v)} style={{
                        paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
                        borderRadius: radius.sm, borderWidth: 1,
                        borderColor: showArchive ? colors.accent : colors.bgBorder,
                        backgroundColor: showArchive ? `${colors.accent}18` : "transparent",
                      }}>
                        <Text size="xs" weight="medium" style={{ color: showArchive ? colors.accent : colors.textSecondary }}>
                          Archive · {archived.length}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
                <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
                  {open.length > 0 ? `${open.length} open` : "All done"}
                </Text>
              </View>

              <AddTaskRow onAdd={handleAdd} inputRef={addInputRef} />

              <SearchBar value={search} onChange={setSearch} placeholder="Search tasks…" />
              <View style={{ flexDirection: "row", gap: spacing[1.5], flexWrap: "wrap", marginBottom: spacing[3] }}>
                {(Object.entries(PRIORITY_CONFIG) as [Priority, { label: string; color: string }][]).map(([key, cfg]) => (
                  <Chip key={key} label={cfg.label} color={cfg.color} active={filterPriority === key}
                    onPress={() => setFilterPriority(p => p === key ? null : key)} />
                ))}
              </View>

              {/* Sort / Group bar */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], flexWrap: "wrap", marginBottom: spacing[4] }}>
                {!focusMode && (
                  <>
                    <Pressable onPress={() => setGrouped(v => !v)} style={{
                      paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
                      borderRadius: radius.sm, borderWidth: 1,
                      borderColor: colors.bgBorder, backgroundColor: colors.bgTertiary,
                    }}>
                      <Text size="xs" style={{ color: colors.textSecondary }}>{grouped ? "Grouped" : "Flat"}</Text>
                    </Pressable>
                    <Pressable onPress={() => setCompact(v => !v)} style={{
                      paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
                      borderRadius: radius.sm, borderWidth: 1,
                      borderColor: compact ? colors.accent : colors.bgBorder,
                      backgroundColor: compact ? `${colors.accent}15` : colors.bgTertiary,
                    }}>
                      <Text size="xs" style={{ color: compact ? colors.accent : colors.textSecondary }}>Compact</Text>
                    </Pressable>
                    <View style={{ width: 1, height: 14, backgroundColor: colors.bgBorder }} />
                  </>
                )}
                {([["priority", "Priority"], ["due_date", "Due date"], ["title", "A–Z"], ["created", "Added"]] as [SortBy, string][]).map(([key, label]) => (
                  <Pressable key={key} onPress={() => setSortBy(key)} style={{
                    paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
                    borderRadius: radius.sm, borderWidth: 1,
                    borderColor: sortBy === key ? colors.accent : colors.bgBorder,
                    backgroundColor: sortBy === key ? `${colors.accent}15` : "transparent",
                  }}>
                    <Text size="xs" style={{ color: sortBy === key ? colors.accent : colors.textSecondary }}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              {focusMode ? (
                focusTasks.length === 0 ? (
                  <EmptyState type="tasks" title="All clear" subtitle="No overdue or due-today tasks — enjoy the moment." />
                ) : (
                  <Section label={`Focus · ${focusTasks.length}`} tasks={focusTasks} {...sectionProps} />
                )
              ) : tasks.length === 0 ? (
                <EmptyState type="tasks" title="No tasks yet" subtitle={'Tap the field above or press "N" to add your first task.'} />
              ) : !grouped ? (
                <>
                  <Section label="All tasks" tasks={applySort(visible.filter(t => !t.done), sortBy)} {...sectionProps} />
                  {done.length > 0 && <Section label="Completed" tasks={done} {...sectionProps} sortBy="completed" persistCollapse="tasks_section_collapsed_completed" defaultCollapsed={true} />}
                </>
              ) : (
                <>
                  {overdue.length > 0    && <Section label="Overdue"    tasks={overdue}    {...sectionProps} />}
                  {todayTasks.length > 0 && <Section label="Today"      tasks={todayTasks} {...sectionProps} />}
                  <Section label="Scheduled" tasks={scheduled} {...sectionProps} />
                  <Section label="Someday"   tasks={someday}   {...sectionProps} emptyMessage="No tasks without a due date" />
                  {done.length > 0       && <Section label="Completed"  tasks={done}       {...sectionProps} sortBy="completed" persistCollapse="tasks_section_collapsed_completed" defaultCollapsed={true} />}
                </>
              )}

              {/* Archive */}
              {showArchive && archived.length > 0 && (
                <View style={{ marginTop: spacing[4] }}>
                  <Text size="xs" weight="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.2, color: colors.textTertiary, fontSize: 11, marginBottom: spacing[3] }}>
                    Archive · {archived.length}
                  </Text>
                  <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.bgBorder, overflow: "hidden" }}>
                    {archived.map((task, i) => (
                      <View key={task.id} style={{
                        flexDirection: "row", alignItems: "center",
                        paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3],
                        borderBottomWidth: i === archived.length - 1 ? 0 : 1, borderBottomColor: colors.bgBorder,
                      }}>
                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.bgBorder, alignItems: "center", justifyContent: "center" }}>
                          <View style={{ width: 8, height: 4, borderLeftWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.textTertiary, transform: [{ rotate: "-45deg" }, { translateY: -1 }] }} />
                        </View>
                        <Text size="sm" style={{ flex: 1, color: colors.textTertiary, textDecorationLine: "line-through", opacity: 0.7 }} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <Pressable onPress={() => unarchiveTask(task.id)} hitSlop={8}>
                          <Text size="xs" style={{ color: colors.accent }}>Restore</Text>
                        </Pressable>
                        <Pressable onPress={() => deleteTask(task.id)} hitSlop={8}>
                          <Ionicons name="close-outline" size={14} color={colors.textTertiary} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Bulk-action bar */}
            {selectMode && (
              <View style={{ flexDirection: "row", gap: spacing[2], padding: spacing[3], backgroundColor: colors.bgSecondary, borderTopWidth: 1, borderTopColor: colors.bgBorder, flexWrap: "wrap" }}>
                <Text size="sm" secondary style={{ alignSelf: "center", marginRight: spacing[1] }}>
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select tasks"}
                </Text>
                {selectedIds.size > 0 && (
                  <>
                    <Pressable onPress={handleBulkComplete}
                      style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: colors.accent }}>
                      <Text size="sm" weight="medium" style={{ color: colors.textInverse }}>Complete</Text>
                    </Pressable>
                    <Pressable onPress={() => { selectedIds.forEach(id => updateTask(id, { due_date: getTodayStr() })); showToast(`Due today for ${selectedIds.size}`); setSelectedIds(new Set()); setSelectMode(false); }}
                      style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder }}>
                      <Text size="sm" weight="medium" style={{ color: colors.textSecondary }}>Today</Text>
                    </Pressable>
                    <Pressable onPress={() => { selectedIds.forEach(id => archiveTask(id)); showToast(`${selectedIds.size} archived`); setSelectedIds(new Set()); setSelectMode(false); }}
                      style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder }}>
                      <Text size="sm" weight="medium" style={{ color: colors.textSecondary }}>Archive</Text>
                    </Pressable>
                    <Pressable onPress={handleBulkDelete}
                      style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: `${colors.danger}20`, borderWidth: 1, borderColor: `${colors.danger}44` }}>
                      <Text size="sm" weight="medium" style={{ color: colors.danger }}>Delete</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </KeyboardAvoidingView>

          {/* Desktop right panel */}
          {isDesktop && (
            <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
              {selectedTaskId && tasks.find(t => t.id === selectedTaskId) ? (
                <TaskDetailPanel task={tasks.find(t => t.id === selectedTaskId)!} onClose={() => setSelectedTaskId(null)} />
              ) : (
                <EmptyDetailPane open={open} onFocusAddInput={() => addInputRef.current?.focus()} />
              )}
            </View>
          )}
        </View>

        {/* Mobile task detail modal */}
        {!isDesktop && showMobileDetail && selectedTaskId && tasks.find(t => t.id === selectedTaskId) && (
          <Modal visible={showMobileDetail} animationType="slide"
            onRequestClose={() => { setShowMobileDetail(false); setSelectedTaskId(null); }}
            statusBarTranslucent
          >
            <GradientBackground>
              <SafeAreaView style={{ flex: 1 }}>
                <TaskDetailPanel
                  task={tasks.find(t => t.id === selectedTaskId)!}
                  onClose={() => { setShowMobileDetail(false); setSelectedTaskId(null); }}
                />
              </SafeAreaView>
            </GradientBackground>
          </Modal>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

export default function TasksScreenBounded() {
  return <ErrorBoundary><TasksScreen /></ErrorBoundary>;
}

