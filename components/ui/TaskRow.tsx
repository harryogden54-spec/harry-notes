import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Platform, TextInput } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
} from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "./Text";
import { Checkbox } from "./Checkbox";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useTasks, type Task } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { getTodayStr, getTomorrowStr, formatDueDate, PRIORITY_COLOR } from "@/lib/utils";

interface Props {
  task: Task;
  onPress: () => void;
}

function RowContent({ task, onPress }: Props) {
  const { colors } = useTheme();
  const { toggleTask, updateTask } = useTasks();
  const { showToast } = useToast();
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();
  const priorityColor = task.priority ? PRIORITY_COLOR[task.priority] : undefined;
  const due           = task.due_date ? formatDueDate(task.due_date, today, tomorrow, colors.danger, colors.accent) : null;
  const isOverdue     = !task.done && !!task.due_date && task.due_date < today;

  const [renaming, setRenaming]     = useState(false);
  const [renameText, setRenameText] = useState(task.title);
  const renameRef = useRef<TextInput | null>(null);

  useEffect(() => { setRenameText(task.title); }, [task.title]);

  function startRename() {
    setRenameText(task.title);
    setRenaming(true);
    setTimeout(() => renameRef.current?.focus(), 50);
  }

  function commitRename() {
    setRenaming(false);
    const trimmed = renameText.trim();
    if (trimmed && trimmed !== task.title) {
      try { updateTask(task.id, { title: trimmed }); }
      catch { showToast("Failed to rename task"); setRenameText(task.title); }
    } else if (!trimmed) {
      setRenameText(task.title);
    }
  }

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
      onPress={renaming ? undefined : onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing[3],
        minHeight: 52,
        paddingVertical: spacing[3], paddingHorizontal: spacing[4],
        paddingLeft: priorityColor ? spacing[4] + 3 : spacing[4],
        borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
        backgroundColor: colors.bgSecondary,
        opacity: task.done ? 0.45 : 1,
      }}
    >
      {/* Priority left-border strip */}
      {priorityColor && (
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: priorityColor }} />
      )}
      <Checkbox checked={task.done} onToggle={() => toggleTask(task.id)} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ position: "relative" }}>
          {renaming ? (
            <TextInput
              ref={renameRef}
              value={renameText}
              onChangeText={setRenameText}
              onBlur={commitRename}
              onSubmitEditing={commitRename}
              // @ts-ignore
              onKeyPress={(e: any) => { if (e.nativeEvent.key === "Escape") { setRenaming(false); setRenameText(task.title); } }}
              style={[
                { fontSize: 13, fontFamily: fontFamily.medium, color: colors.textPrimary, padding: 0 },
                // @ts-ignore
                { outlineStyle: "none" },
              ]}
            />
          ) : (
            <Pressable
              onLongPress={startRename}
              // @ts-ignore
              onDoubleClick={Platform.OS === "web" ? startRename : undefined}
              style={{ flex: 1 }}
            >
              <Text size="sm" weight={task.done ? "regular" : "medium"} numberOfLines={1}
                style={{ color: isOverdue && !task.done ? colors.danger : colors.textPrimary }}>
                {task.title}
              </Text>
              <Animated.View style={[{
                position: "absolute", left: 0, right: 0, top: "50%", height: 1,
                backgroundColor: colors.textTertiary,
                // @ts-ignore
                transformOrigin: "left center",
              }, strikeStyle]} />
            </Pressable>
          )}
        </View>
        {(task.tags ?? []).length > 0 && (
          <View style={{ flexDirection: "row", gap: spacing[1] }}>
            {(task.tags ?? []).slice(0, 3).map(tag => (
              <Text key={tag} size="xs" style={{ color: colors.textTertiary }}>#{tag}</Text>
            ))}
          </View>
        )}
      </View>
      {due && (
        <View style={{ backgroundColor: `${due.color}18`, borderRadius: radius.md, paddingHorizontal: spacing[2], paddingVertical: 3, borderWidth: 1, borderColor: `${due.color}40` }}>
          <Text size="xs" weight="medium" style={{ color: due.color }}>{due.label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function TaskRow({ task, onPress }: Props) {
  const { colors } = useTheme();
  const { toggleTask, deleteTask } = useTasks();
  const { showToast } = useToast();
  const swipeRef = useRef<Swipeable | null>(null);

  // Web: no swipe, render directly
  if (Platform.OS === "web") {
    return <RowContent task={task} onPress={onPress} />;
  }

  function renderCompleteAction() {
    return (
      <View style={{ backgroundColor: colors.accent, justifyContent: "center", alignItems: "center", width: 80 }}>
        <Ionicons name="checkmark-done-outline" size={22} color="#fff" />
      </View>
    );
  }

  function renderDeleteAction() {
    return (
      <View style={{ backgroundColor: colors.danger, justifyContent: "center", alignItems: "center", width: 80 }}>
        <Ionicons name="trash-outline" size={20} color="#fff" />
      </View>
    );
  }

  function handleCompleteSwipe() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleTask(task.id);
    swipeRef.current?.close();
  }

  function handleDeleteSwipe() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const undo = deleteTask(task.id);
    showToast("Task deleted", { label: "Undo", onPress: () => { undo(); } });
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderCompleteAction}
      renderRightActions={renderDeleteAction}
      onSwipeableLeftOpen={handleCompleteSwipe}
      onSwipeableRightOpen={handleDeleteSwipe}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
    >
      <RowContent task={task} onPress={onPress} />
    </Swipeable>
  );
}
