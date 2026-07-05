import React, { useCallback, useState, useEffect } from "react";
import { Tabs, useRouter, usePathname } from "expo-router";
import { Platform, View, Pressable, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { spacing, getShadow, layout } from "@/lib/theme";
import { useTasksActions } from "@/lib/TasksContext";
import { useNotesActions } from "@/lib/NotesContext";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";
import { RouteFade } from "@/components/ui";
import {
  PersistentHeader, OfflineBanner, Sidebar, ShortcutsHelp, GlobalSearchModal, MobileTabBar, NAV_ITEMS,
} from "@/components/nav";

export default function TabLayout() {
  const { colors, scheme } = useTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const { addTask, updateTask } = useTasksActions();
  const { addNote } = useNotesActions();

  const autoCollapsed = width >= 768 && width < 900;
  const useSidebar = width >= 768;

  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);
  const collapsed = manualCollapsed !== null ? manualCollapsed : autoCollapsed;

  const [showQuickAdd, setShowQuickAdd]         = useState(false);
  const [showShortcuts, setShowShortcuts]       = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

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

  // Global keyboard shortcuts (web only)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if (e.key === "Escape") {
        setShowQuickAdd(false);
        setShowShortcuts(false);
        setShowGlobalSearch(false);
        gPressed = false;
        return;
      }
      if (isInput) return;
      if (e.key === "/") { e.preventDefault(); setShowGlobalSearch(v => !v); return; }
      if (e.key === "?") { e.preventDefault(); setShowShortcuts(v => !v); return; }
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        gPressed = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 1000);
        return;
      }
      if (gPressed) {
        gPressed = false;
        if (gTimer) clearTimeout(gTimer);
        const key = e.key.toLowerCase();
        if (key === "h") { e.preventDefault(); router.push("/(tabs)/" as any); }
        else if (key === "t") { e.preventDefault(); router.push("/(tabs)/tasks" as any); }
        else if (key === "n") { e.preventDefault(); router.push("/(tabs)/notes" as any); }
        else if (key === "c") { e.preventDefault(); router.push("/(tabs)/courses" as any); }
        else if (key === "p") { e.preventDefault(); router.push("/(tabs)/postits" as any); }
        else if (key === "d") { e.preventDefault(); router.push("/(tabs)/dump" as any); }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

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
          <RouteFade>
            <Tabs screenOptions={{ tabBarStyle: { display: "none" }, headerShown: false }}>
              {NAV_ITEMS.map(item => <Tabs.Screen key={item.name} name={item.name} />)}
              <Tabs.Screen name="calendar" options={{ href: null }} />
              <Tabs.Screen name="lists" options={{ href: null }} />
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
              transitionProperty: "transform, background-color, box-shadow",
              transitionDuration: "150ms",
              transitionTimingFunction: "ease-out",
              transform: [{ scale: pressed ? 0.94 : hovered ? 1.06 : 1 }],
            } : {}),
          } as any)}
        >
          <Ionicons name="add" size={24} color={colors.textInverse} />
        </Pressable>
        <QuickAddModal visible={showQuickAdd} onClose={() => setShowQuickAdd(false)} onAdd={handleQuickAddTask} />
        {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
        <GlobalSearchModal visible={showGlobalSearch} onClose={() => setShowGlobalSearch(false)} />
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
            addNote("postit");
            if (!pathname?.includes("/postits")) router.push("/(tabs)/postits" as any);
          }}
          style={{
            width: 44, height: 44, borderRadius: 99,
            backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.bgBorder,
            alignItems: "center", justifyContent: "center",
            ...getShadow("md", scheme),
          }}
        >
          <Ionicons name="layers-outline" size={19} color={colors.textSecondary} />
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
        tabBar={() => <MobileTabBar />}
        screenOptions={{ headerShown: false }}
      >
        {NAV_ITEMS.map(item => <Tabs.Screen key={item.name} name={item.name} />)}
        <Tabs.Screen name="calendar" options={{ href: null }} />
        <Tabs.Screen name="lists"   options={{ href: null }} />
      </Tabs>
    </>
  );
}
