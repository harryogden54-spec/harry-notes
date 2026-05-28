import React, { useState } from "react";
import { View, TextInput, Pressable, Platform, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Swipeable } from "react-native-gesture-handler";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox, Divider, Surface } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { getTodayStr } from "@/lib/utils";
import type { Task } from "@/lib/TasksContext";
import { PRIORITY_CONFIG, formatDate } from "./constants";
import { CategoryBadge } from "./CategoryBadge";
import { PrioritySelector } from "./PrioritySelector";
import { DueDateSelector } from "./DueDateSelector";
import { CategorySelector } from "./CategorySelector";
import { SubtasksList } from "./SubtasksList";
import { MetaRow } from "./MetaRow";

type Props = {
  task: Task;
  isExpanded: boolean;
  onToggleExpand: () => void;
  selectMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onReorderUp: () => void;
  onReorderDown: () => void;
  onLongPress?: () => void;
  onDelete: () => void;
  onDragStart?: () => void;
  isDragging?: boolean;
  highlighted?: boolean;
  onMeasureY?: (y: number) => void;
  onUpdate: (id: string, updates: Partial<Omit<Task, "id" | "created_at">>) => void;
  compact?: boolean;
};

export const TaskItem = React.memo(function TaskItem({
  task, isExpanded, onToggleExpand,
  selectMode, selected, onSelect,
  onReorderUp, onReorderDown,
  onLongPress, onDelete, onDragStart,
  highlighted, onMeasureY, onUpdate,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [inlineField, setInlineField] = useState<"priority" | "due_date" | null>(null);

  // Close inline editor whenever the task expands to full detail
  React.useEffect(() => {
    if (isExpanded) setInlineField(null);
  }, [isExpanded]);
  const today = getTodayStr();
  const { width } = useWindowDimensions();
  const desktopMode = Platform.OS === "web" && width > 1024;

  const priorityColor = task.priority ? PRIORITY_CONFIG[task.priority]?.color : undefined;
  const overdue       = !task.done && !!task.due_date && task.due_date < today;
  const dueDateColor  = overdue ? colors.danger : task.due_date === today ? colors.warning : colors.textTertiary;
  const subtasks      = task.subtasks ?? [];
  const doneSubtasks  = subtasks.filter(s => s.done).length;

  function renderLeftActions() {
    if (Platform.OS === "web" || task.done) return null;
    return (
      <View style={{ justifyContent: "center", alignItems: "flex-end", paddingHorizontal: spacing[4], backgroundColor: `${colors.accent}22`, borderRadius: radius.lg, marginBottom: spacing[1.5], marginRight: spacing[1] }}>
        <Text size="xs" weight="semibold" style={{ color: colors.accent }}>Done</Text>
      </View>
    );
  }

  function renderRightActions() {
    if (Platform.OS === "web") return null;
    return (
      <View style={{ justifyContent: "center", alignItems: "flex-start", paddingHorizontal: spacing[4], backgroundColor: `${colors.danger}22`, borderRadius: radius.lg, marginBottom: spacing[1.5], marginLeft: spacing[1] }}>
        <Text size="xs" weight="semibold" style={{ color: colors.danger }}>Delete</Text>
      </View>
    );
  }

  return (
    <View onLayout={e => onMeasureY?.(e.nativeEvent.layout.y)}>
      <Swipeable
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableOpen={(dir) => {
          if (dir === "left" && !task.done) {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onUpdate(task.id, { done: true });
          } else if (dir === "right") {
            onDelete();
          }
        }}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
      >
        <Surface
          // @ts-ignore
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          variant="elevated"
          style={{
            borderColor: highlighted ? colors.accent : selected ? colors.accent : isExpanded ? (priorityColor ?? colors.accent) : undefined,
            borderWidth: highlighted ? 2 : 1,
            borderLeftWidth: priorityColor && !highlighted ? 3 : highlighted ? 2 : 1,
            borderLeftColor: highlighted ? colors.accent : priorityColor ?? undefined,
            marginBottom: spacing[1.5],
            opacity: selected ? 0.85 : 1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2.5], paddingHorizontal: spacing[3], paddingVertical: compact ? spacing[1] : spacing[2] }}>
            {selectMode ? (
              <Checkbox checked={selected} onToggle={onSelect} size={16} />
            ) : (
              <Checkbox checked={task.done} onToggle={() => onUpdate(task.id, { done: !task.done })} />
            )}
            <Pressable
              onPress={selectMode ? onSelect : onToggleExpand}
              onLongPress={!selectMode ? onLongPress : undefined}
              delayLongPress={400}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing[2.5] }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text size="sm" weight="medium" style={{
                  color: task.done ? colors.textTertiary : colors.textPrimary,
                  textDecorationLine: task.done ? "line-through" : "none",
                }}>{task.title}</Text>
                {!compact && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5], alignItems: "center" }}>
                    {task.due_date ? (
                      <Pressable
                        onPress={e => { (e as any).stopPropagation?.(); if (!selectMode) setInlineField(f => f === "due_date" ? null : "due_date"); }}
                        hitSlop={6}
                      >
                        <Text size="xs" style={{
                          color: dueDateColor,
                          textDecorationLine: inlineField === "due_date" ? "underline" : "none",
                        }}>{formatDate(task.due_date)}</Text>
                      </Pressable>
                    ) : !selectMode && !task.done ? (
                      <Pressable
                        onPress={e => { (e as any).stopPropagation?.(); setInlineField(f => f === "due_date" ? null : "due_date"); }}
                        hitSlop={6}
                      >
                        <Text size="xs" style={{ color: colors.textTertiary, opacity: 0.5 }}>+ date</Text>
                      </Pressable>
                    ) : null}
                    {subtasks.length > 0 && <Text size="xs" style={{ color: colors.textTertiary }}>{doneSubtasks}/{subtasks.length}</Text>}
                    {task.category && <CategoryBadge category={task.category} uniCourse={task.uniCourse} />}
                  </View>
                )}
              </View>
              <Pressable
                onPress={e => { (e as any).stopPropagation?.(); if (!selectMode && !task.done) setInlineField(f => f === "priority" ? null : "priority"); }}
                hitSlop={8}
                style={{ padding: 2 }}
              >
                <View style={{
                  width: 7, height: 7, borderRadius: 99,
                  backgroundColor: priorityColor ?? colors.bgBorder,
                  borderWidth: priorityColor ? 0 : 1,
                  borderColor: colors.bgBorder,
                  opacity: inlineField === "priority" ? 1 : 0.85,
                }} />
              </Pressable>
              {hovered && !selectMode && !isExpanded && (
                <View style={{ flexDirection: "row", gap: 2 }}>
                  <Pressable onPress={(e) => { e.stopPropagation?.(); onReorderUp(); }} hitSlop={6}
                    style={{ padding: 3, borderRadius: 4, backgroundColor: colors.bgTertiary }}>
                    <Text size="xs" style={{ color: colors.textTertiary }}>↑</Text>
                  </Pressable>
                  <Pressable onPress={(e) => { e.stopPropagation?.(); onReorderDown(); }} hitSlop={6}
                    style={{ padding: 3, borderRadius: 4, backgroundColor: colors.bgTertiary }}>
                    <Text size="xs" style={{ color: colors.textTertiary }}>↓</Text>
                  </Pressable>
                </View>
              )}
              {!selectMode && <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={12} color={colors.textTertiary} />}
            </Pressable>
            {!selectMode && !isExpanded && Platform.OS !== "web" && onDragStart && (
              <Pressable onLongPress={onDragStart} hitSlop={8} style={{ paddingLeft: spacing[1] }}>
                <Ionicons name="reorder-three-outline" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* Inline field editor — priority or due_date, no full expand needed */}
          {inlineField && !selectMode && !task.done && (
            <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)}>
              <Divider />
              <View style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
                {inlineField === "priority" && (
                  <PrioritySelector
                    value={task.priority}
                    onChange={p => { onUpdate(task.id, { priority: p }); setInlineField(null); }}
                  />
                )}
                {inlineField === "due_date" && (
                  <DueDateSelector
                    value={task.due_date}
                    onChange={d => { onUpdate(task.id, { due_date: d }); setInlineField(null); }}
                  />
                )}
              </View>
            </Animated.View>
          )}

          {isExpanded && !selectMode && !desktopMode && (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
              <Divider />
              <View style={{ padding: spacing[3], gap: spacing[2.5] }}>
                <TextInput
                  value={task.title}
                  onChangeText={title => onUpdate(task.id, { title })}
                  multiline
                  style={[
                    { color: colors.textPrimary, fontSize: 14, fontFamily: fontFamily.semibold, lineHeight: 20 },
                    // @ts-ignore
                    { outlineStyle: "none" },
                  ]}
                />
                <TextInput
                  value={task.description ?? ""}
                  onChangeText={description => onUpdate(task.id, { description })}
                  placeholder="Add notes…"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={2}
                  style={[
                    { color: colors.textSecondary, fontSize: 13, lineHeight: 18, minHeight: 36, textAlignVertical: "top" },
                    // @ts-ignore
                    { outlineStyle: "none" },
                  ]}
                />
                <Divider />
                <MetaRow icon="ellipse">
                  <PrioritySelector value={task.priority} onChange={priority => onUpdate(task.id, { priority })} />
                </MetaRow>
                <MetaRow icon="calendar-outline">
                  <DueDateSelector value={task.due_date} onChange={due_date => onUpdate(task.id, { due_date })} />
                </MetaRow>
                <MetaRow icon="folder-outline">
                  <CategorySelector
                    category={task.category}
                    uniCourse={task.uniCourse}
                    onChange={(category, uniCourse) => onUpdate(task.id, { category, uniCourse })}
                  />
                </MetaRow>
                <Divider />
                <View style={{ gap: spacing[2] }}>
                  <Text size="sm" weight="semibold" style={{ color: colors.textSecondary }}>
                    Subtasks{subtasks.length > 0 ? ` · ${doneSubtasks}/${subtasks.length}` : ""}
                  </Text>
                  <SubtasksList subtasks={subtasks} onChange={s => onUpdate(task.id, { subtasks: s })} />
                </View>
                <Divider />
                <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                  <Pressable onPress={onDelete}
                    style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: `${colors.danger}44`, backgroundColor: `${colors.danger}10` }}>
                    <Text size="xs" style={{ color: colors.danger }}>Delete task</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          )}
        </Surface>
      </Swipeable>
    </View>
  );
});
