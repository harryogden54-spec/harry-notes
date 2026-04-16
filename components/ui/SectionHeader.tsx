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
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[3] }}>
      <Text style={{
        fontSize: 11, letterSpacing: 1.2,
        color: colors.textSecondary, fontFamily: fontFamily.semibold,
        textTransform: "uppercase", flex: 1,
      }}>
        {label}{count !== undefined ? ` · ${count}` : ""}
      </Text>
      {subtitle && <Text size="xs" secondary>{subtitle}</Text>}
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text size="xs" style={{ color: colors.accent }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
