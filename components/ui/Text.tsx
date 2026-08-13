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

/**
 * Roles that are mostly numbers — counts, dates, timers, progress. Inter's
 * default figures are proportional, so a "1" is narrower than a "7" and a
 * ticking timer or a changing count visibly jitters, shifting everything after
 * it. Tabular figures are fixed-width, so those stay put.
 *
 * Prose keeps proportional figures: tabular ones are slightly wider and look
 * mechanical mid-sentence, which is exactly where they don't belong.
 */
const TABULAR_ROLES: ReadonlySet<Size> = new Set<Size>(["meta", "label"]);

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
          ...(TABULAR_ROLES.has(size) ? { fontVariant: ["tabular-nums" as const] } : {}),
        },
        style,
      ]}
      {...props}
    />
  );
}
