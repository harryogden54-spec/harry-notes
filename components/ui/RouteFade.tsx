import React from "react";
import { Platform } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { usePathname } from "expo-router";

interface Props {
  children: React.ReactNode;
}

/**
 * Wraps screen content in a subtle fade-in keyed to the current route path.
 * On web this gives a smooth ~180ms opacity transition when navigating between
 * tabs or routes. On native the animation library handles it natively already
 * so we let the navigator's own transitions run unmodified.
 */
export function RouteFade({ children }: Props) {
  const pathname = usePathname();

  // Native navigators have their own slide/fade transitions — don't double-animate.
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <Animated.View
      key={pathname}
      entering={FadeIn.duration(180)}
      style={{ flex: 1 }}
    >
      {children}
    </Animated.View>
  );
}
