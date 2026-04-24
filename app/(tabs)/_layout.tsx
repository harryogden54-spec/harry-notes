import React, { useRef, useCallback, useState, useEffect } from "react";
import { Tabs, useRouter, usePathname } from "expo-router";
import { Platform, Text, Animated, View, Pressable, useWindowDimensions, ScrollView } from "react-native";
import ReAnimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing, fontFamily } from "@/lib/theme";
import { useTasks } from "@/lib/TasksContext";
import { useLists } from "@/lib/ListsContext";
import { getTodayStr } from "@/lib/utils";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type NavItem = {
  name: string;
  label: string;
  iconOutline: IoniconName;
  iconFilled: IoniconName;
  path: string;
};

const NAV_ITEMS: NavItem[] = [
  { name: "index",    label: "Home",     iconOutline: "home-outline",          iconFilled: "home",          path: "/(tabs)/" },
  { name: "today",    label: "Today",    iconOutline: "today-outline",         iconFilled: "today",         path: "/(tabs)/today" },
  { name: "tasks",    label: "Tasks",    iconOutline: "checkbox-outline",      iconFilled: "checkbox",      path: "/(tabs)/tasks" },
  { name: "lists",    label: "Lists",    iconOutline: "list-outline",          iconFilled: "list",          path: "/(tabs)/lists" },
  { name: "notes",    label: "Notes",    iconOutline: "document-text-outline", iconFilled: "document-text", path: "/(tabs)/notes" },
  { name: "calendar", label: "Calendar", iconOutline: "calendar-outline",      iconFilled: "calendar",      path: "/(tabs)/calendar" },
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

// ─── Active indicator bar ─────────────────────────────────────────────────────

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

// ─── Offline banner ───────────────────────────────────────────────────────────

function OfflineBanner() {
  const { colors } = useTheme();
  const { syncStatus, syncNow } = useTasks();
  const [networkOffline, setNetworkOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onOffline = () => setNetworkOffline(true);
    const onOnline  = () => setNetworkOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online",  onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online",  onOnline);
    };
  }, []);

  if (networkOffline) {
    return (
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[2],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 2,
        backgroundColor: `${colors.warning}18`,
        borderBottomWidth: 1,
        borderBottomColor: `${colors.warning}30`,
      }}>
        <Ionicons name="cloud-offline-outline" size={13} color={colors.warning} />
        <Text style={{ fontSize: 11, fontFamily: fontFamily.medium, color: colors.warning, flex: 1 }}>
          You're offline — changes will sync when reconnected
        </Text>
      </View>
    );
  }

  if (syncStatus !== "error") return null;

  return (
    <Pressable
      onPress={() => syncNow()}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[2],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 2,
        backgroundColor: `${colors.danger}18`,
        borderBottomWidth: 1,
        borderBottomColor: `${colors.danger}30`,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={13} color={colors.danger} />
      <Text style={{ fontSize: 11, fontFamily: fontFamily.medium, color: colors.danger, flex: 1 }}>
        Sync failed — tap to retry
      </Text>
      <Ionicons name="refresh-outline" size={13} color={colors.danger} />
    </Pressable>
  );
}

// ─── Sidebar (web / tablet) ───────────────────────────────────────────────────

// Group divider index: insert a divider before "calendar" (index 5)
const NAV_DIVIDER_BEFORE = 5;

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  const { colors } = useTheme();
  if (collapsed) return <View style={{ height: 1, backgroundColor: colors.bgBorder, marginVertical: spacing[2], marginHorizontal: spacing[1] }} />;
  return (
    <Text style={{
      fontSize: 11, letterSpacing: 1.2,
      color: colors.textSecondary,
      fontFamily: fontFamily.semibold,
      textTransform: "uppercase",
      paddingHorizontal: spacing[3],
      paddingTop: spacing[3],
      paddingBottom: spacing[1],
    }}>
      {label}
    </Text>
  );
}

