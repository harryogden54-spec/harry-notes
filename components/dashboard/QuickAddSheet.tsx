import React, { useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";
import { getTodayStr, getTomorrowStr } from "@/lib/utils";

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, dueDate?: string) => void;
}

export function QuickAddSheet({ visible, onClose, onAdd }: Props) {
  const { colors } = useTheme();
  const [title, setTitle]         = useState("");
  const [quickDate, setQuickDate] = useState<"today" | "tomorrow" | "none">("none");
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();

  function submit() {
    const t = title.trim();
    if (!t) return;
    const due = quickDate === "today" ? today : quickDate === "tomorrow" ? tomorrow : undefined;
    onAdd(t, due);
    setTitle("");
    setQuickDate("none");
    onClose();
  }

  if (!visible) return null;

  return (
    <View style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      backgroundColor: colors.bgSecondary,
      borderTopWidth: 1, borderTopColor: colors.bgBorder,
      borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"],
      padding: spacing[5],
      gap: spacing[4],
    }}>
      <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: colors.bgBorder, alignSelf: "center", marginBottom: spacing[1] }} />
      <Text size="base" weight="semibold">Quick add task</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        placeholder="Task title…"
        placeholderTextColor={colors.textTertiary}
        autoFocus
        returnKeyType="done"
        style={[
          {
            color: colors.textPrimary, fontSize: 15,
            paddingVertical: spacing[3], paddingHorizontal: spacing[3],
            backgroundColor: colors.bgTertiary, borderRadius: radius.lg,
            borderWidth: 1, borderColor: colors.bgBorder,
          },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        {(["none", "today", "tomorrow"] as const).map(opt => {
          const label = opt === "none" ? "No date" : opt === "today" ? "Today" : "Tomorrow";
          const active = quickDate === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => setQuickDate(opt)}
              style={{
                paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
                borderRadius: radius.xl, borderWidth: 1,
                borderColor: active ? colors.accent : colors.bgBorder,
                backgroundColor: active ? `${colors.accent}18` : "transparent",
              }}
            >
              <Text size="xs" weight={active ? "semibold" : undefined} style={{ color: active ? colors.accent : colors.textSecondary }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={submit}
        style={{
          backgroundColor: title.trim() ? colors.accent : colors.bgTertiary,
          borderRadius: radius.lg, paddingVertical: spacing[3],
          alignItems: "center",
        }}
      >
        <Text size="sm" weight="semibold" style={{ color: title.trim() ? "#fff" : colors.textTertiary }}>
          Add task
        </Text>
      </Pressable>
    </View>
  );
}
