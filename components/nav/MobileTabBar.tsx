import React, { useState } from "react";
import { View, Pressable, Platform, Modal } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, getShadow } from "@/lib/theme";
import { NAV_ITEMS, MOBILE_BAR_NAMES, type NavItem } from "./navConfig";

/**
 * Custom mobile bottom bar: four primary tabs + a "More" button that opens a
 * slide-up sheet with the remaining destinations (Post Its, Dump, Courses,
 * Settings). Replaces the default six-tab bar, which was too cluttered.
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
  const [moreOpen, setMoreOpen] = useState(false);

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
        style={{
          flexDirection: "row",
          backgroundColor: colors.bgSecondary,
          borderTopWidth: 1,
          borderTopColor: colors.bgBorder,
          paddingTop: spacing[1.5],
          paddingBottom: Math.max(insets.bottom, spacing[2.5]),
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
            <Pressable onPress={() => setMoreOpen(false)} style={{ flex: 1, backgroundColor: "#00000055" }} />
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
