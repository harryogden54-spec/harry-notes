import React from "react";
import { View, Pressable } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import type { Priority } from "@/lib/TasksContext";
import { PRIORITY_CONFIG } from "./constants";

type Props = { value?: Priority; onChange: (p?: Priority) => void };

export const PrioritySelector = React.memo(function PrioritySelector({ value, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing[1.5], flexWrap: "wrap" }}>
      {(Object.entries(PRIORITY_CONFIG) as [Priority, { label: string; color: string }][]).map(([key, cfg]) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(active ? undefined : key)}
            style={{
              flexDirection: "row", alignItems: "center", gap: spacing[1],
              paddingHorizontal: spacing[2], paddingVertical: spacing[1],
              borderRadius: radius.sm, borderWidth: 1,
              borderColor: active ? cfg.color : colors.bgBorder,
              backgroundColor: active ? colors.bgTertiary : "transparent",
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: cfg.color }} />
            <Text size="xs" style={{ color: active ? cfg.color : colors.textSecondary }}>{cfg.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});
