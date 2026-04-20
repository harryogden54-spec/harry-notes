import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";

// Per-theme gradient stops — 3-stop diagonal for richer depth
const GRADIENTS: Record<string, {
  dark:  [string, string, string];
  light: [string, string, string];
  glow:  string; // accent blob colour (very low opacity applied below)
}> = {
  default:   {
    dark:  ["#07070F", "#0D0D0D", "#0A0A12"],
    light: ["#F0F0F8", "#FFFFFF", "#F5F5FF"],
    glow:  "#5B6AD0",
  },
  nord:      {
    dark:  ["#252A38", "#2E3440", "#283040"],
    light: ["#D8E0EE", "#ECEFF4", "#E0E8F6"],
    glow:  "#88C0D0",
  },
  warmEarth: {
    dark:  ["#150E06", "#1C1410", "#1A1208"],
    light: ["#EDE5D6", "#F5F0E8", "#F0EAE0"],
    glow:  "#D2B48C",
  },
  slate:     {
    dark:  ["#171D24", "#1E2329", "#1A2030"],
    light: ["#E8EEF5", "#F7F9FC", "#EEF3F9"],
    glow:  "#4A90D9",
  },
};

export function GradientBackground({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  const { themeId } = useThemeContext();

  const entry = GRADIENTS[themeId] ?? GRADIENTS.default;
  const stops = isDark ? entry.dark : entry.light;
  const glowColor = entry.glow;

  return (
    <View style={{ flex: 1 }}>
      {/* Base gradient — diagonal top-left → bottom-right */}
      <LinearGradient
        colors={stops}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Accent glow blob — top-right corner, web-only blur */}
      {Platform.OS === "web" ? (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              // @ts-ignore — web CSS
              background: `radial-gradient(ellipse 55% 40% at 85% 8%, ${glowColor}${isDark ? "18" : "10"} 0%, transparent 70%)`,
              pointerEvents: "none",
            },
          ]}
        />
      ) : (
        // Native: second LinearGradient layer gives a subtle tinted corner
        <LinearGradient
          colors={[`${glowColor}12`, "transparent"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.3, y: 0.5 }}
        />
      )}

      {children}
    </View>
  );
}
