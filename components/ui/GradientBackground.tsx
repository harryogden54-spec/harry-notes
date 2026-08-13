import React from "react";
import { Platform, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { usePathname } from "expo-router";
import { useTheme } from "@/lib/useTheme";

/**
 * Full-screen page background — flat `bgPrimary`, plus a ~180ms fade on web
 * whenever the route changes, which gives smooth tab transitions without
 * touching individual screen files.
 *
 * It used to paint a per-theme radial wash here (three stacked
 * `radial-gradient`s from `kit.wash`). That was written before surfaces earned
 * their hierarchy from borders and the elevation ladder; once they did, the
 * wash was a second, softer hierarchy arguing with the first — cards read as
 * floating on a tinted field rather than sitting on a page.
 *
 * The component and `kit.wash` both stay, so restoring it is a local change
 * here rather than an archaeology exercise. Per-theme identity now comes from
 * the accent and the surface ramp.
 */
export function GradientBackground({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const pathname = usePathname();

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        {children}
      </View>
    );
  }

  // Key on pathname so the Animated.View remounts and FadeIn replays on route change.
  return (
    <Animated.View
      key={pathname}
      entering={FadeIn.duration(180)}
      style={{ flex: 1, backgroundColor: colors.bgPrimary }}
    >
      {children}
    </Animated.View>
  );
}
