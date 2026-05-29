import React from "react";
import { Platform, View } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";

/**
 * Full-screen background that always renders a per-theme radial gradient on web
 * and a flat bgPrimary on native (adding expo-linear-gradient is a future option).
 *
 * Every theme gets a gradient accent glow — the old solid/noise/geometric branches
 * have been removed in favour of a unified look.
 */
export function GradientBackground({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { scheme } = useThemeContext();

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        {children}
      </View>
    );
  }

  // Radial accent glows: top-left stronger, bottom-right softer
  const opacity1 = scheme === "dark" ? 0.14 : 0.10;
  const opacity2 = scheme === "dark" ? 0.08 : 0.06;

  const hex = colors.accent;
  const rgba = (op: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${op})`;
  };

  const webStyle = {
    background: [
      `radial-gradient(ellipse 80% 60% at 15% 0%, ${rgba(opacity1)} 0%, transparent 60%)`,
      `radial-gradient(ellipse 60% 50% at 85% 100%, ${rgba(opacity2)} 0%, transparent 60%)`,
      colors.bgPrimary,
    ].join(", "),
  };

  return (
    <View style={[{ flex: 1 }, webStyle as any]}>
      {children}
    </View>
  );
}
