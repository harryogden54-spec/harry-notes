import React from "react";
import { Text as RNText, TextProps } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { typography, fontFamily } from "@/lib/theme";

type Size = keyof typeof typography;
type Weight = "regular" | "medium" | "semibold" | "bold";

interface Props extends TextProps {
  size?: Size;
  weight?: Weight;
  color?: string;
  secondary?: boolean;
  tertiary?: boolean;
}

const fontFamilyMap: Record<Weight, string> = {
  regular:  fontFamily.regular,
  medium:   fontFamily.medium,
  semibold: fontFamily.semibold,
  bold:     fontFamily.bold,
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
          fontFamily: fontFamilyMap[weight],
          color: textColor,
        },
        style,
      ]}
      {...props}
    />
  );
}
