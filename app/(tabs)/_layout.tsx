import React, { useRef, useCallback, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { Platform, Animated, View, Pressable, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { spacing, fontFamily, getShadow, layout } from "@/lib/theme";
import { useTasksActions } from "@/lib/TasksContext";
import { useNotesActions } from "@/lib/NotesContext";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";
import { PersistentHeader, OfflineBanner, Sidebar, NAV_ITEMS } from "@/components/nav";
import type { IoniconName } from "@/components/nav";

function TabIcon({ focused, color, iconOutline, iconFilled }: {
  focused: boolean; color: string; iconOutline: IoniconName; iconFilled: IoniconName;
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

export default function TabLayout() {
  const { colors, scheme } = useTheme();
  const { onTabPress } = useFadeTab();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { addTask, updateTask } = useTasksActions();
  const { addNote } = useNotesActions();

  const autoCollapsed = width >= 768 && width < 900;
  const useSidebar = width >= 768;

  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);
  const collapsed = manualCollapsed !== null ? manualCollapsed : autoCollapsed;

  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const handleQuickAddTask = useCallback((
    title: string,
    dueDate?: string,
    category?: import("@/lib/TasksContext").TaskCategory,
    uniCourse?: import("@/lib/TasksContext").UniCourse,
  ) => {
    const id = addTask(title, dueDate);
    if (category) updateTask(id, { category, uniCourse: category === "uni" ? uniCourse : undefined });
  }, [addTask, updateTask]);

  if (useSidebar) {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setManualCollapsed(c => !(c !== null ? c : autoCollapsed))}
        />
        <View style={{ flex: 1, overflow: "hidden" }}>
          <PersistentHeader showTitle={false} />
          <OfflineBanner />
          <Tabs screenOptions={{ tabBarStyle: { display: "none" }, headerShown: false }}>
            {NAV_ITEMS.map(item => <Tabs.Screen key={item.name} name={item.name} />)}
            <Tabs.Screen name="calendar" options={{ href: null }} />
            <Tabs.Screen name="lists" options={{ href: null }} />
          </Tabs>
        </View>
        <QuickAddModal visible={showQuickAdd} onClose={() => setShowQuickAdd(false)} onAdd={handleQuickAddTask} />
      </View>
    );
  }

  return (
    <>
      <PersistentHeader />
      <OfflineBanner />
      {/* Dual FAB */}
      <View
        style={{ position: "absolute", bottom: Platform.OS === "ios" ? layout.fabBottom.ios : layout.fabBottom.default, right: spacing[5], zIndex: 50, alignItems: "flex-end", gap: spacing[2], pointerEvents: "box-none" }}
      >
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const id = addNote();
            router.push(`/(tabs)/notes?openId=${id}&_t=${Date.now()}` as any);
          }}
          accessibilityLabel="New note"
          style={{
            width: 44, height: 44, borderRadius: 99,
            backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.bgBorder,
            alignItems: "center", justifyContent: "center",
            ...getShadow("md", scheme),
          }}
        >
          <Ionicons name="create-outline" size={19} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowQuickAdd(true);
          }}
          style={{
            width: 52, height: 52, borderRadius: 99,
            backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
            // Accent glow — md geometry from the token scale, tinted shadow
            ...getShadow("md", scheme, { color: colors.accent, opacity: 0.4 }),
          }}
        >
          <Ionicons name="add" size={26} color={colors.textInverse} />
        </Pressable>
      </View>
      <QuickAddModal visible={showQuickAdd} onClose={() => setShowQuickAdd(false)} onAdd={handleQuickAddTask} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor:   colors.accent,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.bgSecondary,
            borderTopColor:  colors.bgBorder,
            borderTopWidth:  1,
            height: Platform.OS === "ios" ? layout.tabBarHeight.ios : layout.tabBarHeight.default,
            paddingBottom: Platform.OS === "ios" ? 28 : 10,
            paddingTop: Platform.OS === "ios" ? 8 : 6,
          } as any,
          tabBarLabelStyle: { fontSize: 10, fontFamily: fontFamily.medium, marginTop: 2 },
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index"   options={{ title: "Home",     tabBarIcon: p => <TabIcon {...p} iconOutline="home-outline"     iconFilled="home"     /> }} listeners={{ tabPress: onTabPress }} />
        <Tabs.Screen name="today"   options={{ title: "Today",    tabBarIcon: p => <TabIcon {...p} iconOutline="today-outline"    iconFilled="today"    /> }} listeners={{ tabPress: onTabPress }} />
        <Tabs.Screen name="tasks"   options={{ title: "Tasks",    tabBarIcon: p => <TabIcon {...p} iconOutline="checkbox-outline" iconFilled="checkbox" /> }} listeners={{ tabPress: onTabPress }} />
        <Tabs.Screen name="notes"   options={{ title: "Notes",    tabBarIcon: p => <TabIcon {...p} iconOutline="albums-outline"   iconFilled="albums"   /> }} listeners={{ tabPress: onTabPress }} />
        <Tabs.Screen name="dump"    options={{ title: "Dump",     tabBarIcon: p => <TabIcon {...p} iconOutline="cloud-upload-outline" iconFilled="cloud-upload" /> }} listeners={{ tabPress: onTabPress }} />
        <Tabs.Screen name="calendar" options={{ href: null }} />
        <Tabs.Screen name="lists"   options={{ href: null }} />
      </Tabs>
    </>
  );
}
