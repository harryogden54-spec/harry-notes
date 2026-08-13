import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View, Pressable, ScrollView, Platform, RefreshControl, useWindowDimensions,
} from "react-native";
// Side-notch padding only — PersistentHeader owns the top inset, MobileTabBar the bottom.
import { SideSafeArea } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useTheme } from "@/lib/useTheme";
import { Text, EmptyState, GradientBackground, Skeleton } from "@/components/ui";
import { spacing, getShadow } from "@/lib/theme";
import { useScrollBottomPadding } from "@/lib/TabBarHeightContext";
import { storage } from "@/lib/storage";
import { webWideContentStyle } from "@/lib/webLayout";
import { useCoursesData, useCoursesActions, useCoursesSync, tableProgress, type CourseTable } from "@/lib/CoursesContext";
import { useToast } from "@/lib/ToastContext";
import { CourseTableCard, TableEditorModal, ProgressRing } from "@/components/courses";

const COLLAPSED_KEY = "courses_collapsed";

/** True when every table is condensed (and there is at least one). */
function sortedIdsAllIn(collapsed: string[], tables: CourseTable[]): boolean {
  return tables.length > 0 && tables.every(t => collapsed.includes(t.id));
}

function CoursesScreen() {
  const { colors, scheme, shadow } = useTheme();
  const scrollBottom = useScrollBottomPadding();
  const { tables, loaded } = useCoursesData();
  const { deleteTable } = useCoursesActions();
  const { syncNow } = useCoursesSync();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 1024;

  const [editorVisible, setEditorVisible] = useState(false);
  const [editTarget, setEditTarget]       = useState<CourseTable | null>(null);
  const [refreshing, setRefreshing]       = useState(false);

  // Condensed tables, persisted locally (a view preference, not synced data).
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  useEffect(() => {
    storage.get<string[]>(COLLAPSED_KEY).then(v => { if (Array.isArray(v)) setCollapsedIds(v); });
  }, []);
  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      storage.set(COLLAPSED_KEY, next);
      return next;
    });
  }, []);
  const allCollapsed = sortedIdsAllIn(collapsedIds, tables);
  const toggleAll = useCallback(() => {
    const next = allCollapsed ? [] : tables.map(t => t.id);
    setCollapsedIds(next);
    storage.set(COLLAPSED_KEY, next);
  }, [allCollapsed, tables]);

  const { sorted, overall } = useMemo(() => {
    const sorted = [...tables].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const overall = sorted.reduce(
      (acc, t) => {
        const p = tableProgress(t);
        return { ticked: acc.ticked + p.ticked, total: acc.total + p.total };
      },
      { ticked: 0, total: 0 }
    );
    return { sorted, overall };
  }, [tables]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);

  const handleDelete = useCallback((table: CourseTable) => {
    const undo = deleteTable(table.id);
    showToast(`"${table.title || "Untitled table"}" deleted`, { label: "Undo", onPress: undo });
  }, [deleteTable, showToast]);

  if (!loaded) {
    return (
      <GradientBackground>
        <SideSafeArea style={{ flex: 1 }}>
          <View style={{ padding: spacing[4], gap: spacing[3] }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={140} borderRadius={18} />)}
          </View>
        </SideSafeArea>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SideSafeArea style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: scrollBottom, ...webWideContentStyle }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
          }
        >
          {/* Header */}
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5] }}>
            <Text size="title" weight="bold">Courses</Text>
            <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
              {sorted.length === 0
                ? "Progress tables for revision tracking"
                : `${sorted.length} table${sorted.length !== 1 ? "s" : ""}${
                    overall.total > 0 ? ` · ${Math.round((overall.ticked / overall.total) * 100)}% ticked overall` : ""
                  }`}
            </Text>
          </View>

          {/* New table — full-width primary action, per the mockup */}
          <Pressable
            onPress={() => { setEditTarget(null); setEditorVisible(true); }}
            accessibilityLabel="New table"
            style={({ hovered, pressed }: any) => ({
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing[2],
              borderRadius: 18, paddingVertical: spacing[3],
              backgroundColor: colors.textPrimary,
              opacity: pressed ? 0.85 : hovered ? 0.92 : 1,
              marginBottom: spacing[5],
              ...shadow("md"),
              ...(Platform.OS === "web" ? {
                transitionProperty: "opacity, transform",
                transitionDuration: "150ms",
                transform: [{ scale: pressed ? 0.99 : 1 }],
              } : {}),
            } as any)}
          >
            <Ionicons name="add" size={16} color={colors.bgPrimary} />
            <Text size="sm" weight="semibold" style={{ color: colors.bgPrimary }}>New table</Text>
          </Pressable>

          {sorted.length === 0 ? (
            <EmptyState
              type="courses"
              title="No tables yet"
              subtitle="Create a table to track lectures reviewed, flashcards made and anything else per course — tickbox columns feed the progress ring."
            />
          ) : (
            <View style={{ gap: spacing[4] }}>
              {sorted.length > 1 && (
                <Pressable
                  onPress={toggleAll}
                  hitSlop={6}
                  style={{ alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: spacing[1] }}
                >
                  <Ionicons name={allCollapsed ? "chevron-down" : "chevron-up"} size={12} color={colors.textTertiary} />
                  <Text size="xs" tertiary>{allCollapsed ? "Expand all" : "Condense all"}</Text>
                </Pressable>
              )}
              {sorted.map(table => {
                const progress = tableProgress(table);
                const isCollapsed = collapsedIds.includes(table.id);
                // Condensed on desktop drops the side ring panel — the header
                // carries the ring, and a 132px panel beside a single header row
                // looks like a mistake.
                return isDesktop && !isCollapsed ? (
                  <View key={table.id} style={{ flexDirection: "row", gap: spacing[3], alignItems: "stretch" }}>
                    <View style={{ flex: 1 }}>
                      <CourseTableCard
                        table={table}
                        collapsed={isCollapsed}
                        onToggleCollapse={() => toggleCollapsed(table.id)}
                        onEdit={() => { setEditTarget(table); setEditorVisible(true); }}
                        onDelete={() => handleDelete(table)}
                      />
                    </View>
                    {/* Progress ring panel beside the table, per the mockup */}
                    <View style={{
                      width: 132, borderRadius: 18, borderWidth: 1, borderColor: `${colors.bgBorder}88`,
                      backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center",
                      gap: spacing[2], paddingVertical: spacing[4],
                      ...shadow("sm"),
                    }}>
                      <ProgressRing ticked={progress.ticked} total={progress.total} size={72} />
                      <Text size="2xs" tertiary style={{ textAlign: "center" }}>
                        {progress.total > 0 ? `${progress.ticked}/${progress.total} ticked` : "No tickboxes"}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <CourseTableCard
                    key={table.id}
                    table={table}
                    ringInHeader
                    collapsed={isCollapsed}
                    onToggleCollapse={() => toggleCollapsed(table.id)}
                    onEdit={() => { setEditTarget(table); setEditorVisible(true); }}
                    onDelete={() => handleDelete(table)}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>

        <TableEditorModal
          visible={editorVisible}
          onClose={() => setEditorVisible(false)}
          table={editTarget}
        />
      </SideSafeArea>
    </GradientBackground>
  );
}

export default function CoursesScreenBounded() {
  return <ErrorBoundary><CoursesScreen /></ErrorBoundary>;
}
