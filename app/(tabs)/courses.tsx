import React, { useState, useMemo, useCallback } from "react";
import {
  View, Pressable, ScrollView, SafeAreaView, Platform, RefreshControl, useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useTheme } from "@/lib/useTheme";
import { Text, EmptyState, GradientBackground, Skeleton } from "@/components/ui";
import { spacing, getShadow } from "@/lib/theme";
import { webWideContentStyle } from "@/lib/webLayout";
import { useCoursesData, useCoursesActions, useCoursesSync, tableProgress, type CourseTable } from "@/lib/CoursesContext";
import { useToast } from "@/lib/ToastContext";
import { CourseTableCard, TableEditorModal, ProgressRing } from "@/components/courses";

function CoursesScreen() {
  const { colors, scheme } = useTheme();
  const { tables, loaded } = useCoursesData();
  const { deleteTable } = useCoursesActions();
  const { syncNow } = useCoursesSync();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 1024;

  const [editorVisible, setEditorVisible] = useState(false);
  const [editTarget, setEditTarget]       = useState<CourseTable | null>(null);
  const [refreshing, setRefreshing]       = useState(false);

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
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ padding: spacing[4], gap: spacing[3] }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={140} borderRadius={18} />)}
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16], ...webWideContentStyle }}
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
              ...getShadow("md", scheme),
              ...(Platform.OS === "web" ? {
                transitionProperty: "opacity, transform",
                transitionDuration: "150ms",
                transform: [{ scale: pressed ? 0.99 : 1 }],
              } : {}),
            } as any)}
          >
            <Ionicons name="add" size={17} color={colors.bgPrimary} />
            <Text size="sm" weight="semibold" style={{ color: colors.bgPrimary }}>New table</Text>
          </Pressable>

          {sorted.length === 0 ? (
            <EmptyState
              type="lists"
              title="No tables yet"
              subtitle="Create a table to track lectures reviewed, flashcards made and anything else per course — tickbox columns feed the progress ring."
            />
          ) : (
            <View style={{ gap: spacing[4] }}>
              {sorted.map(table => {
                const progress = tableProgress(table);
                return isDesktop ? (
                  <View key={table.id} style={{ flexDirection: "row", gap: spacing[3], alignItems: "stretch" }}>
                    <View style={{ flex: 1 }}>
                      <CourseTableCard
                        table={table}
                        onEdit={() => { setEditTarget(table); setEditorVisible(true); }}
                        onDelete={() => handleDelete(table)}
                      />
                    </View>
                    {/* Progress ring panel beside the table, per the mockup */}
                    <View style={{
                      width: 132, borderRadius: 18, borderWidth: 1, borderColor: `${colors.bgBorder}88`,
                      backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center",
                      gap: spacing[2], paddingVertical: spacing[4],
                      ...getShadow("sm", scheme),
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
      </SafeAreaView>
    </GradientBackground>
  );
}

export default function CoursesScreenBounded() {
  return <ErrorBoundary><CoursesScreen /></ErrorBoundary>;
}
