import React, { useEffect } from "react";
import { View, Pressable } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
} from "react-native-reanimated";
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

  // Animated strikethrough — scales from center so it appears to wipe across
  const strikeAnim = useSharedValue(task.done ? 1 : 0);
  useEffect(() => {
    strikeAnim.value = withTiming(task.done ? 1 : 0, { duration: 180 });
  }, [task.done]);
  const strikeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: strikeAnim.value }],
    opacity: strikeAnim.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing[3],
        paddingVertical: spacing[2] + 4, paddingHorizontal: spacing[3],
        borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
      }}
    >
      <Checkbox checked={task.done} onToggle={() => toggleTask(task.id)} />
      <View style={{ flex: 1, gap: 2 }}>
        {/* Title with animated strikethrough overlay */}
        <View style={{ position: "relative" }}>
          <Text
            size="sm"
            weight={task.done ? "regular" : "medium"}
            numberOfLines={1}
            style={{
              color: task.done ? colors.textTertiary : isOverdue ? colors.danger : colors.textPrimary,
            }}
          >
            {task.title}
          </Text>
          {/* Animated line — sits at vertical midpoint of text */}
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                height: 1,
                backgroundColor: colors.textTertiary,
                // @ts-ignore — transformOrigin for web left-to-right feel
                transformOrigin: "left center",
              },
              strikeStyle,
            ]}
          />
        </View>

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
