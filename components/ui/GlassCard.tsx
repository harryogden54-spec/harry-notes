import React from "react";
import { View, Platform, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/lib/useTheme";
import { radius } from "@/lib/theme";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** BlurView intensity — higher = more frosted. Default 22. */
  intensity?: number;
}

export function GlassCard({ children, style, intensity = 22 }: GlassCardProps) {
  const { isDark } = useTheme();

  const borderColor  = isDark ? "rgba(255,255,255,0.11)" : "rgba(255,255,255,0.85)";
  const overlayColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.55)";
  const webBg        = isDark ? "rgba(22,22,22,0.92)"   : "rgba(255,255,255,0.90)";
  const br           = (style as any)?.borderRadius ?? radius.xl;

  if (Platform.OS === "web") {
    return (
      <View style={[{ borderRadius: br, borderWidth: 1, borderColor, backgroundColor: webBg, overflow: "hidden" }, style]}>
        {children}
      </View>
    );
  }

  return (
    <View style={[{ borderRadius: br, borderWidth: 1, borderColor, overflow: "hidden" }, style]}>
      <BlurView intensity={intensity} tint={isDark ? "dark" : "light"}>
        <View style={{ backgroundColor: overlayColor }}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}
