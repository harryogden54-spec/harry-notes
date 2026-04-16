import React, { useRef, useCallback } from "react";
import { Tabs, useRouter, usePathname } from "expo-router";
import { Platform, Text, Animated, View, Pressable, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing, fontFamily } from "@/lib/theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type NavItem = {
  name: string;
  label: string;
  iconOutline: IoniconName;
  iconFilled: IoniconName;
  path: string;
};

const NAV_ITEMS: NavItem[] = [
  { name: "index",  label: "Home",  iconOutline: "home-outline",          iconFilled: "home",          path: "/(tabs)/" },
  { name: "today",  label: "Today", iconOutline: "today-outline",         iconFilled: "today",         path: "/(tabs)/today" },
  { name: "tasks",  label: "Tasks", iconOutline: "checkbox-outline",      iconFilled: "checkbox",      path: "/(tabs)/tasks" },
  { name: "lists",  label: "Lists", iconOutline: "list-outline",          iconFilled: "list",          path: "/(tabs)/lists" },
  { name: "notes",  label: "Notes", iconOutline: "document-text-outline", iconFilled: "document-text", path: "/(tabs)/notes" },
];

function TabIcon({ focused, color, iconOutline, iconFilled }: {
  focused: boolean;
  color: string;
  iconOutline: IoniconName;
  iconFilled: IoniconName;
}) {
  return <Ionicons name={focused ? iconFilled : iconOutline} size={22} color={color} />;
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
      backgroundColor: colors.bgPrimary,
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
          fontSize: 28, fontFamily: fontFamily.bold,
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
                <Ionicons
                  name={active ? item.iconFilled : item.iconOutline}
                  size={20}
                  color={active ? colors.accent : colors.textSecondary}
                />
                <Text style={{
                  fontSize: 14, fontFamily: active ? fontFamily.semibold : fontFamily.regular,
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
        <Ionicons name="settings-outline" size={20} color={colors.textTertiary} />
        <Text style={{ fontSize: 14, fontFamily: fontFamily.regular, color: colors.textTertiary }}>Settings</Text>
      </Pressable>
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { colors } = useTheme();
  const { onTabPress } = useFadeTab();
  const { width } = useWindowDimensions();

  const useSidebar = width >= 768;

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
        tabBarLabelStyle: { fontSize: 10, fontFamily: fontFamily.medium, marginTop: -2 },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home",  tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} iconOutline="home-outline" iconFilled="home" /> }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="today"
        options={{ title: "Today", tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} iconOutline="today-outline" iconFilled="today" /> }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: "Tasks", tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} iconOutline="checkbox-outline" iconFilled="checkbox" /> }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="lists"
        options={{ title: "Lists", tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} iconOutline="list-outline" iconFilled="list" /> }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="notes"
        options={{ title: "Notes", tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} iconOutline="document-text-outline" iconFilled="document-text" /> }}
        listeners={{ tabPress: onTabPress }}
      />
    </Tabs>
  );
}
