import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, fontFamily, typography } from "@/lib/theme";

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
      <Text style={{
        ...typography.label,
        fontFamily: fontFamily.semibold,
        color: colors.textTertiary,
        textTransform: "uppercase",
      }}>
        {label}
      </Text>
      {count !== undefined && (
        <View style={{
          backgroundColor: colors.bgTertiary,
          borderRadius: 99,
          paddingHorizontal: 6,
          paddingVertical: 1,
          marginLeft: spacing[1.5],
          borderWidth: 1,
          borderColor: colors.bgBorder,
        }}>
          <Text style={{ fontSize: 10, fontFamily: fontFamily.medium, color: colors.textTertiary }}>{count}</Text>
        </View>
      )}
      {subtitle && (
        <Text size="xs" secondary style={{ marginLeft: spacing[2] }}>{subtitle}</Text>
      )}
      <View style={{ flex: 1 }} />
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={{ fontSize: 12, color: colors.accent, fontFamily: fontFamily.medium }}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
