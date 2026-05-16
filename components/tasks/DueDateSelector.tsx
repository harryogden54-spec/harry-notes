import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text, DatePicker } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { getTodayStr, getTomorrowStr, getNextWeekStr } from "@/lib/utils";
import { Chip } from "./Chip";
import { formatDate } from "./constants";

type Props = { value?: string; onChange: (d?: string) => void };

export function DueDateSelector({ value, onChange }: Props) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();
  const nextWeek = getNextWeekStr();
  const dueDateColor = value && value < today ? colors.danger : value === today ? colors.warning : colors.accent;
  const presets = [
    { label: "Today",     date: today },
    { label: "Tomorrow",  date: tomorrow },
    { label: "Next week", date: nextWeek },
  ];
  return (
    <View style={{ gap: spacing[1.5] }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5], alignItems: "center" }}>
        {value ? (
          <>
            <Chip label={formatDate(value)} color={dueDateColor} onRemove={() => { onChange(undefined); setShowPicker(false); }} />
            <Pressable onPress={() => setShowPicker(v => !v)}>
              <Text size="xs" style={{ color: colors.textTertiary }}>Change</Text>
            </Pressable>
          </>
        ) : (
          <>
            {presets.map(p => (
              <Pressable key={p.date} onPress={() => onChange(p.date)}
                style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}>
                <Text size="xs" style={{ color: colors.textSecondary }}>{p.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setShowPicker(v => !v)}>
              <Text size="xs" style={{ color: colors.textTertiary }}>Pick date…</Text>
            </Pressable>
          </>
        )}
      </View>
      {showPicker && <DatePicker value={value} onChange={(d) => { onChange(d); setShowPicker(false); }} />}
    </View>
  );
}
