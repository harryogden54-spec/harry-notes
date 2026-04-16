import React from "react";
import { View, Platform, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/lib/useTheme";
import { radius } from "@/lib/theme";

export type GlassVariant = "default" | "elevated" | "inset";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** BlurView intensity — higher = more frosted. Default 20. */
  intensity?: number;
  /** Card variant — affects shadow and border. Default "default". */
  variant?: GlassVariant;
  /** @deprecated use variant instead — kept for backward-compat */
  [key: string]: any;
}

export function GlassCard({ children, style, intensity = 20, variant = "default", ...rest }: GlassCardProps) {
  const { isDark, colors } = useTheme();

  const br = (style as any)?.borderRadius ?? radius.xl;

  const borderColor = isDark
    ? (Platform.OS === "web" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.10)")
    : "rgba(255,255,255,0.80)";

  const overlayColor = isDark
    ? "rgba(255,255,255,0.04)"
    : "rgba(255,255,255,0.50)";

  const elevatedShadow: ViewStyle = {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  };

  const defaultShadow: ViewStyle = {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  };

  const insetBorder: ViewStyle = {
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  };

  const shadowStyle = variant === "elevated" ? elevatedShadow : variant === "inset" ? {} : defaultShadow;
  const variantBorder = variant === "inset" ? insetBorder : {};

  if (Platform.OS === "web") {
    const webBg = isDark ? "rgba(30,35,48,0.72)" : "rgba(255,255,255,0.72)";
    return (
      <View
        {...rest}
        style={[
          {
            borderRadius: br,
            borderWidth: 1,
            borderColor,
            overflow: "hidden",
            backgroundColor: webBg,
          },
          shadowStyle,
          variantBorder,
          style,
          // @ts-ignore — web-only CSS properties
          { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" },
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      {...rest}
      style={[
        {
          borderRadius: br,
          borderWidth: 1,
          borderColor,
          overflow: "hidden",
        },
        shadowStyle,
        variantBorder,
        style,
      ]}
    >
      <BlurView intensity={intensity} tint={isDark ? "dark" : "light"} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: overlayColor }}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}
