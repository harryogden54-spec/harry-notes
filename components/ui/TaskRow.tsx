import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { Checkbox } from "./Checkbox";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";
import { useTasks, type Task } from "@/lib/TasksContext";
import { getTodayStr, getTomorrowStr, formatDueDate, PRIORITY_COLOR } from "@/lib/utils";

interface Props {
  task: Task;
  onPress: () => void;
}

export function TaskRow({ task, onPress }: Props) {
  const { colors } = useTheme();
  const { toggleTask } = useTasks();
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();
  const priorityColor = task.priority ? PRIORITY_COLOR[task.priority] : undefined;
  const due           = task.due_date ? formatDueDate(task.due_date, today, tomorrow, colors.danger, colors.accent) : null;
  const isOverdue     = !task.done && !!task.due_date && task.due_date < today;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing[3],
        paddingVertical: spacing[3], paddingHorizontal: spacing[3],
        borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
      }}
    >
      <Checkbox checked={task.done} onToggle={() => toggleTask(task.id)} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          size="sm"
          weight="medium"
          numberOfLines={1}
          style={{
            color: task.done ? colors.textTertiary : isOverdue ? colors.danger : colors.textPrimary,
            textDecorationLine: task.done ? "line-through" : "none",
          }}
        >
          {task.title}
        </Text>
        {(task.tags ?? []).length > 0 && (
          <View style={{ flexDirection: "row", gap: spacing[1] }}>
            {(task.tags ?? []).slice(0, 3).map(tag => (
              <Text key={tag} size="xs" style={{ color: colors.textTertiary }}>#{tag}</Text>
            ))}
          </View>
        )}
      </View>
      {isOverdue && (
        <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: colors.danger }} />
      )}
      {due && (
        <View style={{
          backgroundColor: `${due.color}18`,
          borderRadius: radius.sm,
          paddingHorizontal: spacing[2],
          paddingVertical: 3,
          borderWidth: 1,
          borderColor: `${due.color}40`,
        }}>
          <Text size="xs" weight="medium" style={{ color: due.color }}>{due.label}</Text>
        </View>
      )}
      {priorityColor && (
        <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: priorityColor }} />
      )}
    </Pressable>
  );
}
