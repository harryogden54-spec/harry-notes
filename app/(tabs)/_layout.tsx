import React, { useRef, useCallback } from "react";
import { Tabs, useRouter, usePathname } from "expo-router";
import { Platform, Text, Animated, View, Pressable, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing } from "@/lib/theme";

const NAV_ITEMS = [
  { name: "index",  label: "Home",  icon: "⊞", path: "/(tabs)/" },
  { name: "today",  label: "Today", icon: "☀", path: "/(tabs)/today" },
  { name: "tasks",  label: "Tasks", icon: "✓", path: "/(tabs)/tasks" },
  { name: "lists",  label: "Lists", icon: "≡", path: "/(tabs)/lists" },
  { name: "notes",  label: "Notes", icon: "✎", path: "/(tabs)/notes" },
] as const;

function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20, color, lineHeight: 24 }}>{label}</Text>;
}

function useFadeTab() {
  const opacity = useRef(new Animated.Value(1)).current;
  const onTabPress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [opacity]);
  return { opacity, onTabPress };
}

// ─── Sidebar (web / tablet) ───────────────────────────────────────────────────

function Sidebar() {
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (name: string) => {
    if (name === "index") return pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/";
    return pathname.includes(`/${name}`);
  };

  return (
    <View style={{
      width: 220,
      height: "100%",
      backgroundColor: colors.bgSecondary,
      borderRightWidth: 1,
      borderRightColor: colors.bgBorder,
      paddingTop: Platform.OS === "web" ? 24 : 48,
      paddingBottom: 24,
      paddingHorizontal: spacing[3],
      justifyContent: "space-between",
    }}>
      {/* App name */}
      <View>
        <Text style={{
          fontSize: 28, fontWeight: "800",
          color: colors.textPrimary, letterSpacing: -1,
          marginBottom: spacing[6], paddingHorizontal: spacing[2],
        }}>
          harry.
        </Text>

        {/* Nav items */}
        <View style={{ gap: spacing[1] }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.name);
            return (
              <Pressable
                key={item.name}
                onPress={() => router.push(item.path as any)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2] + 2,
                  borderRadius: radius.lg,
                  backgroundColor: active ? `${colors.accent}20` : "transparent",
                }}
              >
                <Text style={{
                  fontSize: 16, lineHeight: 22,
                  color: active ? colors.accent : colors.textSecondary,
                }}>
                  {item.icon}
                </Text>
                <Text style={{
                  fontSize: 14, fontWeight: active ? "600" : "400",
                  color: active ? colors.accent : colors.textSecondary,
                }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Settings */}
      <Pressable
        onPress={() => router.push("/settings" as any)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[3],
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2] + 2,
          borderRadius: radius.lg,
        }}
      >
        <Text style={{ fontSize: 16, lineHeight: 22, color: colors.textTertiary }}>⚙</Text>
        <Text style={{ fontSize: 14, color: colors.textTertiary }}>Settings</Text>
      </Pressable>
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { colors } = useTheme();
  const { onTabPress } = useFadeTab();
  const { width } = useWindowDimensions();

  const useSidebar = Platform.OS === "web" || width >= 768;

  if (useSidebar) {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <Sidebar />
        <View style={{ flex: 1 }}>
          <Tabs
            screenOptions={{
              tabBarStyle: { display: "none" },
              headerShown: false,
            }}
          >
            {NAV_ITEMS.map(item => (
              <Tabs.Screen key={item.name} name={item.name} />
            ))}
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.bgPrimary,
          borderTopColor:  colors.bgBorder,
          borderTopWidth:  1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500", marginTop: -2 },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home",  tabBarIcon: ({ color }) => <TabIcon label="⊞" color={color} /> }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="today"
        options={{ title: "Today", tabBarIcon: ({ color }) => <TabIcon label="☀" color={color} /> }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: "Tasks", tabBarIcon: ({ color }) => <TabIcon label="✓" color={color} /> }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="lists"
        options={{ title: "Lists", tabBarIcon: ({ color }) => <TabIcon label="≡" color={color} /> }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="notes"
        options={{ title: "Notes", tabBarIcon: ({ color }) => <TabIcon label="✎" color={color} /> }}
        listeners={{ tabPress: onTabPress }}
      />
    </Tabs>
  );
}
