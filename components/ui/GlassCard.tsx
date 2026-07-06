import React from "react";
import { View, Platform, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/lib/useTheme";
import { radius, getShadow } from "@/lib/theme";

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

  const br = (style as any)?.borderRadius ?? radius["2xl"];

  const borderColor = isDark
    ? (Platform.OS === "web" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.10)")
    : "rgba(0,0,0,0.08)";

  const overlayColor = isDark
    ? "rgba(255,255,255,0.04)"
    : "rgba(0,0,0,0.03)";

  // Glass is the overlay surface: content cards get "sm" (the design's soft
  // 0-2-8 language — "md" was tuned when web shadows silently never rendered),
  // true overlays (modals, palettes) get "overlay", insets sit flush.
  const scheme = isDark ? "dark" : "light";
  const insetBorder: ViewStyle = {
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  };

  const shadowStyle: ViewStyle =
    variant === "elevated" ? getShadow("overlay", scheme)
    : variant === "inset"  ? {}
    : getShadow("sm", scheme);
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
          // @ts-ignore — web-only CSS properties (shadow comes from shadowStyle
          // via RN-web's box-shadow conversion, so it stays on the token scale)
          { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" },
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
