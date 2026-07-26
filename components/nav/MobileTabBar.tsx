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

/**
 * Everything in the bar above its bottom inset padding: borderTop (1) +
 * paddingTop spacing[1.5] (6) + a tab's paddingVertical spacing[1] (8) + the
 * 22px icon + 2px gap + the 2xs label's line box. Measured at 55px.
 *
 * This is reported synchronously so the FAB stack, toasts and scroll paddings
 * are correct on the very first frame. onLayout below corrects it if the real
 * height ever differs (e.g. a font-scale change) — but it cannot be the only
 * source: react-native-web drives onLayout from a ResizeObserver that does not
 * reliably deliver an initial callback, so a measurement-only approach leaves
 * every consumer on its fallback value forever.
 */
const BAR_CONTENT_HEIGHT = 55;

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
  const { colors, scheme } = useTheme();
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
              <Ionicons name={active ? item.iconFilled : item.iconOutline} size={22} color={active ? colors.accent : colors.textTertiary} />
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
          <Ionicons name={moreActive ? "ellipsis-horizontal-circle" : "ellipsis-horizontal-circle-outline"} size={22} color={moreActive ? colors.accent : colors.textTertiary} />
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
              ...getShadow("overlay", scheme),
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
                  <Ionicons name={active ? item.iconFilled : item.iconOutline} size={20} color={active ? colors.accent : colors.textSecondary} />
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
              <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
              <Text size="base" style={{ flex: 1 }}>Settings</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
