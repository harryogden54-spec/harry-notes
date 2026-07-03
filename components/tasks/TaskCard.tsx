import React from "react";
import { View, Pressable } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox, Surface } from "@/components/ui";
import { spacing } from "@/lib/theme";
import { getTodayStr } from "@/lib/utils";
import type { Task } from "@/lib/TasksContext";
import { PRIORITY_CONFIG, formatDate } from "./constants";
import { CategoryBadge } from "./CategoryBadge";

type Props = {
  task: Task;
  selected?: boolean;
  selectMode?: boolean;
  highlighted?: boolean;
  onPress: () => void;
  onToggleDone: () => void;
  onSelect?: () => void;
};

/** Floating card "bubble" used by the desktop category board (CategoryColumns). */
export const TaskCard = React.memo(function TaskCard({
  task, selected = false, selectMode = false, highlighted = false,
  onPress, onToggleDone, onSelect,
}: Props) {
  const { colors } = useTheme();
  const today        = getTodayStr();
  const overdue       = !task.done && !!task.due_date && task.due_date < today;
  const dueColor      = overdue ? colors.danger : task.due_date === today ? colors.warning : colors.textTertiary;
  const priorityCfg   = task.priority ? PRIORITY_CONFIG[task.priority] : undefined;
  const subtasks      = task.subtasks ?? [];
  const doneSubtasks  = subtasks.filter(s => s.done).length;

  return (
    <Surface
      variant="elevated"
      style={{
        marginBottom: spacing[1.5],
        borderColor: highlighted ? colors.accent : selected ? colors.accent : undefined,
        borderWidth: highlighted || selected ? 2 : 1,
        opacity: selected && selectMode ? 0.85 : 1,
        ...(task.priority === "urgent" && !task.done ? { backgroundColor: `${colors.danger}0C` } : {}),
      }}
    >
      <Pressable
        onPress={selectMode ? onSelect : onPress}
        style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[2.5], padding: spacing[3] }}
      >
        <View style={{ marginTop: 1 }}>
          <Checkbox
            checked={selectMode ? selected : task.done}
            onToggle={selectMode ? (onSelect ?? (() => {})) : onToggleDone}
          />
        </View>
        <View style={{ flex: 1, gap: spacing[1.5] }}>
          <Text
            size="sm" weight="medium"
            style={{
              color: task.done ? colors.textTertiary : colors.textPrimary,
              textDecorationLine: task.done ? "line-through" : "none",
            }}
          >
            {task.title}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5], alignItems: "center" }}>
            {task.due_date && (
              <Text size="xs" weight={overdue ? "semibold" : "regular"} style={{ color: dueColor }}>
                {overdue ? `${formatDate(task.due_date)} · overdue` : formatDate(task.due_date)}
              </Text>
            )}
            {priorityCfg && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: priorityCfg.color }} />
                <Text size="xs" style={{ color: colors.textTertiary }}>{priorityCfg.label}</Text>
              </View>
            )}
            {subtasks.length > 0 && (
              <Text size="xs" style={{ color: colors.textTertiary }}>{doneSubtasks}/{subtasks.length}</Text>
            )}
            {task.category === "uni" && task.uniCourse && (
              <CategoryBadge category={task.category} uniCourse={task.uniCourse} />
            )}
          </View>
        </View>
      </Pressable>
    </Surface>
  );
});
