import React from "react";
import { View, ViewProps, StyleSheet, Pressable, PressableProps } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing } from "@/lib/theme";

interface CardProps extends ViewProps {
  elevated?: boolean;
}

interface CardPressableProps extends PressableProps {
  elevated?: boolean;
}

export function Card({ elevated, style, children, ...props }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: elevated ? colors.bgTertiary : colors.bgSecondary,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.bgBorder,
          padding: spacing[4],
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardPressable({ elevated, style, children, ...props }: CardPressableProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? colors.bgTertiary
          : elevated ? colors.bgTertiary : colors.bgSecondary,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.bgBorder,
        padding: spacing[4],
        ...(style as object),
      })}
      {...props}
    >
      {children}
    </Pressable>
  );
}
