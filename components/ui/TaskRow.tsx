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
import { spacing, radius, fontFamily, getShadow } from "@/lib/theme";
import { useTasksActions, type Task } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { getTodayStr, getTomorrowStr, formatDueDate, PRIORITY_COLOR } from "@/lib/utils";

interface Props {
  task: Task;
  /** Receives the task id rather than closing over it, so callers can pass one
   *  stable callback for every row. With a per-row arrow the memo below is
   *  worthless — the prop changes identity on every parent render. */
  onPress: (id: string) => void;
}

function RowContent({ task, onPress }: Props) {
  const { colors } = useTheme();
  const { toggleTask, updateTask } = useTasksActions();
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
      onPress={renaming ? undefined : () => onPress(task.id)}
      accessibilityLabel={`${task.title}, ${task.done ? "completed" : "incomplete"}`}
      accessibilityRole="button"
      accessibilityHint={Platform.OS !== "web" ? "Swipe right to complete, swipe left to delete" : undefined}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing[3],
        minHeight: 52,
        paddingVertical: spacing[3], paddingHorizontal: spacing[4],
        borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
        backgroundColor: task.priority === "urgent" && !task.done ? `${colors.danger}12` : colors.bgSecondary,
        opacity: task.done ? 0.45 : 1,
      }}
    >
      <Checkbox shape="circle" size={20} checked={task.done} onToggle={() => toggleTask(task.id)} accessibilityLabel={task.title} />
      {/* Priority dot beside the checkbox */}
      {priorityColor && (
        <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: priorityColor, marginLeft: -spacing[1] }} />
      )}
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
              // Must forward onPress: this inner Pressable exists only to carry
              // the rename gestures, but on react-native-web it handles the
              // click itself rather than letting it bubble to the row. Without
              // this, tapping the title — most of the row's area — did nothing,
              // so dashboard and search-result task rows could not be opened.
              onPress={renaming ? undefined : () => onPress(task.id)}
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
        <View style={{ backgroundColor: `${due.color}18`, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text size="xs" weight="medium" style={{ color: due.color, fontSize: 11.5 }}>{due.label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function WebTaskRow({ task, onPress }: Props) {
  const { colors, scheme } = useTheme();
  const { toggleTask, deleteTask } = useTasksActions();
  const { showToast } = useToast();
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleComplete(e: any) {
    e.stopPropagation?.();
    toggleTask(task.id);
    setMenuOpen(false);
  }

  function handleDelete(e: any) {
    e.stopPropagation?.();
    const undo = deleteTask(task.id);
    showToast("Task deleted", { label: "Undo", onPress: () => { undo(); } });
    setMenuOpen(false);
  }

  return (
    <View
      style={{ position: "relative" }}
      // @ts-ignore — web-only hover events
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
    >
      <RowContent task={task} onPress={onPress} />
      {hovered && !task.done && (
        <View style={{
          position: "absolute", right: spacing[3], top: "50%",
          transform: [{ translateY: -14 }],
          zIndex: 10,
        }}>
          {menuOpen ? (
            <View style={{
              flexDirection: "row", gap: spacing[1],
              backgroundColor: colors.bgSecondary,
              borderWidth: 1, borderColor: colors.bgBorder,
              borderRadius: radius.lg,
              paddingHorizontal: spacing[1.5], paddingVertical: spacing[1],
              ...getShadow("md", scheme),
            }}>
              <Pressable
                onPress={handleComplete}
                style={{
                  paddingHorizontal: spacing[2], paddingVertical: spacing[1],
                  borderRadius: radius.md,
                  backgroundColor: `${colors.accent}18`,
                }}
                accessibilityRole="button"
                accessibilityLabel="Complete task"
              >
                <Text size="xs" weight="medium" style={{ color: colors.accent }}>Complete</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                style={{
                  paddingHorizontal: spacing[2], paddingVertical: spacing[1],
                  borderRadius: radius.md,
                  backgroundColor: `${colors.danger}18`,
                }}
                accessibilityRole="button"
                accessibilityLabel="Delete task"
              >
                <Text size="xs" weight="medium" style={{ color: colors.danger }}>Delete</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); setMenuOpen(true); }}
              style={{
                width: 28, height: 28,
                borderRadius: 99,
                backgroundColor: colors.bgTertiary,
                borderWidth: 1, borderColor: colors.bgBorder,
                alignItems: "center", justifyContent: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="Task actions"
            >
              <Ionicons name="ellipsis-horizontal" size={13} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Rendered in a loop on the dashboard and in search results, so a parent
 * re-render used to rebuild every row and re-create its swipe handlers.
 * Memoised on task identity + the (now stable) onPress.
 */
export const TaskRow = React.memo(function TaskRow({ task, onPress }: Props) {
  const { colors } = useTheme();
  const { toggleTask, deleteTask } = useTasksActions();
  const { showToast } = useToast();
  const swipeRef = useRef<Swipeable | null>(null);

  // Web: hover-revealed action menu
  if (Platform.OS === "web") {
    return <WebTaskRow task={task} onPress={onPress} />;
  }

  function renderCompleteAction() {
    return (
      <View style={{ backgroundColor: colors.accent, justifyContent: "center", alignItems: "center", width: 80 }}>
        <Ionicons name="checkmark-done-outline" size={22} color={colors.textInverse} />
      </View>
    );
  }

  function renderDeleteAction() {
    return (
      <View style={{ backgroundColor: colors.danger, justifyContent: "center", alignItems: "center", width: 80 }}>
        <Ionicons name="trash-outline" size={20} color={colors.textInverse} />
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
});
