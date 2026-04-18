import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";

// Per-theme gradient stops
const GRADIENTS: Record<string, { dark: [string, string]; light: [string, string] }> = {
  nord:      { dark: ["#1a1f2e", "#2E3440"], light: ["#dce4f0", "#ECEFF4"] },
  warmEarth: { dark: ["#1a1208", "#1C2B1E"], light: ["#ede4d6", "#F5F0E8"] },
  slate:     { dark: ["#141920", "#1E2329"], light: ["#e8eef5", "#F7F9FC"] },
  default:   { dark: ["#060608", "#0D0D0D"], light: ["#f5f5f5", "#FFFFFF"] },
};

export function GradientBackground({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  const { themeId } = useThemeContext();

  const entry = GRADIENTS[themeId] ?? GRADIENTS.default;
  const [from, to] = isDark ? entry.dark : entry.light;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[from, to]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
{children}
    </View>
  );
}
