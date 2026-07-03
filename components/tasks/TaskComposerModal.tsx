import React, { useState, useRef, useEffect } from "react";
import { View, TextInput, Pressable, Platform, Modal, ScrollView } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Divider } from "@/components/ui";
import { spacing, radius, fontFamily, getShadow } from "@/lib/theme";
import { useTasksActions, type Task } from "@/lib/TasksContext";
import { MetaRow } from "./MetaRow";
import { DueDateSelector } from "./DueDateSelector";
import { CategorySelector } from "./CategorySelector";
import { PrioritySelector } from "./PrioritySelector";
import { SubtasksList } from "./SubtasksList";

type FormProps = {
  initialTitle?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
};

/**
 * Fields-only task creation form matching the Claude Design "New task"
 * modal (title, description, due date, category+course, priority,
 * subtasks). Self-sufficient — creates the task itself via
 * useTasksActions rather than taking an onAdd callback, so it can be
 * embedded both in a standalone modal (TaskComposerModal) and inside
 * the command palette (QuickAddModal).
 */
export function TaskComposerForm({ initialTitle = "", onClose, onCreated }: FormProps) {
  const { colors } = useTheme();
  const { addTask, updateTask } = useTasksActions();
  const [title, setTitle]             = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate]         = useState<string | undefined>();
  const [category, setCategory]       = useState<Task["category"]>();
  const [uniCourse, setUniCourse]     = useState<Task["uniCourse"]>();
  const [priority, setPriority]       = useState<Task["priority"]>();
  const [subtasks, setSubtasks]       = useState<NonNullable<Task["subtasks"]>>([]);
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  function submit() {
    const t = title.trim();
    if (!t) return;
    const id = addTask(t, dueDate);
    updateTask(id, {
      description: description.trim() || undefined,
      category,
      uniCourse: category === "uni" ? uniCourse : undefined,
      priority,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
    });
    onCreated?.(id);
    onClose();
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <Text size="base" weight="semibold" style={{ flex: 1 }}>New task</Text>
        <Pressable onPress={onClose} hitSlop={12}
          style={{ width: 24, height: 24, borderRadius: 99, backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="close-outline" size={14} color={colors.textTertiary} />
        </Pressable>
      </View>

      <TextInput
        ref={inputRef}
        value={title}
        onChangeText={setTitle}
        placeholder="Task title"
        placeholderTextColor={colors.textTertiary}
        returnKeyType="next"
        style={[
          { color: colors.textPrimary, fontSize: 16, fontFamily: fontFamily.medium, paddingVertical: spacing[3], paddingHorizontal: spacing[3], backgroundColor: colors.bgTertiary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Add description…"
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={2}
        style={[
          { color: colors.textSecondary, fontSize: 13, lineHeight: 18, minHeight: 44, textAlignVertical: "top", paddingVertical: spacing[2.5], paddingHorizontal: spacing[3], backgroundColor: colors.bgTertiary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />

      <Divider />

      <MetaRowLabel label="Due date">
        <DueDateSelector value={dueDate} onChange={setDueDate} />
      </MetaRowLabel>

      <MetaRowLabel label="Category">
        <CategorySelector category={category} uniCourse={uniCourse} onChange={(c, u) => { setCategory(c); setUniCourse(u); }} />
      </MetaRowLabel>

      <MetaRowLabel label="Priority">
        <PrioritySelector value={priority} onChange={setPriority} />
      </MetaRowLabel>

      <Divider />

      <View style={{ gap: spacing[2] }}>
        <Text size="sm" weight="semibold" style={{ color: colors.textSecondary }}>
          Subtasks{subtasks.length > 0 ? ` · ${subtasks.length}` : ""}
        </Text>
        <SubtasksList subtasks={subtasks} onChange={setSubtasks} />
      </View>

      <View style={{ flexDirection: "row", gap: spacing[2], justifyContent: "flex-end" }}>
        <Pressable onPress={onClose}
          style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2.5], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder }}>
          <Text size="sm" style={{ color: colors.textSecondary }}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submit}
          style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2.5], borderRadius: radius.lg, backgroundColor: title.trim() ? colors.accent : colors.bgTertiary }}>
          <Text size="sm" weight="semibold" style={{ color: title.trim() ? colors.textInverse : colors.textTertiary }}>Add task</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MetaRowLabel({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing[1.5] }}>
      <Text size="xs" weight="semibold" style={{ color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
      {children}
    </View>
  );
}

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  initialTitle?: string;
  onCreated?: (id: string) => void;
};

/** Standalone popup wrapper around TaskComposerForm — design 1b "New task" modal. */
export function TaskComposerModal({ visible, onClose, initialTitle, onCreated }: ModalProps) {
  const { colors, scheme } = useTheme();
  if (!visible) return null;

  const content = (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-start", paddingTop: Platform.OS === "web" ? 80 : 60 }}>
      <Pressable onPress={onClose} style={{ position: "absolute", inset: 0 } as any} />
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={{
          backgroundColor: colors.bgSecondary, borderRadius: radius["2xl"],
          borderWidth: 1, borderColor: colors.bgBorder,
          width: "90%" as any, maxWidth: 480,
          ...getShadow("overlay", scheme),
          maxHeight: Platform.OS === "web" ? "85vh" as any : 620,
        }}
      >
        <ScrollView contentContainerStyle={{ padding: spacing[5] }} keyboardShouldPersistTaps="handled">
          <TaskComposerForm initialTitle={initialTitle} onClose={onClose} onCreated={onCreated} />
        </ScrollView>
      </Animated.View>
    </View>
  );

  if (Platform.OS === "web") {
    return <View style={{ position: "absolute", inset: 0, zIndex: 100 } as any}>{content}</View>;
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {content}
    </Modal>
  );
}
