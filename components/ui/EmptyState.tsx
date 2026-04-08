import React from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";

const ILLUSTRATIONS: Record<string, string[]> = {
  tasks: [
    "  ╭─────────╮  ",
    "  │  ✓ · · │  ",
    "  │  · · · │  ",
    "  │  · · · │  ",
    "  ╰─────────╯  ",
  ],
  lists: [
    "  ╭─────────╮  ",
    "  │ ≡ ····· │  ",
    "  │ ≡ ····· │  ",
    "  │ ≡ ····· │  ",
    "  ╰─────────╯  ",
  ],
  calendar: [
    "  ╭─────────╮  ",
    "  │ Su Mo Tu│  ",
    "  │  ·  ·  ·│  ",
    "  │  ·  ·  ·│  ",
    "  ╰─────────╯  ",
  ],
  notes: [
    "  ╭─────────╮  ",
    "  │ ········│  ",
    "  │ ····    │  ",
    "  │ ········│  ",
    "  ╰─────────╯  ",
  ],
  search: [
    "     ╭───╮     ",
    "     │ ◎ │     ",
    "     ╰───╯     ",
    "       │       ",
    "      ╱        ",
  ],
};

interface EmptyStateProps {
  type: keyof typeof ILLUSTRATIONS;
  title: string;
  subtitle?: string;
}

export function EmptyState({ type, title, subtitle }: EmptyStateProps) {
  const { colors } = useTheme();
  const lines = ILLUSTRATIONS[type] ?? ILLUSTRATIONS.notes;

  return (
    <View style={{
      alignItems: "center",
      paddingVertical: spacing[10],
      paddingHorizontal: spacing[6],
      gap: spacing[3],
    }}>
      <View style={{
        backgroundColor: colors.bgTertiary,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.bgBorder,
        paddingVertical: spacing[4],
        paddingHorizontal: spacing[2],
        marginBottom: spacing[1],
      }}>
        {lines.map((line, i) => (
          <Text key={i} size="xs" style={{
            color: colors.textTertiary,
            fontFamily: "Courier",
            letterSpacing: 1,
            lineHeight: 18,
          }}>
            {line}
          </Text>
        ))}
      </View>
      <Text size="base" weight="semibold" style={{ color: colors.textPrimary }}>
        {title}
      </Text>
      {subtitle && (
        <Text size="sm" secondary style={{ textAlign: "center", lineHeight: 20 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}
