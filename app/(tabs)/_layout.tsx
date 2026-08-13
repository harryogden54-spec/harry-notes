import React, { useCallback, useState, useEffect } from "react";
import { Tabs, useRouter, usePathname } from "expo-router";
import { Platform, View, Pressable, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { spacing, getShadow, transition } from "@/lib/theme";
import { useFloatingBottom } from "@/lib/TabBarHeightContext";
import { storage } from "@/lib/storage";
import { useTasksActions } from "@/lib/TasksContext";
import { useNotesActions } from "@/lib/NotesContext";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";
import { RouteFade } from "@/components/ui";
import { PersistentHeader, Sidebar, MobileTabBar, NAV_ITEMS } from "@/components/nav";

export default function TabLayout() {
  const { colors, scheme, shadow } = useTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { addTask, updateTask } = useTasksActions();
  const { addNote } = useNotesActions();
  const floatingBottom = useFloatingBottom();

  const autoCollapsed = width >= 768 && width < 900;
  const useSidebar = width >= 768;

  // Manual collapse overrides the width-based auto default and persists
  // across sessions; null = user hasn't chosen, follow autoCollapsed.
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);
  useEffect(() => {
    storage.get<boolean>("sidebar_collapsed").then(v => {
      if (typeof v === "boolean") setManualCollapsed(v);
    });
  }, []);
  const collapsed = manualCollapsed !== null ? manualCollapsed : autoCollapsed;
  const toggleSidebar = useCallback(() => {
    const next = !collapsed;
    setManualCollapsed(next);
    storage.set("sidebar_collapsed", next);
  }, [collapsed]);

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const pathname = usePathname();

  // Browser tab title follows the active screen (web only).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const item = NAV_ITEMS.find(i =>
      i.name === "index"
        ? (pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/")
        : pathname?.includes(`/${i.name}`)
    );
    document.title = item && item.name !== "index" ? `${item.label} · harry.` : "harry.";
  }, [pathname]);

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
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleSidebar} />
        <View style={{ flex: 1, overflow: "hidden" }}>
          <PersistentHeader showTitle={false} />
          <RouteFade>
            <Tabs screenOptions={{ tabBarStyle: { display: "none" }, headerShown: false }}>
              {NAV_ITEMS.map(item => <Tabs.Screen key={item.name} name={item.name} />)}
            </Tabs>
          </RouteFade>
        </View>
        {/* Quick-add — desktop's only add-from-anywhere affordance was the search bar; this mirrors the mobile FAB. */}
        <Pressable
          onPress={() => setShowQuickAdd(true)}
          accessibilityLabel="Quick add"
          style={({ hovered, pressed }: any) => ({
            position: "absolute", bottom: spacing[5], right: spacing[5], zIndex: 50,
            width: 48, height: 48, borderRadius: 99,
            backgroundColor: hovered ? colors.accentHover : colors.accent,
            alignItems: "center", justifyContent: "center",
            ...getShadow("md", scheme, { color: colors.accent, opacity: hovered && !pressed ? 0.55 : 0.4 }),
            ...(Platform.OS === "web" ? {
              // Diagonal accent gradient + lit top edge (same language as cards/buttons).
              backgroundImage: `linear-gradient(135deg, ${colors.accentHover}, ${colors.accent} 70%)`,
              ...transition("transform, background-color, box-shadow"),
              transform: [{ scale: pressed ? 0.94 : hovered ? 1.06 : 1 }],
            } : {}),
          } as any)}
        >
          <Ionicons name="add" size={24} color={colors.textInverse} />
        </Pressable>
        <QuickAddModal visible={showQuickAdd} onClose={() => setShowQuickAdd(false)} onAdd={handleQuickAddTask} />
      </View>
    );
  }

  return (
    <>
      <PersistentHeader />
      {/* Dual FAB */}
      <View
        // Derived from the tab bar's measured height — a Platform.OS === "ios"
        // check here was false in the iOS PWA, so the stack sat behind the bar.
        style={{ position: "absolute", bottom: floatingBottom, right: spacing[5], zIndex: 50, alignItems: "flex-end", gap: spacing[2], pointerEvents: "box-none" }}
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
            ...shadow("md"),
          }}
        >
          <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
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
            ...(Platform.OS === "web" ? {
              backgroundImage: `linear-gradient(135deg, ${colors.accentHover}, ${colors.accent} 70%)`,
            } as any : {}),
          }}
        >
          <Ionicons name="add" size={26} color={colors.textInverse} />
        </Pressable>
      </View>
      <QuickAddModal visible={showQuickAdd} onClose={() => setShowQuickAdd(false)} onAdd={handleQuickAddTask} />
      <Tabs
        tabBar={() => <MobileTabBar />}
        screenOptions={{ headerShown: false }}
      >
        {NAV_ITEMS.map(item => <Tabs.Screen key={item.name} name={item.name} />)}
      </Tabs>
    </>
  );
}