function Sidebar({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { tasks } = useTasks();
  const { lists } = useLists();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const today = getTodayStr();
  const nextWeek = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();
  const overdueCount  = tasks.filter(t => !t.done && !t.archived && !!t.due_date && t.due_date < today).length;
  const thisWeekCount = tasks.filter(t => !t.done && !t.archived && !!t.due_date && t.due_date >= today && t.due_date <= nextWeek).length;

  // Animated chevron rotation
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
      width: collapsed ? 56 : 220,
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
          <Text style={{
            fontSize: collapsed ? 16 : 22,
            fontFamily: fontFamily.bold,
            color: colors.textPrimary,
            letterSpacing: -1,
            textAlign: collapsed ? "center" : "left",
          }}>
            {collapsed ? "h." : "harry."}
          </Text>
          <Pressable
            onPress={onToggleCollapse}
            // @ts-ignore — web-only hover events
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
          {NAV_ITEMS.map((item, idx) => {
            const active = isActive(item.name);
            const hovered = hoveredItem === item.name;
            const showTooltip = collapsed && hovered;

            return (
              <View key={item.name} style={{ position: "relative" }}>
                {idx === NAV_DIVIDER_BEFORE && (
                  <View style={{
                    height: 1, backgroundColor: colors.bgBorder,
                    marginVertical: spacing[2], marginHorizontal: spacing[1],
                  }} />
                )}
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
                    <Text style={{
                      fontSize: 13,
                      fontFamily: active ? fontFamily.medium : fontFamily.regular,
                      color: active ? colors.textPrimary : hovered ? colors.textPrimary : colors.textSecondary,
                    }}>
                      {item.label}
                    </Text>
                  )}
                </Pressable>

                {showTooltip && (
                  <View style={{
                    position: "absolute", left: 60, top: "50%",
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
                    <Text style={{ fontSize: 12, fontFamily: fontFamily.medium, color: colors.textPrimary }}>
                      {item.label}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── LISTS section ──────────────────────────────────────────── */}
        {lists.length > 0 && (
          <View style={{ marginTop: spacing[2] }}>
            <SectionLabel label="Lists" collapsed={collapsed} />
            <View style={{ gap: 1, paddingHorizontal: collapsed ? 0 : spacing[2] }}>
              {lists.slice(0, 8).map(list => {
                const hovered = hoveredItem === `list_${list.id}`;
                return (
                  <Pressable
                    key={list.id}
                    onPress={() => router.push("/(tabs)/lists" as any)}
                    // @ts-ignore
                    onHoverIn={() => setHoveredItem(`list_${list.id}`)}
                    onHoverOut={() => setHoveredItem(null)}
                    style={{
                      flexDirection: "row", alignItems: "center",
                      gap: collapsed ? 0 : spacing[2],
                      paddingHorizontal: collapsed ? 0 : spacing[3],
                      paddingVertical: spacing[1.5],
                      borderRadius: radius.sm,
                      justifyContent: collapsed ? "center" : "flex-start",
                      backgroundColor: hovered ? `${colors.accent}0C` : "transparent",
                    }}
                  >
                    <View style={{
                      width: collapsed ? 7 : 7, height: collapsed ? 7 : 7,
                      borderRadius: 99, backgroundColor: list.color,
                      flexShrink: 0,
                    }} />
                    {!collapsed && (
                      <>
                        <Text style={{
                          flex: 1, fontSize: 12, fontFamily: fontFamily.regular,
                          color: colors.textSecondary,
                        }} numberOfLines={1}>
                          {list.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: fontFamily.regular }}>
                          {list.items?.length ?? 0}
                        </Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ── FILTERS section ────────────────────────────────────────── */}
        <View style={{ marginTop: spacing[2] }}>
          <SectionLabel label="Filters" collapsed={collapsed} />
          <View style={{ gap: 1, paddingHorizontal: collapsed ? 0 : spacing[2] }}>
            {[
              { id: "overdue",   label: "Overdue",       count: overdueCount,  icon: "warning-outline" as IoniconName,   color: colors.danger },
              { id: "thisweek", label: "Due this week", count: thisWeekCount, icon: "calendar-outline" as IoniconName,  color: colors.accent },
            ].map(f => {
              const hovered = hoveredItem === `filter_${f.id}`;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => router.push(`/(tabs)/tasks?filter=${f.id}` as any)}
                  // @ts-ignore
                  onHoverIn={() => setHoveredItem(`filter_${f.id}`)}
                  onHoverOut={() => setHoveredItem(null)}
                  style={{
                    flexDirection: "row", alignItems: "center",
                    gap: collapsed ? 0 : spacing[2],
                    paddingHorizontal: collapsed ? 0 : spacing[3],
                    paddingVertical: spacing[1.5],
                    borderRadius: radius.sm,
                    justifyContent: collapsed ? "center" : "flex-start",
                    backgroundColor: hovered ? `${f.color}0C` : "transparent",
                  }}
                >
                  <Ionicons name={f.icon} size={14} color={f.count > 0 ? f.color : colors.textTertiary} />
                  {!collapsed && (
                    <>
                      <Text style={{
                        flex: 1, fontSize: 12, fontFamily: fontFamily.regular,
                        color: f.count > 0 ? f.color : colors.textSecondary,
                      }}>
                        {f.label}
                      </Text>
                      {f.count > 0 && (
                        <View style={{
                          backgroundColor: `${f.color}20`, borderRadius: 99,
                          paddingHorizontal: 5, paddingVertical: 1,
                        }}>
                          <Text style={{ fontSize: 10, color: f.color, fontFamily: fontFamily.medium }}>{f.count}</Text>
                        </View>
                      )}
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
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
        <Ionicons
          name="settings-outline"
          size={18}
          color={hoveredItem === "settings" ? colors.textPrimary : colors.textTertiary}
        />
        {!collapsed && (
          <Text style={{ fontSize: 13, fontFamily: fontFamily.regular, color: hoveredItem === "settings" ? colors.textPrimary : colors.textTertiary }}>
            Settings
          </Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── Global keyboard shortcuts overlay ───────────────────────────────────────

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const shortcuts: [string, string][] = [
    ["Cmd+K", "Quick-add task"],
    ["N",     "New task (Tasks screen)"],
    ["/",     "Focus search"],
    ["F",     "Toggle Focus mode"],
    ["G then H", "Go to Home"],
    ["G then T", "Go to Tasks"],
    ["G then L", "Go to Lists"],
    ["G then N", "Go to Notes"],
    ["G then C", "Go to Calendar"],
    ["?",     "Show this panel"],
    ["Esc",   "Close / cancel"],
  ];

  return (
    <Pressable
      onPress={onClose}
      style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 200, alignItems: "center", justifyContent: "center" } as any}
    >
      <Pressable onPress={e => e.stopPropagation()} style={{
        backgroundColor: colors.bgSecondary,
        borderWidth: 1, borderColor: colors.bgBorder,
        borderRadius: radius.xl,
        padding: spacing[6],
        width: 400, maxWidth: "90%" as any,
        gap: spacing[4],
      }}>
        <Text style={{ fontSize: 16, fontFamily: fontFamily.semibold, color: colors.textPrimary }}>
          Keyboard shortcuts
        </Text>
        <View style={{ gap: spacing[2] }}>
          {shortcuts.map(([key, desc]) => (
            <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, fontFamily: fontFamily.regular, color: colors.textSecondary, flex: 1 }}>{desc}</Text>
              <View style={{ backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontFamily: "monospace" as any, color: colors.textPrimary }}>{key}</Text>
              </View>
            </View>
          ))}
        </View>
        <Pressable onPress={onClose} style={{ alignSelf: "flex-end", paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.md, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder }}>
          <Text style={{ fontSize: 13, fontFamily: fontFamily.medium, color: colors.textSecondary }}>Close</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { colors } = useTheme();
  const { onTabPress } = useFadeTab();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { addTask, updateTask } = useTasks();

  const autoCollapsed = width >= 768 && width < 900;
  const useSidebar = width >= 768;

  // Manual sidebar collapse overrides the breakpoint auto-collapse
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);
  const collapsed = manualCollapsed !== null ? manualCollapsed : autoCollapsed;

  // Global quick-add
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Global keyboard shortcuts (web only)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      // Cmd+K / Ctrl+K — global quick-add (works even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowQuickAdd(v => !v);
        return;
      }

      if (e.key === "Escape") {
        setShowQuickAdd(false);
        setShowShortcuts(false);
        gPressed = false;
        return;
      }

      if (isInput) return;

      // ? → shortcuts help
      if (e.key === "?") { e.preventDefault(); setShowShortcuts(v => !v); return; }

      // g-prefix nav shortcuts
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
        else if (key === "l") { e.preventDefault(); router.push("/(tabs)/lists" as any); }
        else if (key === "n") { e.preventDefault(); router.push("/(tabs)/notes" as any); }
        else if (key === "c") { e.preventDefault(); router.push("/(tabs)/calendar" as any); }
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const handleQuickAddTask = useCallback((title: string, dueDate?: string, category?: import("@/lib/TasksContext").TaskCategory, uniCourse?: import("@/lib/TasksContext").UniCourse) => {
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
          <OfflineBanner />
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

        {/* Global quick-add (Cmd+K) */}
        <QuickAddModal visible={showQuickAdd} onClose={() => setShowQuickAdd(false)} onAdd={handleQuickAddTask} />

        {/* Global shortcuts panel */}
        {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
      </View>
    );
  }

  return (
    <>
      <OfflineBanner />
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
        <Tabs.Screen
          name="calendar"
          options={{ title: "Calendar", tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} iconOutline="calendar-outline" iconFilled="calendar" /> }}
          listeners={{ tabPress: onTabPress }}
        />
      </Tabs>
    </>
  );
}
