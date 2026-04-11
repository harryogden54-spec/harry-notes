import React, { useRef, useCallback } from "react";
import { Tabs } from "expo-router";
import { Platform, Text, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";

function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20, color, lineHeight: 24 }}>{label}</Text>;
}

function useFadeTab() {
  const opacity = useRef(new Animated.Value(1)).current;

  const onTabPress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return { opacity, onTabPress };
}

export default function TabLayout() {
  const { colors } = useTheme();
  const { onTabPress } = useFadeTab();

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
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          marginTop: -2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon label="⊞" color={color} />,
        }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color }) => <TabIcon label="☀" color={color} />,
        }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color }) => <TabIcon label="✓" color={color} />,
        }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: "Lists",
          tabBarIcon: ({ color }) => <TabIcon label="≡" color={color} />,
        }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
          tabBarIcon: ({ color }) => <TabIcon label="✎" color={color} />,
        }}
        listeners={{ tabPress: onTabPress }}
      />
    </Tabs>
  );
}
