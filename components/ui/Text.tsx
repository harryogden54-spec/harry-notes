import React from "react";
import { Text as RNText, TextProps, StyleSheet } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { typography } from "@/lib/theme";

type Size = keyof typeof typography;
type Weight = "regular" | "medium" | "semibold" | "bold";

interface Props extends TextProps {
  size?: Size;
  weight?: Weight;
  color?: string;
  secondary?: boolean;
  tertiary?: boolean;
}

const fontWeightMap: Record<Weight, "400" | "500" | "600" | "700"> = {
  regular:  "400",
  medium:   "500",
  semibold: "600",
  bold:     "700",
};

export function Text({
  size = "base",
  weight = "regular",
  color,
  secondary,
  tertiary,
  style,
  ...props
}: Props) {
  const { colors } = useTheme();

  const textColor = color
    ?? (tertiary ? colors.textTertiary : secondary ? colors.textSecondary : colors.textPrimary);

  return (
    <RNText
      style={[
        {
          ...typography[size],
          fontWeight: fontWeightMap[weight],
          color: textColor,
        },
        style,
      ]}
      {...props}
    />
  );
}
