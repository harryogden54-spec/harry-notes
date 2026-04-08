import React from "react";
import { Tabs } from "expo-router";
import { Platform, Text } from "react-native";
import { useTheme } from "@/lib/useTheme";

function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20, color, lineHeight: 24 }}>{label}</Text>;
}

export default function TabLayout() {
  const { colors } = useTheme();

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
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color }) => <TabIcon label="✓" color={color} />,
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: "Lists",
          tabBarIcon: ({ color }) => <TabIcon label="≡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
          tabBarIcon: ({ color }) => <TabIcon label="✎" color={color} />,
        }}
      />
    </Tabs>
  );
}
