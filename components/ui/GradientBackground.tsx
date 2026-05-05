import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";

export function GradientBackground({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { bgStyle } = useThemeContext();

  const accent = colors.accent;
  const bg     = colors.bgPrimary;

  if (bgStyle === "gradient") {
    return (
      <LinearGradient
        colors={[`${accent}10`, bg, bg]}
        style={{ flex: 1 }}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {children}
      </LinearGradient>
    );
  }

  if (bgStyle === "blur") {
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        <View
          pointerEvents="none"
          style={{ position: "absolute", inset: 0, backgroundColor: `${accent}07` } as any}
        />
        {children}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {children}
    </View>
  );
}
