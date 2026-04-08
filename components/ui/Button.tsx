import React from "react";
import { Pressable, PressableProps, ActivityIndicator, View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing } from "@/lib/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends PressableProps {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading,
  icon,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();

  const bg: Record<Variant, string> = {
    primary:   colors.accent,
    secondary: colors.bgSecondary,
    ghost:     "transparent",
    danger:    `${colors.danger}22`,
  };

  const fg: Record<Variant, string> = {
    primary:   "#FFFFFF",
    secondary: colors.textPrimary,
    ghost:     colors.textSecondary,
    danger:    colors.danger,
  };

  const border: Record<Variant, string> = {
    primary:   "transparent",
    secondary: colors.bgBorder,
    ghost:     "transparent",
    danger:    `${colors.danger}44`,
  };

  const padding: Record<Size, { paddingVertical: number; paddingHorizontal: number }> = {
    sm: { paddingVertical: spacing[1.5], paddingHorizontal: spacing[3] },
    md: { paddingVertical: spacing[2],   paddingHorizontal: spacing[4] },
    lg: { paddingVertical: spacing[3],   paddingHorizontal: spacing[6] },
  };

  const textSize: Record<Size, "sm" | "base" | "lg"> = {
    sm: "sm",
    md: "base",
    lg: "lg",
  };

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: bg[variant],
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: border[variant],
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: spacing[1.5],
        opacity: pressed || disabled ? 0.65 : 1,
        ...(style as object),
        ...padding[size],
      })}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg[variant]} />
      ) : (
        <>
          {icon}
          <Text size={textSize[size]} weight="medium" color={fg[variant]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
