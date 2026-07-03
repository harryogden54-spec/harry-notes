import React from "react";
import { View } from "react-native";
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
      <TaskCard
        key={t.id}
        task={t}
        selected={selectMode ? selectedIds.has(t.id) : selectedTaskId === t.id}
        selectMode={selectMode}
        highlighted={highlightId === t.id}
        onPress={() => onSelectTask(t.id)}
        onToggleDone={() => onToggleDone(t.id)}
        onSelect={() => onBulkSelect(t.id)}
      />
    );
  }

  function renderColumn(label: string, color: string, items: Task[]) {
    // On mobile, skip empty categories entirely to save space; on desktop
    // keep the column (with a quiet hint) so the 2-column structure holds.
    if (items.length === 0 && stacked) return null;
    return (
      <View style={stacked ? undefined : { flex: 1, minWidth: 0 }}>
        <ColumnHeader label={label} count={items.length} color={color} />
        {items.length === 0 ? <ColumnEmptyHint /> : <View>{items.map(renderCard)}</View>}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing[5] }}>
      {unsorted.length > 0 && (
        <View>
          <ColumnHeader label="Unsorted" count={unsorted.length} />
          <View>{unsorted.map(renderCard)}</View>
        </View>
      )}
      {stacked ? (
        <View style={{ gap: spacing[5] }}>
          {renderColumn("Personal", categoryColors.personal, personal)}
          {renderColumn("Uni", categoryColors.uni, uni)}
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: spacing[4] }}>
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: spacing[3] }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
      <Text size="xs" weight="semibold" style={{ letterSpacing: 1, color: colors.textSecondary, textTransform: "uppercase" }}>
        {label}
      </Text>
      {count > 0 && (
        <View style={{ backgroundColor: colors.bgTertiary, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1 }}>
          <Text size="xs" style={{ color: colors.textTertiary }}>{count}</Text>
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
