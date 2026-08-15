import React from "react";
import { View, ViewProps, StyleSheet, Pressable, PressableProps, Platform } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing, motion, type ShadowLevel } from "@/lib/theme";

export type CardVariant = "elevated" | "filled" | "outlined";

interface CardProps extends ViewProps {
  elevated?: boolean;
  variant?: CardVariant;
}

interface CardPressableProps extends PressableProps {
  elevated?: boolean;
  variant?: CardVariant;
}

type ShadowFn = (level: ShadowLevel) => Record<string, unknown>;

function cardStyle(colors: ReturnType<typeof useTheme>["colors"], variant: CardVariant, shadow: ShadowFn) {
  const base = {
    borderRadius: radius["2xl"],
    padding: spacing[5],
  };

  switch (variant) {
    case "elevated":
      return {
        ...base,
        backgroundColor: colors.bgSecondary,
        // Atelier content-card treatment: hairline border + soft "sm" shadow.
        // Via useTheme's bound helper, so a border-led theme (Nord, Void) stays
        // flat and Ember's shadow stays warm — the raw getShadow(level, scheme)
        // form this used cannot see the theme's material and gave every theme
        // Obsidian's neutral cast.
        borderWidth: 1,
        borderColor: colors.bgBorder,
        ...shadow("sm"),
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
  const { colors, shadow } = useTheme();
  // Legacy `elevated` prop maps to variant
  const resolvedVariant: CardVariant = elevated ? "elevated" : variant;

  return (
    <View
      style={[cardStyle(colors, resolvedVariant, shadow), style]}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardPressable({ elevated, variant = "elevated", style, children, ...props }: CardPressableProps) {
  const { colors, shadow } = useTheme();
  const resolvedVariant: CardVariant = elevated ? "elevated" : variant;
  const base = cardStyle(colors, resolvedVariant, shadow);

  return (
    <Pressable
      accessibilityRole="button"
      style={(state) => {
        const pressed = state.pressed;
        const hovered = (state as { hovered?: boolean }).hovered ?? false;
        return {
          ...base,
          backgroundColor: pressed || hovered ? colors.bgTertiary : base.backgroundColor,
          transform: pressed ? [{ scale: motion.pressScale }] : undefined,
          ...(typeof style === "object" && style !== null && !Array.isArray(style) ? style : {}),
        };
      }}
      {...props}
    >
      {children}
    </Pressable>
  );
}
