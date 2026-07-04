import React from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, categoryColors } from "@/lib/theme";
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
  /** Mobile (design 1c): stack Personal/Uni as sections in one column instead of side-by-side. */
  stacked?: boolean;
};

/**
 * Tasks board: an "Unsorted" strip for tasks with no category (category
 * is optional in the data model, but the design only has 2 columns),
 * followed by Personal / Uni — side-by-side on desktop, stacked on mobile.
 */
export function CategoryColumns({
  tasks, selectedTaskId, onSelectTask, onToggleDone,
  selectMode, selectedIds, onBulkSelect, highlightId, stacked = false,
}: Props) {
  const unsorted = tasks.filter(t => !t.category);
  const personal = tasks.filter(t => t.category === "personal");
  const uni      = tasks.filter(t => t.category === "uni");

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

  function renderColumn(label: string, color: string, items: Task[]) {
    // On mobile, skip empty categories entirely to save space; on desktop
    // keep the column (with a quiet hint) so the 2-column structure holds.
    if (items.length === 0 && stacked) return null;
    return (
      <View style={stacked ? undefined : { flex: 1, minWidth: 0 }}>
        <ColumnHeader label={label} count={items.length} color={color} />
        {items.length === 0
          ? <ColumnEmptyHint />
          : <View style={{ gap: spacing[2.5] }}>{items.map(renderCard)}</View>}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing[5] }}>
      {unsorted.length > 0 && (
        <View>
          <ColumnHeader label="Unsorted" count={unsorted.length} />
          <View style={{ gap: spacing[2.5] }}>{unsorted.map(renderCard)}</View>
        </View>
      )}
      {stacked ? (
        <View style={{ gap: spacing[5] }}>
          {renderColumn("Personal", categoryColors.personal, personal)}
          {renderColumn("Uni", categoryColors.uni, uni)}
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: spacing[5] }}>
          {renderColumn("Personal", categoryColors.personal, personal)}
          {renderColumn("Uni", categoryColors.uni, uni)}
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
