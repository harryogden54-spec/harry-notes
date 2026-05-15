import React, { useRef, useCallback, useState, useEffect } from "react";
import { Tabs, useRouter, usePathname } from "expo-router";
import { Platform, Text, Animated, View, Pressable, useWindowDimensions, ScrollView, TextInput } from "react-native";
import ReAnimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing, fontFamily, THEMES, type ThemeId } from "@/lib/theme";
import { useTasks } from "@/lib/TasksContext";
import { useLists } from "@/lib/ListsContext";
import { getTodayStr } from "@/lib/utils";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";
import { SearchResults } from "@/components/dashboard/SearchResults";
import { useNotes } from "@/lib/NotesContext";
import { useThemeContext } from "@/lib/ThemeContext";
import { useSyncStatus } from "@/lib/useSyncStatus";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type NavItem = {
  name: string;
  label: string;
  iconOutline: IoniconName;
  iconFilled: IoniconName;
  path: string;
};

const NAV_ITEMS: NavItem[] = [
  { name: "index",   label: "Home",     iconOutline: "home-outline",     iconFilled: "home",     path: "/(tabs)/" },
  { name: "today",   label: "Today",    iconOutline: "today-outline",    iconFilled: "today",    path: "/(tabs)/today" },
  { name: "tasks",   label: "Tasks",    iconOutline: "checkbox-outline", iconFilled: "checkbox", path: "/(tabs)/tasks" },
  { name: "notes",   label: "Notes",    iconOutline: "albums-outline",   iconFilled: "albums",   path: "/(tabs)/notes" },
  { name: "postits", label: "Post Its", iconOutline: "layers-outline",   iconFilled: "layers",   path: "/(tabs)/postits" },
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

// ─── Persistent header ───────────────────────────────────────────────────────

const THEME_IDS = Object.keys(THEMES) as ThemeId[];

function syncChipLabel(status: string, lastSynced: string | null, mounted: boolean): string | null {
  if (!mounted) return null;
  if (status === "syncing") return "Syncing…";
  if (status === "error") return "Sync error";
  if (!lastSynced) return null;
  const diff = Math.floor((Date.now() - new Date(lastSynced).getTime()) / 1000);
  if (diff < 15) return "Just synced";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function PersistentHeader({ showTitle = true }: { showTitle?: boolean }) {
  const { colors } = useTheme();
  const { themeId, setThemeId } = useThemeContext();
  const { status, lastSynced } = useSyncStatus();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  function cycleTheme() {
    const next = THEME_IDS[(THEME_IDS.indexOf(themeId) + 1) % THEME_IDS.length];
    setThemeId(next);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const chipLabel = syncChipLabel(status, lastSynced, mounted);
  const chipColor = status === "error" ? colors.danger : status === "syncing" ? colors.accent : colors.textTertiary;

  return (
    <View style={{
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing[4], paddingVertical: spacing[2],
      borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
      backgroundColor: colors.bgSecondary,
      minHeight: 40,
    }}>
      {showTitle ? (
        <Text style={{ fontFamily: fontFamily.bold, fontSize: 15, color: colors.textPrimary, letterSpacing: -0.5 }}>
          harry.
        </Text>
      ) : <View style={{ width: 40 }} />}
      <View style={{ flex: 1, alignItems: "center" }}>
        {chipLabel && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: chipColor }} />
            <Text style={{ fontSize: 11, fontFamily: fontFamily.regular, color: chipColor }}>{chipLabel}</Text>
          </View>
        )}
      </View>
      <Pressable onPress={cycleTheme} hitSlop={8} style={{
        paddingHorizontal: spacing[2], paddingVertical: 3,
        borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder,
      }}>
        <Text style={{ fontSize: 10, fontFamily: fontFamily.medium, color: colors.textSecondary }}>
          {THEMES[themeId].label}
        </Text>
      </Pressable>
    </View>
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
          Offline — changes will sync when reconnected
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
      paddingTop: spacing[4],
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
            <Text style={{
              fontSize: 22,
              fontFamily: fontFamily.bold,
              color: colors.textPrimary,
              letterSpacing: -1,
            }}>
              harry.
            </Text>
          )}
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
          {NAV_ITEMS.map((item) => {
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
                    <Text style={{
                      fontSize: 13,
                      fontFamily: active ? fontFamily.semibold : fontFamily.regular,
                      color: active ? colors.textPrimary : hovered ? colors.textPrimary : colors.textSecondary,
                    }}>
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
                    onPress={() => router.push(`/(tabs)/notes?listId=${list.id}` as any)}
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
                      width: 7, height: 7,
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
    ["/",     "Global search"],
    ["N",     "New task (Tasks screen)"],
    ["F",     "Toggle Focus mode"],
    ["G then H", "Go to Home"],
    ["G then T", "Go to Tasks"],
    ["G then N", "Go to Notes"],
    ["G then P", "Go to Post Its"],
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

// ─── Global search modal ──────────────────────────────────────────────────────

function GlobalSearchModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { tasks } = useTasks();
  const { lists } = useLists();
  const { notes } = useNotes();
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={{ position: "absolute", inset: 0, zIndex: 150, backgroundColor: "rgba(0,0,0,0.6)" } as any}>
      <Pressable style={{ position: "absolute", inset: 0 } as any} onPress={onClose} />
      <View style={{
        position: "absolute",
        top: 80,
        left: "50%",
        transform: [{ translateX: -280 }],
        width: 560,
        maxWidth: "90%" as any,
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.bgBorder,
        overflow: "hidden",
        // @ts-ignore
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.4,
        shadowRadius: 32,
      }}>
        {/* Search input */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: spacing[3],
          paddingHorizontal: spacing[4], paddingVertical: spacing[3],
          borderBottomWidth: query.length > 0 ? 1 : 0,
          borderBottomColor: colors.bgBorder,
        }}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks, lists, notes…"
            placeholderTextColor={colors.textTertiary}
            style={[
              { flex: 1, color: colors.textPrimary, fontSize: 16, fontFamily: fontFamily.regular },
              // @ts-ignore
              { outlineStyle: "none" },
            ]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>✕</Text>
            </Pressable>
          )}
          <View style={{ backgroundColor: colors.bgTertiary, borderRadius: radius.sm, paddingHorizontal: spacing[1.5], paddingVertical: 2, borderWidth: 1, borderColor: colors.bgBorder }}>
            <Text style={{ fontSize: 11, fontFamily: "monospace" as any, color: colors.textTertiary }}>Esc</Text>
          </View>
        </View>
        {/* Results */}
        {query.trim().length >= 1 && (
          <ScrollView
            style={{ maxHeight: 480 }}
            contentContainerStyle={{ padding: spacing[4] }}
            keyboardShouldPersistTaps="handled"
          >
            <SearchResults
              tasks={tasks.filter(t => !t.done && !t.archived)}
              lists={lists}
              notes={notes}
              query={query.trim()}
              onTaskPress={() => onClose()}
            />
          </ScrollView>
        )}
        {query.trim().length === 0 && (
          <View style={{ padding: spacing[4], paddingTop: spacing[3] }}>
            <Text style={{ fontSize: 12, fontFamily: fontFamily.regular, color: colors.textTertiary }}>
              Type to search across tasks, lists, and notes
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { colors } = useTheme();
  const { onTabPress } = useFadeTab();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { addTask, updateTask } = useTasks();
  const { addNote } = useNotes();

  const autoCollapsed = width >= 768 && width < 900;
  const useSidebar = width >= 768;

  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);
  const collapsed = manualCollapsed !== null ? manualCollapsed : autoCollapsed;

  const pathname = usePathname();
  const [showQuickAdd, setShowQuickAdd]       = useState(false);
  const [showShortcuts, setShowShortcuts]     = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // Global keyboard shortcuts (web only)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowQuickAdd(v => !v);
        return;
      }

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
        else if (key === "p") { e.preventDefault(); router.push("/(tabs)/postits" as any); }
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
          <PersistentHeader showTitle={false} />
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
            {/* Hidden: routable but not in nav */}
            <Tabs.Screen name="calendar" options={{ href: null }} />
            <Tabs.Screen name="lists" options={{ href: null }} />
          </Tabs>
        </View>

        <QuickAddModal visible={showQuickAdd} onClose={() => setShowQuickAdd(false)} onAdd={handleQuickAddTask} />
        {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
        <GlobalSearchModal visible={showGlobalSearch} onClose={() => setShowGlobalSearch(false)} />

        {/* Shortcut hint chip — bottom-left, desktop only */}
        {!showShortcuts && (
          <Pressable
            onPress={() => setShowShortcuts(true)}
            accessibilityRole="button"
            accessibilityLabel="Show keyboard shortcuts"
            style={{
              // @ts-ignore — web-only
              position: "fixed",
              bottom: 16,
              left: 16,
              backgroundColor: colors.bgTertiary,
              borderRadius: 99,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
              borderWidth: 1,
              borderColor: colors.bgBorder,
              zIndex: 50,
            } as any}
          >
            <Text style={{ fontSize: 11, fontFamily: fontFamily.regular, color: colors.textTertiary }}>
              ? for shortcuts
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <>
      <PersistentHeader />
      <OfflineBanner />
      {/* Dual FAB — task (primary) + note/list (secondary) */}
      <View
        style={{
          position: "absolute",
          bottom: Platform.OS === "ios" ? 100 : 76,
          right: spacing[5],
          zIndex: 50,
          alignItems: "flex-end",
          gap: spacing[2],
        }}
        pointerEvents="box-none"
      >
        {/* Secondary: context-aware — new list on notes tab, new post-it on postits tab, new note elsewhere */}
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (pathname.includes("/postits")) addNote("postit");
            else if (pathname.includes("/notes")) router.push("/(tabs)/notes?create=list" as any);
            else router.push("/(tabs)/notes?create=note" as any);
          }}
          style={{
            width: 44, height: 44,
            borderRadius: 99,
            backgroundColor: colors.bgSecondary,
            borderWidth: 1,
            borderColor: colors.bgBorder,
            alignItems: "center", justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Ionicons
            name={pathname.includes("/postits") ? "layers-outline" : pathname.includes("/notes") ? "list-outline" : "document-text-outline"}
            size={19}
            color={colors.textSecondary}
          />
        </Pressable>

        {/* Primary: new task */}
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowQuickAdd(true);
          }}
          style={{
            width: 52, height: 52,
            borderRadius: 99,
            backgroundColor: colors.accent,
            alignItems: "center", justifyContent: "center",
            // @ts-ignore
            shadowColor: colors.accent,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 8,
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
            height: Platform.OS === "ios" ? 88 : 68,
            paddingBottom: Platform.OS === "ios" ? 28 : 10,
            paddingTop: Platform.OS === "ios" ? 8 : 6,
          } as any,
          tabBarLabelStyle: { fontSize: 10, fontFamily: fontFamily.medium, marginTop: 2 },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Home", tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} iconOutline="home-outline" iconFilled="home" /> }}
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
          name="notes"
          options={{ title: "Notes", tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} iconOutline="albums-outline" iconFilled="albums" /> }}
          listeners={{ tabPress: onTabPress }}
        />
        <Tabs.Screen
          name="postits"
          options={{ title: "Post Its", tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} color={color} iconOutline="layers-outline" iconFilled="layers" /> }}
          listeners={{ tabPress: onTabPress }}
        />
        {/* Hidden from tab bar */}
        <Tabs.Screen name="calendar" options={{ href: null }} />
        <Tabs.Screen name="lists" options={{ href: null }} />
      </Tabs>
    </>
  );
}
