import React, { useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox } from "@/components/ui";
import { spacing, getShadow, transition } from "@/lib/theme";
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

/** Small tinted pill chip for card metadata (due date, priority, subtasks). */
function MetaPill({ icon, dot, label, tint, textColor, bold }: {
  icon?: keyof typeof Ionicons.glyphMap;
  dot?: string;
  label: string;
  tint: string;
  textColor: string;
  bold?: boolean;
}) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 9, paddingVertical: 3,
      borderRadius: 999, backgroundColor: tint,
    }}>
      {icon && <Ionicons name={icon} size={11} color={textColor} />}
      {dot && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />}
      <Text size="xs" weight={bold ? "semibold" : "medium"} style={{ color: textColor, fontSize: 11.5 }}>
        {label}
      </Text>
    </View>
  );
}

/** Floating card "bubble" used by the tasks category board (CategoryColumns). */
export const TaskCard = React.memo(function TaskCard({
  task, selected = false, selectMode = false, highlighted = false,
  onPress, onToggleDone, onSelect,
}: Props) {
  const { colors, scheme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const today        = getTodayStr();
  const overdue       = !task.done && !!task.due_date && task.due_date < today;
  const dueToday      = !task.done && task.due_date === today;
  const priorityCfg   = task.priority ? PRIORITY_CONFIG[task.priority] : undefined;
  const subtasks      = task.subtasks ?? [];
  const doneSubtasks  = subtasks.filter(s => s.done).length;

  const borderColor =
    highlighted || selected ? colors.accent :
    overdue                 ? `${colors.danger}2E` :
    `${colors.bgBorder}88`;

  return (
    <Pressable
      onPress={selectMode ? onSelect : onPress}
      // @ts-ignore web hover events
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "flex-start", gap: 13,
        paddingVertical: 15, paddingHorizontal: 17,
        borderRadius: 18,
        borderWidth: highlighted || selected ? 2 : 1,
        borderColor,
        backgroundColor:
          task.priority === "urgent" && !task.done ? `${colors.danger}0C` :
          `${colors.bgSecondary}${hovered ? "F0" : "D0"}`,
        opacity: selected && selectMode ? 0.85 : 1,
        ...(hovered && !pressed ? getShadow("md", scheme) : getShadow("sm", scheme)),
        ...(Platform.OS === "web" ? {
          // @ts-ignore web-only CSS — smooth hover lift. No backdrop blur:
          // dozens of live blur layers hurt paint perf for no visible gain
          // over the smooth gradient background.
          ...transition("transform, box-shadow, background-color, border-color"),
          transform: [{ translateY: hovered && !pressed ? -1 : 0 }, { scale: pressed ? 0.99 : 1 }],
          cursor: "pointer",
        } : {}),
      })}
    >
      <View style={{ marginTop: 1 }}>
        <Checkbox
          shape="circle"
          size={22}
          checked={selectMode ? selected : task.done}
          onToggle={selectMode ? (onSelect ?? (() => {})) : onToggleDone}
        />
      </View>
      <View style={{ flex: 1, gap: spacing[2], minWidth: 0 }}>
        <Text
          size="sm" weight="medium"
          style={{
            color: task.done ? colors.textTertiary : colors.textPrimary,
            textDecorationLine: task.done ? "line-through" : "none",
            lineHeight: 19,
          }}
        >
          {task.title}
        </Text>
        {(task.due_date || priorityCfg || subtasks.length > 0 || (task.category === "uni" && task.uniCourse)) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
            {task.due_date && (
              <MetaPill
                icon="calendar-clear-outline"
                label={overdue ? `${formatDate(task.due_date)} · overdue` : formatDate(task.due_date)}
                tint={overdue ? `${colors.danger}1A` : dueToday ? `${colors.warning}1E` : colors.bgTertiary}
                textColor={overdue ? colors.danger : dueToday ? colors.warning : colors.textSecondary}
                bold={overdue}
              />
            )}
            {priorityCfg && (
              <MetaPill dot={priorityCfg.color} label={priorityCfg.label} tint={colors.bgTertiary} textColor={colors.textSecondary} />
            )}
            {subtasks.length > 0 && (
              <MetaPill icon="git-branch-outline" label={`${doneSubtasks}/${subtasks.length}`} tint={colors.bgTertiary} textColor={colors.textSecondary} />
            )}
            {task.category === "uni" && task.uniCourse && (
              <CategoryBadge category={task.category} uniCourse={task.uniCourse} />
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
});
