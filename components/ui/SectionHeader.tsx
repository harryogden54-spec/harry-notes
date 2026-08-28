import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, shape } from "@/lib/theme";

interface Props {
  label: string;
  count?: number;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ label, count, subtitle, action }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[3] }}>
      <Text size="label" weight="semibold" tertiary style={{ textTransform: "uppercase" }}>
        {label}
      </Text>
      {count !== undefined && (
        <View style={{
          backgroundColor: colors.bgTertiary,
          ...shape.countPill,
          marginLeft: spacing[1.5],
          borderWidth: 1,
          borderColor: colors.bgBorder,
        }}>
          <Text size="meta" weight="medium" tertiary>{count}</Text>
        </View>
      )}
      {subtitle && (
        <Text size="xs" secondary style={{ marginLeft: spacing[2] }}>{subtitle}</Text>
      )}
      <View style={{ flex: 1 }} />
      {action && (
        <Pressable style={{ margin: -8, padding: 8 } as any} onPress={action.onPress} hitSlop={8}>
          <Text size="xs" weight="medium" color={colors.accent}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
