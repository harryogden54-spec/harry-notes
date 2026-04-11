import React from "react";
import { View, Platform, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/lib/useTheme";
import { radius } from "@/lib/theme";
import type { CardVariant } from "./Card";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** BlurView intensity — higher = more frosted. Default 22. */
  intensity?: number;
  /** M3 card variant — affects border and shadow. Default "elevated". */
  variant?: CardVariant;
}

export function GlassCard({ children, style, intensity = 22, variant = "elevated" }: GlassCardProps) {
  const { isDark } = useTheme();

  const borderColor  = isDark ? "rgba(255,255,255,0.11)" : "rgba(255,255,255,0.85)";
  const overlayColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.55)";
  const webBg        = isDark ? "rgba(22,22,22,0.92)"   : "rgba(255,255,255,0.90)";
  const br           = (style as any)?.borderRadius ?? radius.xl;

  const outlinedBorder = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";
  const resolvedBorder = variant === "outlined" ? outlinedBorder : borderColor;

  const elevationStyle: ViewStyle = variant === "elevated" ? {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  } : {};

  if (Platform.OS === "web") {
    return (
      <View style={[
        {
          borderRadius: br,
          borderWidth: variant === "filled" ? 0 : 1,
          borderColor: resolvedBorder,
          backgroundColor: variant === "filled" ? (isDark ? "rgba(22,22,22,0.97)" : "rgba(255,255,255,0.98)") : webBg,
          overflow: "hidden",
        },
        style,
      ]}>
        {children}
      </View>
    );
  }

  return (
    <View style={[
      {
        borderRadius: br,
        borderWidth: variant === "filled" ? 0 : 1,
        borderColor: resolvedBorder,
        overflow: "hidden",
      },
      elevationStyle,
      style,
    ]}>
      <BlurView intensity={intensity} tint={isDark ? "dark" : "light"}>
        <View style={{ backgroundColor: overlayColor }}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}
