import React, { useState } from "react";
import { View, TextInput, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import type { Task } from "@/lib/TasksContext";

type Props = {
  subtasks: Task["subtasks"];
  onChange: (s: NonNullable<Task["subtasks"]>) => void;
};

export function SubtasksList({ subtasks, onChange }: Props) {
  const { colors } = useTheme();
  const [input, setInput] = useState("");
  const list = subtasks ?? [];

  function addSubtask() {
    const title = input.trim();
    if (!title) return;
    onChange([...list, { id: `${Date.now()}`, title, done: false }]);
    setInput("");
  }

  return (
    <View style={{ gap: spacing[1.5] }}>
      {list.map(sub => (
        <View key={sub.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
          <Checkbox
            checked={sub.done}
            onToggle={() => onChange(list.map(s => s.id === sub.id ? { ...s, done: !s.done } : s))}
            size={15}
          />
          <Text size="sm" style={{
            flex: 1,
            color: sub.done ? colors.textTertiary : colors.textSecondary,
            textDecorationLine: sub.done ? "line-through" : "none",
          }}>
            {sub.title}
          </Text>
          <Pressable onPress={() => onChange(list.filter(s => s.id !== sub.id))} hitSlop={8}>
            <Ionicons name="close-outline" size={14} color={colors.textTertiary} />
          </Pressable>
        </View>
      ))}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: spacing[2],
        marginTop: spacing[1],
        backgroundColor: colors.bgTertiary,
        borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.bgBorder,
        paddingHorizontal: spacing[2.5], paddingVertical: spacing[1.5],
      }}>
        <View style={{ width: 15, height: 15, borderRadius: 4, borderWidth: 1.5, borderColor: colors.bgBorder }} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Add subtask…"
          placeholderTextColor={colors.textTertiary}
          onSubmitEditing={addSubtask}
          style={[
            { flex: 1, color: colors.textPrimary, fontSize: 13, paddingVertical: 0 },
            // @ts-ignore
            { outlineStyle: "none" },
          ]}
        />
        {input.length > 0 && (
          <Pressable onPress={addSubtask} hitSlop={8}>
            <Text size="xs" style={{ color: colors.accent }} weight="medium">Add</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
