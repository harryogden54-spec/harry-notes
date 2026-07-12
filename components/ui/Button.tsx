import React from "react";
import { Pressable, PressableProps, ActivityIndicator, Platform } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing, motion } from "@/lib/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends PressableProps {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
}

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading,
  icon,
  style,
  disabled,
  accessibilityLabel,
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
    primary:   colors.textInverse,
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
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(disabled || loading) }}
      disabled={disabled || loading}
      style={(state) => {
        const pressed = state.pressed;
        // RN-web extends the state callback with hover; native never sets it.
        const hovered = (state as { hovered?: boolean }).hovered ?? false;
        const hoverBg: Record<Variant, string> = {
          primary:   colors.accentHover,
          secondary: colors.bgTertiary,
          ghost:     colors.bgTertiary,
          danger:    `${colors.danger}33`,
        };
        return {
          backgroundColor: hovered && !disabled ? hoverBg[variant] : bg[variant],
          // Primary (web): soft vertical accent gradient + 1px inner top
          // highlight — matches the card lit-edge language from getShadow.
          ...(Platform.OS === "web" && variant === "primary" && !disabled ? ({
            backgroundImage: hovered
              ? `linear-gradient(180deg, ${colors.accentHover}, ${colors.accent})`
              : `linear-gradient(180deg, ${colors.accent}, ${colors.accentHover})`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
          } as any) : {}),
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: border[variant],
          flexDirection: "row" as const,
          alignItems: "center" as const,
          justifyContent: "center" as const,
          gap: spacing[1.5],
          opacity: disabled ? 0.55 : pressed ? motion.pressOpacity : 1,
          transform: pressed ? [{ scale: motion.pressScale }] : undefined,
          ...(style as object),
          ...padding[size],
        };
      }}
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
