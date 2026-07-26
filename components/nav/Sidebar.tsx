import React, { useState, useEffect } from "react";
import { View, Pressable, ScrollView, Platform, Image } from "react-native";
import { Text } from "@/components/ui";
import ReAnimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";
import { useNotesData } from "@/lib/NotesContext";
import { cmpRecentDesc } from "@/lib/utils";
import type { NavItem } from "./navConfig";
import { NAV_ITEMS } from "./navConfig";

function ActiveBar({ active, accent }: { active: boolean; accent: string }) {
  const scale = useSharedValue(active ? 1 : 0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
    opacity: scale.value,
  }));

  React.useEffect(() => {
    scale.value = withSpring(active ? 1 : 0, { damping: 18, stiffness: 250 });
  }, [active]);

  return (
    <ReAnimated.View style={[{
      position: "absolute",
      left: 0,
      top: "20%",
      bottom: "20%",
      width: 3,
      borderRadius: 99,
      backgroundColor: accent,
    }, animStyle]} />
  );
}


type Props = { collapsed: boolean; onToggleCollapse: () => void };

export function Sidebar({ collapsed, onToggleCollapse }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { notes } = useNotesData();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const pinnedNotes = notes
    .filter(n => n.pinned && !n.archived)
    .sort(cmpRecentDesc);


  const chevronRot = useSharedValue(collapsed ? 1 : 0);
  useEffect(() => {
    chevronRot.value = withTiming(collapsed ? 1 : 0, { duration: 200 });
  }, [collapsed]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRot.value * 180}deg` }],
  }));

  const isActive = (name: string) => {
    if (name === "index") return pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/";
    return pathname.includes(`/${name}`);
  };


  return (
    <View style={{
      width: collapsed ? 48 : 220,
      height: "100%",
      backgroundColor: colors.bgSecondary,
      borderRightWidth: 1,
      borderRightColor: colors.bgBorder,
      paddingTop: Platform.OS === "web" ? 24 : 48,
      paddingBottom: 24,
      paddingHorizontal: collapsed ? spacing[1] : 0,
      overflow: "hidden",
    }}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing[4] }}>
        {/* App name + collapse toggle */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          marginBottom: spacing[5],
          paddingHorizontal: collapsed ? 0 : spacing[3],
        }}>
          {!collapsed && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <Image source={require("@/assets/images/icon.png")} style={{ width: 20, height: 20, borderRadius: 5 }} />
              <Text size="2xl" weight="bold" style={{ letterSpacing: -1 }}>
                harry.
              </Text>
            </View>
          )}
          <Pressable
            onPress={onToggleCollapse}
            // @ts-ignore
            onHoverIn={() => setHoveredItem("__toggle")}
            onHoverOut={() => setHoveredItem(null)}
            hitSlop={8}
            style={{
              width: 26, height: 26,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: hoveredItem === "__toggle" ? colors.bgBorder : "transparent",
              backgroundColor: hoveredItem === "__toggle" ? colors.bgTertiary : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ReAnimated.View style={chevronStyle}>
              <Ionicons name="chevron-back-outline" size={13} color={colors.textTertiary} />
            </ReAnimated.View>
          </Pressable>
        </View>

        {/* Nav items */}
        <View style={{ gap: 2, paddingHorizontal: collapsed ? 0 : spacing[2] }}>
          {NAV_ITEMS.map((item: NavItem) => {
            const active = isActive(item.name);
            const hovered = hoveredItem === item.name;
            const showTooltip = collapsed && hovered;

            return (
              <View key={item.name} style={{ position: "relative" }}>
                <Pressable
                  onPress={() => router.push(item.path as any)}
                  // @ts-ignore
                  onHoverIn={() => setHoveredItem(item.name)}
                  onHoverOut={() => setHoveredItem(null)}
                  style={{
                    flexDirection: "row", alignItems: "center",
                    gap: collapsed ? 0 : spacing[3],
                    paddingHorizontal: collapsed ? 0 : spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: radius.md,
                    justifyContent: collapsed ? "center" : "flex-start",
                    backgroundColor: hovered ? `${colors.accent}0C` : "transparent",
                  }}
                >
                  <ActiveBar active={active} accent={colors.accent} />
                  <Ionicons
                    name={active ? item.iconFilled : item.iconOutline}
                    size={18}
                    color={active ? colors.accent : hovered ? colors.textPrimary : colors.textSecondary}
                  />
                  {!collapsed && (
                    <Text
                      size="sm"
                      weight={active ? "semibold" : "regular"}
                      color={active || hovered ? colors.textPrimary : colors.textSecondary}
                    >
                      {item.label}
                    </Text>
                  )}
                </Pressable>

                {showTooltip && (
                  <View style={{
                    position: "absolute", left: 56, top: "50%",
                    transform: [{ translateY: -12 }],
                    backgroundColor: colors.bgSecondary,
                    borderWidth: 1, borderColor: colors.bgBorder,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
                    zIndex: 100,
                    // @ts-ignore
                    pointerEvents: "none",
                    // @ts-ignore
                    whiteSpace: "nowrap",
                  }}>
                    <Text size="xs" weight="medium">
                      {item.label}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Pinned notes */}
        {pinnedNotes.length > 0 && (
          <View style={{ marginTop: spacing[5], paddingHorizontal: collapsed ? 0 : spacing[2] }}>
            {!collapsed && (
              <Text size="label" weight="semibold" tertiary style={{ textTransform: "uppercase", paddingHorizontal: spacing[3], marginBottom: spacing[2] }}>
                Pinned
              </Text>
            )}
            {pinnedNotes.map(n => {
              const key = `pin_${n.id}`;
              const hovered = hoveredItem === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => router.push(`/(tabs)/notes?openId=${n.id}&_t=${Date.now()}` as any)}
                  // @ts-ignore
                  onHoverIn={() => setHoveredItem(key)}
                  onHoverOut={() => setHoveredItem(null)}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: collapsed ? 0 : spacing[2],
                    justifyContent: collapsed ? "center" : "flex-start",
                    paddingHorizontal: collapsed ? 0 : spacing[3], paddingVertical: spacing[1.5],
                    borderRadius: radius.md,
                    backgroundColor: hovered ? `${colors.accent}0C` : "transparent",
                  }}
                >
                  <Ionicons name="pin" size={12} color={hovered ? colors.accent : colors.textTertiary} />
                  {!collapsed && (
                    <Text numberOfLines={1} size="xs" color={hovered ? colors.textPrimary : colors.textSecondary} style={{ flex: 1 }}>
                      {n.title || "Untitled"}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* Bottom: Settings */}
      <Pressable
        onPress={() => router.push("/settings" as any)}
        // @ts-ignore
        onHoverIn={() => setHoveredItem("settings")}
        onHoverOut={() => setHoveredItem(null)}
        style={{
          flexDirection: "row", alignItems: "center",
          gap: collapsed ? 0 : spacing[3],
          paddingHorizontal: collapsed ? 0 : spacing[5],
          paddingVertical: spacing[2],
          borderRadius: radius.md,
          justifyContent: collapsed ? "center" : "flex-start",
          backgroundColor: hoveredItem === "settings" ? `${colors.accent}0C` : "transparent",
          borderTopWidth: 1, borderTopColor: colors.bgBorder,
          marginTop: spacing[2],
        }}
      >
        <Ionicons name="settings-outline" size={18} color={hoveredItem === "settings" ? colors.textPrimary : colors.textTertiary} />
        {!collapsed && (
          <Text size="sm" color={hoveredItem === "settings" ? colors.textPrimary : colors.textTertiary}>
            Settings
          </Text>
        )}
      </Pressable>
    </View>
  );
}
