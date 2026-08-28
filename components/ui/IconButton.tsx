import React from "react";
import { Pressable, View, Platform, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { radius } from "@/lib/theme";

/**
 * A tappable icon with a touch target big enough to actually hit.
 *
 * WHY THIS EXISTS — `hitSlop` does nothing on web.
 *
 * react-native-web implements `hitSlop` only in its legacy `Touchable` export.
 * `Pressable` ignores it outright. This app uses `Pressable` everywhere and
 * `Touchable*` nowhere, so all 97 `hitSlop` props across 32 files were dead
 * code — and since the iOS home-screen PWA *is* the web build, that is the
 * primary device. Controls were exactly as small as they looked: the header
 * light/dark toggle measured 18×8, task row overflow menus 14×15, the Today
 * reorder arrows 16×22. Apple's minimum is 44×44.
 *
 * Padding is the fix, because padding is real on every platform. The icon keeps
 * its visual size; the box around it grows to `size`. Use this instead of a
 * bare `Pressable` + `Ionicons` + `hitSlop` for any icon-only control.
 */
export function IconButton({
  name, onPress, accessibilityLabel, size = 44, iconSize = 18, color,
  disabled = false, style, tone = "default", title,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  /** Required — an icon-only control has no text for a screen reader to read. */
  accessibilityLabel: string;
  /** Touch-target edge. Defaults to the 44px HIG minimum. */
  size?: number;
  iconSize?: number;
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** "danger" tints the hover wash red for destructive actions. */
  tone?: "default" | "danger";
  /** Web-only tooltip. */
  title?: string;
}) {
  const { colors } = useTheme();
  const fg = color ?? colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      // @ts-ignore web-only tooltip
      title={Platform.OS === "web" ? (title ?? accessibilityLabel) : undefined}
      style={({ hovered, pressed }: any) => [
        {
          width: size, height: size,
          alignItems: "center", justifyContent: "center",
          borderRadius: radius.md,
          opacity: disabled ? 0.4 : 1,
          backgroundColor: hovered && !disabled
            ? (tone === "danger" ? `${colors.danger}14` : colors.bgTertiary)
            : "transparent",
          ...(Platform.OS === "web" ? {
            transitionProperty: "background-color, transform",
            transitionDuration: "120ms",
            transform: [{ scale: pressed && !disabled ? 0.94 : 1 }],
          } : {}),
        } as any,
        style,
      ]}
    >
      <Ionicons name={name} size={iconSize} color={tone === "danger" ? colors.danger : fg} />
    </Pressable>
  );
}

/**
 * Same trick for a control that is not an icon: an invisible padded hit area
 * around arbitrary children, without changing the visual layout.
 *
 * `inset` is how far the target extends beyond the content on each side — the
 * honest replacement for `hitSlop={n}`.
 */
export function TapTarget({
  children, onPress, accessibilityLabel, inset = 10, style, disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  inset?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[{ margin: -inset, padding: inset } as any, style]}
    >
      <View pointerEvents="none">{children}</View>
    </Pressable>
  );
}
