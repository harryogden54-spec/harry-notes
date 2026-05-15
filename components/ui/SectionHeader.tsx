import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, fontFamily } from "@/lib/theme";

interface Props {
  label: string;
  count?: number;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ label, count, subtitle, action }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: spacing[3] }}>
      <Text style={{
        fontSize: 17, fontFamily: fontFamily.semibold,
        color: colors.textPrimary, flex: 1, letterSpacing: -0.3,
      }}>
        {label}
        {count !== undefined ? (
          <Text style={{ fontSize: 15, fontFamily: fontFamily.regular, color: colors.textTertiary }}>
            {" "}{count}
          </Text>
        ) : null}
      </Text>
      {subtitle && <Text size="xs" secondary>{subtitle}</Text>}
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text size="sm" style={{ color: colors.accent, fontFamily: fontFamily.medium }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
