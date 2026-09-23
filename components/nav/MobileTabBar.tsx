import React, { useEffect, useState } from "react";
import { View, Pressable, Platform, Modal } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, getShadow } from "@/lib/theme";
import { useReportTabBarHeight } from "@/lib/TabBarHeightContext";
import { NAV_ITEMS, MOBILE_BAR_NAMES, type NavItem } from "./navConfig";
import { NavIcon } from "./NavIcon";

/**
 * Everything in the bar above its bottom inset padding: borderTop (1) +
 * paddingTop spacing[1.5] (6) + a tab's paddingVertical spacing[1] (8) + the
 * 22px NavIcon svg + 2px gap + the 2xs label's line box. Measured at 53px
 * (2026-09-23, after the duotone icons replaced Ionicons, whose font line box
 * was 2px taller than the glyph).
 *
 * This is reported synchronously so the FAB stack, toasts and scroll paddings
 * are correct on the very first frame. onLayout below corrects it if the real
 * height ever differs (e.g. a font-scale change) — but it cannot be the only
 * source: react-native-web drives onLayout from a ResizeObserver that does not
 * reliably deliver an initial callback, so a measurement-only approach leaves
 * every consumer on its fallback value forever.
 */
const BAR_CONTENT_HEIGHT = 53;

/**
 * Custom mobile bottom bar: four primary tabs + a "More" button that opens a
 * slide-up sheet with the remaining destinations (Courses, Dump, Settings).
 * Replaces the default tab bar, which was too cluttered.
 *
 * Rendered via the Tabs `tabBar` prop but intentionally ignores the
 * react-navigation props — expo-router's usePathname/useRouter cover
 * active-state and navigation without coupling to the navigator internals.
 */
export function MobileTabBar() {
  const { colors, scheme, shadow } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const reportHeight = useReportTabBarHeight();
  const [moreOpen, setMoreOpen] = useState(false);

  // The bar owns the bottom safe-area inset and publishes the resulting height.
  const barPaddingBottom = Math.max(insets.bottom, spacing[2.5]);
  useEffect(() => {
    reportHeight(BAR_CONTENT_HEIGHT + barPaddingBottom);
  }, [barPaddingBottom, reportHeight]);

  const barItems  = NAV_ITEMS.filter(i => MOBILE_BAR_NAMES.includes(i.name));
  const moreItems = NAV_ITEMS.filter(i => !MOBILE_BAR_NAMES.includes(i.name));

  const isActive = (item: NavItem) =>
    item.name === "index"
      ? (pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/")
      : pathname.includes(`/${item.name}`);
  const moreActive = moreItems.some(isActive);

  const go = (path: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setMoreOpen(false);
    router.push(path as any);
  };

  return (
    <>
      <View
        // The bar is the single owner of the bottom safe-area inset, and it
        // publishes its resulting height so the FAB stack, the toasts and every
        // screen's scroll padding can derive from a measured number instead of
        // guessing per platform. See lib/TabBarHeightContext.tsx.
        onLayout={e => reportHeight(e.nativeEvent.layout.height)}
        style={{
          flexDirection: "row",
          backgroundColor: colors.bgSecondary,
          borderTopWidth: 1,
          borderTopColor: colors.bgBorder,
          paddingTop: spacing[1.5],
          paddingBottom: barPaddingBottom,
          // On web the padding comes straight from CSS env(), not from the JS
          // inset: the safe-area provider can hold a stale 0 after a cold PWA
          // launch, and CSS always has WebKit's current value. The JS value
          // above still drives the published height (FAB, toasts, scroll pads),
          // and lib/webViewport.ts keeps it refreshed.
          ...(Platform.OS === "web" ? { paddingBottom: `max(env(safe-area-inset-bottom), ${spacing[2.5]}px)` } as any : {}),
        }}
      >
        {barItems.map(item => {
          const active = isActive(item);
          return (
            <Pressable
              key={item.name}
              onPress={() => go(item.path)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{ flex: 1, alignItems: "center", gap: 2, paddingVertical: spacing[1] }}
            >
              <NavIcon glyph={item.glyph} size={22} active={active} color={active ? colors.accent : colors.textTertiary} />
              <Text size="2xs" weight="medium" style={{ color: active ? colors.accent : colors.textTertiary }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            setMoreOpen(true);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: moreActive }}
          style={{ flex: 1, alignItems: "center", gap: 2, paddingVertical: spacing[1] }}
        >
          <NavIcon glyph="more" size={22} active={moreActive} color={moreActive ? colors.accent : colors.textTertiary} />
          <Text size="2xs" weight="medium" style={{ color: moreActive ? colors.accent : colors.textTertiary }}>
            More
          </Text>
        </Pressable>
      </View>

      <Modal visible={moreOpen} transparent animationType="none" onRequestClose={() => setMoreOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={{ position: "absolute", inset: 0 } as any}>
            <Pressable onPress={() => setMoreOpen(false)} style={{ flex: 1, backgroundColor: colors.scrim }} />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.duration(240)}
            exiting={SlideOutDown.duration(180)}
            style={{
              backgroundColor: colors.bgSecondary,
              borderTopLeftRadius: radius["2xl"],
              borderTopRightRadius: radius["2xl"],
              borderWidth: 1,
              borderColor: colors.bgBorder,
              paddingTop: spacing[2.5],
              paddingHorizontal: spacing[3],
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              ...shadow("overlay"),
            }}
          >
            {/* Drag handle */}
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 99, backgroundColor: colors.bgBorder, marginBottom: spacing[3] }} />

            {moreItems.map(item => {
              const active = isActive(item);
              return (
                <Pressable
                  key={item.name}
                  onPress={() => go(item.path)}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: spacing[3],
                    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
                    borderRadius: radius.lg,
                    backgroundColor: active ? `${colors.accent}12` : "transparent",
                  }}
                >
                  <NavIcon glyph={item.glyph} size={22} active={active} color={active ? colors.accent : colors.textSecondary} />
                  <Text size="base" weight={active ? "semibold" : "regular"} style={{ flex: 1, color: active ? colors.accent : colors.textPrimary }}>
                    {item.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </Pressable>
              );
            })}

            <View style={{ height: 1, backgroundColor: colors.bgBorder, marginVertical: spacing[2], marginHorizontal: spacing[3] }} />

            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setMoreOpen(false);
                router.push("/settings" as any);
              }}
              style={{
                flexDirection: "row", alignItems: "center", gap: spacing[3],
                paddingHorizontal: spacing[3], paddingVertical: spacing[3],
                borderRadius: radius.lg,
              }}
            >
              <NavIcon glyph="settings" size={22} color={colors.textSecondary} />
              <Text size="base" style={{ flex: 1 }}>Settings</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
