import React, { useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox } from "@/components/ui";
import { spacing, shape, getShadow, transition } from "@/lib/theme";
import { getTodayStr } from "@/lib/utils";
import type { Task } from "@/lib/TasksContext";
import { PRIORITY_CONFIG, formatDate } from "./constants";
import { useCategoriesData } from "@/lib/TaskCategoriesContext";
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
      ...shape.pill, backgroundColor: tint,
    }}>
      {icon && <Ionicons name={icon} size={12} color={textColor} />}
      {dot && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />}
      <Text size="meta" weight={bold ? "semibold" : "medium"} color={textColor}>
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
  const isHighPriority = task.priority === "urgent" || task.priority === "high";
  const subtasks      = task.subtasks ?? [];
  const doneSubtasks  = subtasks.filter(s => s.done).length;
  // Board columns are top level, so only a subcategory adds information here.
  const { categories } = useCategoriesData();
  const isSubCategory = !!categories.find(c => c.id === task.category)?.parent_id;
  const showsCategory = isSubCategory || (task.category === "uni" && !!task.uniCourse);
  const showMeta = !!task.due_date || !!priorityCfg || subtasks.length > 0 || showsCategory;

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
        flexDirection: "row", alignItems: "flex-start", gap: spacing[3],
        ...shape.card,
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
          size="cardTitle" weight="medium"
          style={{
            color: task.done ? colors.textTertiary : colors.textPrimary,
            textDecorationLine: task.done ? "line-through" : "none",
          }}
        >
          {task.title}
        </Text>
        {showMeta && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5], alignItems: "center" }}>
            {task.due_date && (
              <MetaPill
                icon="calendar-clear-outline"
                label={overdue ? `${formatDate(task.due_date)} · overdue` : formatDate(task.due_date)}
                tint={overdue ? `${colors.danger}1A` : dueToday ? `${colors.warning}1E` : colors.bgTertiary}
                textColor={overdue ? colors.danger : dueToday ? colors.warning : colors.textSecondary}
                bold={overdue}
              />
            )}
            {/* Colour is the signal, so it is spent only where it means
                something: urgent and high carry their priority colour, medium
                and low stay neutral. The old coloured dot alongside the word
                said the same thing twice. */}
            {priorityCfg && (
              <MetaPill
                label={priorityCfg.label}
                tint={isHighPriority ? `${priorityCfg.color}1A` : colors.bgTertiary}
                textColor={isHighPriority ? priorityCfg.color : colors.textSecondary}
                bold={isHighPriority}
              />
            )}
            {/* Legacy uni-course badge, or a subcategory — a plain top-level
                category needs no badge, its column already says it. */}
            {((task.category === "uni" && task.uniCourse) || isSubCategory) && (
              <CategoryBadge category={task.category} uniCourse={task.uniCourse} rootImplied />
            )}
            {/* Subtask progress is the one meta item that does not change what
                you would do next, so it drops out of the pill language and
                reads as quiet text. Deliberately not hover-revealed: adding a
                pill on hover re-wraps the row and grows the card. */}
            {subtasks.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="git-branch-outline" size={12} color={colors.textTertiary} />
                <Text size="meta" tertiary>{doneSubtasks}/{subtasks.length}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
});
