import React from "react";
import { View, ViewProps, StyleSheet, Pressable, PressableProps, Platform } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing } from "@/lib/theme";

export type CardVariant = "elevated" | "filled" | "outlined";

interface CardProps extends ViewProps {
  elevated?: boolean;
  variant?: CardVariant;
}

interface CardPressableProps extends PressableProps {
  elevated?: boolean;
  variant?: CardVariant;
}

function cardStyle(colors: ReturnType<typeof useTheme>["colors"], variant: CardVariant, isDark: boolean) {
  const base = {
    borderRadius: radius.xl,
    padding: spacing[4],
  };

  switch (variant) {
    case "elevated":
      return {
        ...base,
        backgroundColor: colors.bgSecondary,
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        // iOS shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        // Android elevation
        elevation: 3,
      };
    case "outlined":
      return {
        ...base,
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: colors.bgBorder,
      };
    case "filled":
    default:
      return {
        ...base,
        backgroundColor: colors.bgTertiary,
        borderWidth: 0,
      };
  }
}

export function Card({ elevated, variant = "elevated", style, children, ...props }: CardProps) {
  const { colors, isDark } = useTheme();
  // Legacy `elevated` prop maps to variant
  const resolvedVariant: CardVariant = elevated ? "elevated" : variant;

  return (
    <View
      style={[cardStyle(colors, resolvedVariant, isDark), style]}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardPressable({ elevated, variant = "elevated", style, children, ...props }: CardPressableProps) {
  const { colors, isDark } = useTheme();
  const resolvedVariant: CardVariant = elevated ? "elevated" : variant;
  const base = cardStyle(colors, resolvedVariant, isDark);

  return (
    <Pressable
      style={({ pressed }) => ({
        ...base,
        backgroundColor: pressed ? colors.bgTertiary : base.backgroundColor,
        ...(typeof style === "object" && style !== null && !Array.isArray(style) ? style : {}),
      })}
      {...props}
    >
      {children}
    </Pressable>
  );
}
