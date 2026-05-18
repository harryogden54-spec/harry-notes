import React, { useState, useEffect, useCallback } from "react";
import { View, Pressable, Platform } from "react-native";
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist";
import { useTheme } from "@/lib/useTheme";
import { Text, Surface } from "@/components/ui";
import { spacing, fontFamily } from "@/lib/theme";
import { storage } from "@/lib/storage";
import type { Task } from "@/lib/TasksContext";
import { applySort, type SortBy } from "./constants";
import { TaskItem } from "./TaskItem";

type Props = {
  label: string;
  tasks: Task[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  emptyMessage?: string;
  selectMode: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onReorderUp: (id: string) => void;
  onReorderDown: (id: string) => void;
  onReorder: (newOrder: Task[]) => void;
  highlightId?: string | null;
  onTaskMeasureY?: (id: string, y: number) => void;
  sortBy?: SortBy;
  onLongPress?: (id: string) => void;
  persistCollapse?: string;
  onUpdate: (id: string, updates: Partial<Omit<Task, "id" | "created_at">>) => void;
  compact?: boolean;
};

export const Section = React.memo(function Section({
  label, tasks, expandedId, onToggleExpand, emptyMessage,
  selectMode, selectedIds, onSelect, onDelete,
  onReorderUp, onReorderDown, onReorder,
  highlightId, onTaskMeasureY, sortBy = "priority",
  onLongPress, persistCollapse, onUpdate,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!persistCollapse) return;
    storage.get<boolean>(persistCollapse).then(val => {
      if (val !== null && val !== undefined) setCollapsed(val);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (persistCollapse) storage.set(persistCollapse, next);
  }

  const renderItem = useCallback(({ item: t, drag, isActive }: RenderItemParams<Task>) => (
    <ScaleDecorator>
      <TaskItem
        task={t}
        isExpanded={expandedId === t.id}
        onToggleExpand={() => onToggleExpand(t.id)}
        selectMode={selectMode}
        selected={selectedIds.has(t.id)}
        onSelect={() => onSelect(t.id)}
        onReorderUp={() => onReorderUp(t.id)}
        onReorderDown={() => onReorderDown(t.id)}
        onDelete={() => onDelete(t.id)}
        onDragStart={drag}
        isDragging={isActive}
        highlighted={highlightId === t.id}
        onMeasureY={y => onTaskMeasureY?.(t.id, y)}
        onLongPress={() => onLongPress?.(t.id)}
        onUpdate={onUpdate}
        compact={compact}
      />
    </ScaleDecorator>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [expandedId, selectMode, selectedIds, highlightId, onUpdate, compact]);

  if (tasks.length === 0 && !emptyMessage) return null;

  const sorted = applySort(tasks, sortBy);
  const isOverdueSection   = label.toLowerCase().startsWith("overdue");
  const isCompletedSection = label.toLowerCase().startsWith("completed");

  const labelColor = isOverdueSection ? colors.danger : isCompletedSection ? colors.textTertiary : colors.textSecondary;
  const labelSize  = isOverdueSection ? 12 : 11;

  return (
    <View style={{ marginBottom: spacing[6] }}>
      <Pressable
        onPress={toggleCollapsed}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: collapsed ? 0 : spacing[3] }}
      >
        <Text style={{ fontSize: labelSize, letterSpacing: 1, color: labelColor, fontFamily: fontFamily.semibold, textTransform: "uppercase" }}>
          {label}
        </Text>
        {tasks.length > 0 && (
          <View style={{ backgroundColor: isOverdueSection ? `${colors.danger}20` : colors.bgTertiary, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1 }}>
            <Text size="xs" style={{ color: isOverdueSection ? colors.danger : colors.textTertiary }}>{tasks.length}</Text>
          </View>
        )}
        <Text size="xs" style={{ color: colors.textTertiary, marginLeft: "auto" }}>{collapsed ? "▾" : "▴"}</Text>
      </Pressable>
      {!collapsed && (
        tasks.length === 0 && emptyMessage ? (
          <Surface>
            <View style={{ padding: spacing[5], alignItems: "center" }}>
              <Text size="sm" secondary>{emptyMessage}</Text>
            </View>
          </Surface>
        ) : (
          <DraggableFlatList
            data={sorted}
            keyExtractor={t => t.id}
            renderItem={renderItem}
            onDragEnd={({ data }) => onReorder(data)}
            scrollEnabled={false}
            activationDistance={Platform.OS === "web" ? 999 : 20}
            removeClippedSubviews={Platform.OS !== "web"}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        )
      )}
    </View>
  );
});
