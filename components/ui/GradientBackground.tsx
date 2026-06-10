import React from "react";
import { Platform, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { usePathname } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";

/**
 * Full-screen background that:
 *   - Renders a per-theme radial accent gradient on web
 *   - Flat bgPrimary on native
 *   - On web: fades in (~180ms) whenever the route path changes, giving
 *     smooth tab/route transitions without touching individual screen files.
 */
export function GradientBackground({ children }: { children: React.ReactNode }) {
  const { colors, kit } = useTheme();
  const { scheme } = useThemeContext();
  const pathname = usePathname();

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        {children}
      </View>
    );
  }

  // Per-theme signature wash: two radial glows from the theme kit (Nord gets
  // frost→aurora, Ember a hearth glow, …) — kept very subtle.
  const opacity1 = scheme === "dark" ? 0.12 : 0.08;
  const opacity2 = scheme === "dark" ? 0.07 : 0.05;

  const rgba = (hex: string, op: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${op})`;
  };

  const webStyle = {
    background: [
      `radial-gradient(ellipse 80% 60% at 15% 0%, ${rgba(kit.wash[0], opacity1)} 0%, transparent 60%)`,
      `radial-gradient(ellipse 60% 50% at 85% 100%, ${rgba(kit.wash[1], opacity2)} 0%, transparent 60%)`,
      colors.bgPrimary,
    ].join(", "),
  };

  // Key on pathname so the Animated.View remounts and FadeIn replays on route change.
  return (
    <Animated.View
      key={pathname}
      entering={FadeIn.duration(180)}
      style={[{ flex: 1 }, webStyle as any]}
    >
      {children}
    </Animated.View>
  );
}
