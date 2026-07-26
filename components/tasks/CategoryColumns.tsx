import React from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, resolveAccentSwatch } from "@/lib/theme";
import { useCategoriesData, topLevel, rootCategoryId } from "@/lib/TaskCategoriesContext";
import type { Task } from "@/lib/TasksContext";
import { TaskCard } from "./TaskCard";

type Props = {
  tasks: Task[]; // open, undone tasks — already sorted
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onToggleDone: (id: string) => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  onBulkSelect: (id: string) => void;
  highlightId?: string | null;
  /** Mobile: stack category columns as sections in one column instead of side-by-side. */
  stacked?: boolean;
};

/**
 * Tasks board: an "Uncategorized" strip for tasks with no (or an unknown/
 * deleted) category, followed by one column per user-defined category —
 * side-by-side on desktop, stacked on mobile — ordered by Category.order.
 */
export function CategoryColumns({
  tasks, selectedTaskId, onSelectTask, onToggleDone,
  selectMode, selectedIds, onBulkSelect, highlightId, stacked = false,
}: Props) {
  const { scheme } = useTheme();
  const { categories } = useCategoriesData();
  // Columns are top level only; a task filed under a subcategory still belongs
  // in its parent's column, so group by root id. The subcategory itself shows on
  // the card via CategoryBadge.
  const sorted = topLevel(categories);
  const knownIds = new Set(categories.map(c => c.id));
  const uncategorized = tasks.filter(t => !t.category || !knownIds.has(t.category));

  function renderCard(t: Task) {
    return (
      <Animated.View
        key={t.id}
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(140)}
        layout={LinearTransition.duration(200)}
      >
        <TaskCard
          task={t}
          selected={selectMode ? selectedIds.has(t.id) : selectedTaskId === t.id}
          selectMode={selectMode}
          highlighted={highlightId === t.id}
          onPress={() => onSelectTask(t.id)}
          onToggleDone={() => onToggleDone(t.id)}
          onSelect={() => onBulkSelect(t.id)}
        />
      </Animated.View>
    );
  }

  function renderColumn(id: string, label: string, color: string, items: Task[]) {
    // On mobile, skip empty categories entirely to save space; on desktop
    // keep the column (with a quiet hint) so the multi-column structure holds.
    if (items.length === 0 && stacked) return null;
    return (
      <View key={id} style={stacked ? undefined : { flex: 1, minWidth: 0 }}>
        <ColumnHeader label={label} count={items.length} color={color} />
        {items.length === 0
          ? <ColumnEmptyHint />
          : <View style={{ gap: spacing[2.5] }}>{items.map(renderCard)}</View>}
      </View>
    );
  }

  const columns = sorted.map(cat => ({
    id: cat.id,
    label: cat.name,
    color: resolveAccentSwatch(cat.color, scheme).color,
    items: tasks.filter(t => rootCategoryId(categories, t.category) === cat.id),
  }));

  return (
    <View style={{ gap: spacing[5] }}>
      {uncategorized.length > 0 && (
        <View>
          <ColumnHeader label="Uncategorized" count={uncategorized.length} />
          <View style={{ gap: spacing[2.5] }}>{uncategorized.map(renderCard)}</View>
        </View>
      )}
      {stacked ? (
        <View style={{ gap: spacing[5] }}>
          {columns.map(col => renderColumn(col.id, col.label, col.color, col.items))}
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: spacing[5] }}>
          {columns.map(col => renderColumn(col.id, col.label, col.color, col.items))}
        </View>
      )}
    </View>
  );
}

function ColumnHeader({ label, count, color }: { label: string; count: number; color?: string }) {
  const { colors } = useTheme();
  const dot = color ?? colors.textTertiary;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: spacing[3], paddingHorizontal: 6 }}>
      <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: dot }} />
      <Text size="xs" weight="semibold" style={{ letterSpacing: 0.8, color: colors.textSecondary, textTransform: "uppercase" }}>
        {label}
      </Text>
      {count > 0 && (
        <View style={{
          backgroundColor: color ? `${color}2E` : colors.bgTertiary,
          borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1,
        }}>
          <Text size="xs" weight="semibold" style={{ color: color ?? colors.textTertiary, fontSize: 11.5 }}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function ColumnEmptyHint() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: spacing[4], alignItems: "center" }}>
      <Text size="xs" style={{ color: colors.textTertiary, opacity: 0.6 }}>Nothing here</Text>
    </View>
  );
}
