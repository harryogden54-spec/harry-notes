import React, { useState } from "react";
import { View, TextInput, Pressable, Platform, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Divider } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useTasks, type Task } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { MetaRow } from "./MetaRow";
import { PrioritySelector } from "./PrioritySelector";
import { DueDateSelector } from "./DueDateSelector";
import { CategorySelector } from "./CategorySelector";
import { RecurrenceSelector } from "./RecurrenceSelector";
import { SubtasksList } from "./SubtasksList";

type Props = { task: Task; onClose?: () => void };

export function TaskDetailPanel({ task, onClose }: Props) {
  const { colors } = useTheme();
  const { updateTask, deleteTask, toggleTask } = useTasks();
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const subtasks    = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter(s => s.done).length;

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    const undo = deleteTask(task.id);
    onClose?.();
    showToast("Task deleted", { label: "Undo", onPress: undo });
  }

  return (
    <ScrollView
      style={[{ flex: 1 }, Platform.OS === "web" && { scrollbarWidth: "none" } as any]}
      contentContainerStyle={{ padding: spacing[5], gap: spacing[4], paddingBottom: spacing[16] }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header: Complete + Close */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], justifyContent: "space-between" }}>
        <Pressable
          onPress={() => { toggleTask(task.id); onClose?.(); }}
          style={{
            flexDirection: "row", alignItems: "center", gap: spacing[2],
            paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
            borderRadius: radius.lg, borderWidth: 1,
            borderColor: task.done ? colors.success : colors.accent,
            backgroundColor: task.done ? `${colors.success}18` : `${colors.accent}18`,
          }}
        >
          <Ionicons
            name={task.done ? "checkmark-circle" : "checkmark-circle-outline"}
            size={18}
            color={task.done ? colors.success : colors.accent}
          />
          <Text size="xs" weight="semibold" style={{ color: task.done ? colors.success : colors.accent }}>
            {task.done ? "Completed" : "Mark done"}
          </Text>
        </Pressable>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={12}
            style={{ width: 26, height: 26, borderRadius: 99, backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close-outline" size={14} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      <TextInput
        value={task.title}
        onChangeText={title => updateTask(task.id, { title })}
        multiline
        placeholder="Task title"
        placeholderTextColor={colors.textTertiary}
        style={[
          { color: task.done ? colors.textTertiary : colors.textPrimary, fontSize: 20, fontFamily: fontFamily.bold, lineHeight: 28,
            textDecorationLine: task.done ? "line-through" : "none" },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />

      <TextInput
        value={task.description ?? ""}
        onChangeText={description => updateTask(task.id, { description })}
        placeholder="Add notes…"
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={4}
        style={[
          { color: colors.textSecondary, fontSize: 14, lineHeight: 21, minHeight: 72, textAlignVertical: "top",
            backgroundColor: colors.bgTertiary, borderRadius: radius.lg, padding: spacing[3], borderWidth: 1, borderColor: colors.bgBorder },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />

      <Divider />

      <MetaRow icon="ellipse">
        <PrioritySelector value={task.priority} onChange={priority => updateTask(task.id, { priority })} />
      </MetaRow>
      <MetaRow icon="calendar-outline">
        <DueDateSelector value={task.due_date} onChange={due_date => updateTask(task.id, { due_date })} />
      </MetaRow>
      <MetaRow icon="folder-outline">
        <CategorySelector
          category={task.category}
          uniCourse={task.uniCourse}
          onChange={(category, uniCourse) => updateTask(task.id, { category, uniCourse })}
        />
      </MetaRow>
      <MetaRow icon="refresh-outline">
        <RecurrenceSelector
          value={task.recurrence}
          onChange={recurrence => updateTask(task.id, { recurrence })}
        />
      </MetaRow>

      <Divider />

      <View style={{ gap: spacing[2] }}>
        <Text size="sm" weight="semibold" style={{ color: colors.textSecondary, letterSpacing: 0.3 }}>
          Subtasks{subtasks.length > 0 ? ` · ${doneSubtasks}/${subtasks.length}` : ""}
        </Text>
        <SubtasksList subtasks={subtasks} onChange={s => updateTask(task.id, { subtasks: s })} />
      </View>

      <Divider />

      {confirmDelete ? (
        <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "center" }}>
          <Text size="xs" style={{ color: colors.danger, flex: 1 }}>Are you sure?</Text>
          <Pressable onPress={handleDelete}
            style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, backgroundColor: colors.danger }}>
            <Text size="xs" weight="semibold" style={{ color: colors.textInverse }}>Delete</Text>
          </Pressable>
          <Pressable onPress={() => setConfirmDelete(false)}
            style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}>
            <Text size="xs" style={{ color: colors.textSecondary }}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={handleDelete}
          style={{ alignSelf: "flex-start", paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: `${colors.danger}44`, backgroundColor: `${colors.danger}10` }}>
          <Text size="xs" style={{ color: colors.danger }}>Delete task</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
