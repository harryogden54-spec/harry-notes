import React from "react";
import { View, ViewProps } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing } from "@/lib/theme";

interface BadgeProps extends ViewProps {
  label: string;
  color?: string;
  variant?: "solid" | "subtle";
}

export function Badge({ label, color, variant = "subtle", style, ...props }: BadgeProps) {
  const { colors } = useTheme();
  const bg = variant === "solid"
    ? (color ?? colors.accent)
    : `${color ?? colors.accent}22`;
  const fg = variant === "solid" ? "#FFFFFF" : (color ?? colors.accent);

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.sm,
          paddingHorizontal: spacing[1.5],
          paddingVertical: spacing[0.5],
          alignSelf: "flex-start",
        },
        style,
      ]}
      {...props}
    >
      <Text size="2xs" weight="semibold" color={fg}>{label}</Text>
    </View>
  );
}
