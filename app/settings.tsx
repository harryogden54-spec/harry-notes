import React, { useState } from "react";
import { View, ScrollView, SafeAreaView, Pressable, Switch, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";
import { ACCENT_OPTIONS, THEMES } from "@/lib/theme";
import { useTasks } from "@/lib/TasksContext";
import { useLists } from "@/lib/ListsContext";
import { useNotes } from "@/lib/NotesContext";
import { useToast } from "@/lib/ToastContext";
import { Text, Divider } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";

const STATUS_LABEL: Record<string, string> = {
  idle: "Not synced yet", syncing: "Syncing…", synced: "Up to date", error: "Sync error",
};
const STATUS_COLOR: Record<string, string> = {
  idle: "#9A9A9A", syncing: "#E8C84A", synced: "#3DD68C", error: "#F26464",
};

function SettingRow({ label, subtitle, right }: { label: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing[3], paddingHorizontal: spacing[4], gap: spacing[4] }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text size="sm" weight="medium">{label}</Text>
        {subtitle && <Text size="xs" secondary>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing[6] }}>
      <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: spacing[4], marginBottom: spacing[2] }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.bgSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

function SyncDot({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.idle;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
      <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: color }} />
      <Text size="xs" style={{ color }}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)  return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function SettingsScreen() {
  const { colors }                   = useTheme();
  const { scheme, toggle, accentId, setAccentId, themeId, setThemeId } = useThemeContext();
  const { syncStatus: taskSync, syncNow: syncTasks, tasks, clearCompleted, lastSynced: taskLastSynced } = useTasks();
  const { syncStatus: listSync, syncNow: syncLists, lists, lastSynced: listLastSynced } = useLists();
  const { syncStatus: noteSync, syncNow: syncNotes, notes, lastSynced: noteLastSynced } = useNotes();
  const { showToast } = useToast();
  const router = useRouter();
  const [clearing, setClearing] = useState(false);

  async function handleSyncNow() {
    await Promise.all([syncTasks(), syncLists(), syncNotes()]);
    showToast("Synced successfully");
  }

  const overallSync = taskSync === "error" || listSync === "error" || noteSync === "error" ? "error"
    : taskSync === "syncing" || listSync === "syncing" || noteSync === "syncing" ? "syncing"
    : taskSync === "synced"  && listSync === "synced"  && noteSync === "synced"  ? "synced"
    : "idle";

  const allSyncTimes = [taskLastSynced, listLastSynced, noteLastSynced].filter(Boolean) as string[];
  const lastSynced = allSyncTimes.length > 0
    ? new Date(Math.max(...allSyncTimes.map(t => new Date(t).getTime()))).toISOString()
    : null;

  const completedCount = tasks.filter(t => t.done).length;

  function handleClearCompleted() {
    if (completedCount === 0) { showToast("No completed tasks to clear"); return; }
    if (Platform.OS === "web") {
      // Web doesn't have Alert — use toast confirmation flow
      if (!clearing) {
        setClearing(true);
        showToast(`Clear ${completedCount} completed task${completedCount !== 1 ? "s" : ""}?`, {
          label: "Confirm", onPress: () => { clearCompleted(); setClearing(false); showToast("Cleared completed tasks"); },
        });
        setTimeout(() => setClearing(false), 4000);
      }
    } else {
      Alert.alert(
        "Clear completed tasks",
        `Permanently delete ${completedCount} completed task${completedCount !== 1 ? "s" : ""}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Clear", style: "destructive", onPress: () => { clearCompleted(); showToast("Cleared completed tasks"); } },
        ]
      );
    }
  }

  function handleExport() {
    const data = { exportedAt: new Date().toISOString(), tasks, lists };
    const json  = JSON.stringify(data, null, 2);

    if (Platform.OS === "web") {
      const blob = new Blob([json], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `harry-notes-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Export downloaded");
    } else {
      showToast("Export is only available on web for now");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ScrollView contentContainerStyle={{ padding: spacing[4], paddingTop: spacing[4], ...webContentStyle }}>

        {/* Header — matches tab page header style */}
        <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5] }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginBottom: spacing[2] }}>
            <Text size="sm" style={{ color: colors.accent }}>‹ Back</Text>
          </Pressable>
          <Text size="2xl" weight="bold">Settings</Text>
        </View>

        <Section title="Appearance">
          <SettingRow
            label="Dark mode"
            subtitle={scheme === "dark" ? "On" : "Off"}
            right={
              <Switch value={scheme === "dark"} onValueChange={toggle}
                trackColor={{ false: colors.bgBorder, true: colors.accent }} thumbColor="#fff" />
            }
          />
          <Divider />
          {/* Theme selector */}
          <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}>
            <Text size="xs" secondary style={{ marginBottom: spacing[2] }}>Theme</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {(Object.entries(THEMES) as [import("@/lib/theme").ThemeId, typeof THEMES[keyof typeof THEMES]][]).map(([id, def]) => {
                const active = themeId === id;
                const swatch = def.dark.bgSecondary;
                const accentSwatch = def.dark.accent;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setThemeId(id)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: spacing[1.5],
                      paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
                      borderRadius: radius.xl, borderWidth: active ? 2 : 1,
                      borderColor: active ? colors.accent : colors.bgBorder,
                      backgroundColor: active ? `${colors.accent}18` : colors.bgSecondary,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 3 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: swatch, borderWidth: 1, borderColor: `${swatch}80` }} />
                      <View style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: accentSwatch }} />
                    </View>
                    <Text size="xs" weight={active ? "semibold" : undefined} style={{ color: active ? colors.accent : colors.textSecondary }}>
                      {def.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Divider />
          {/* Accent override (only shown for default/Linear theme) */}
          {themeId === "default" && (
            <>
              <SettingRow
                label="Accent colour"
                subtitle={ACCENT_OPTIONS.find(a => a.id === accentId)?.label}
                right={
                  <View style={{ flexDirection: "row", gap: spacing[2] }}>
                    {ACCENT_OPTIONS.map(opt => {
                      const active = colors.accent === opt.color;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => setAccentId(opt.id)}
                          style={{
                            width: 24, height: 24, borderRadius: 99,
                            backgroundColor: opt.color,
                            borderWidth: active ? 2 : 0,
                            borderColor: active ? "#fff" : "transparent",
                            transform: [{ scale: active ? 1.2 : 1 }],
                          }}
                        />
                      );
                    })}
                  </View>
                }
              />
              <Divider />
            </>
          )}
          <Divider />
          {/* Live preview strip */}
          <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3], flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
            <View style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.lg, backgroundColor: colors.accent }}>
              <Text size="xs" weight="semibold" style={{ color: "#fff" }}>Button</Text>
            </View>
            <View style={{ paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.sm, backgroundColor: `${colors.accent}18`, borderWidth: 1, borderColor: `${colors.accent}40` }}>
              <Text size="xs" weight="medium" style={{ color: colors.accent }}>Badge</Text>
            </View>
            <View style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: colors.accent }} />
            <View style={{ flex: 1, height: 3, borderRadius: 99, backgroundColor: `${colors.accent}30` }}>
              <View style={{ width: "65%", height: 3, borderRadius: 99, backgroundColor: colors.accent }} />
            </View>
          </View>
        </Section>

        <Section title="Sync — Supabase">
          <SettingRow label="Status" right={<SyncDot status={overallSync} />} />
          <Divider />
          <SettingRow label="Tasks" right={<SyncDot status={taskSync} />} />
          <Divider />
          <SettingRow label="Lists" right={<SyncDot status={listSync} />} />
          <Divider />
          <SettingRow label="Notes" right={<SyncDot status={noteSync} />} />
          <Divider />
          <SettingRow label="Last synced" right={<Text size="xs" secondary>{formatRelativeTime(lastSynced)}</Text>} />
          <Divider />
          <SettingRow label="Project" subtitle="vbegnnwyrbxiqdnzvhwk · eu-north-1" />
          <Divider />
          <SettingRow
            label="Sync now"
            right={
              <Pressable onPress={handleSyncNow}
                style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, backgroundColor: colors.accent }}>
                <Text size="xs" weight="medium" style={{ color: "#fff" }}>Sync</Text>
              </Pressable>
            }
          />
        </Section>

        <Section title="Data">
          <SettingRow label="Tasks" right={<Text size="sm" secondary>{tasks.length} total · {completedCount} done</Text>} />
          <Divider />
          <SettingRow label="Lists" right={<Text size="sm" secondary>{lists.length} total</Text>} />
          <Divider />
          <SettingRow label="Notes" right={<Text size="sm" secondary>{notes.length} total</Text>} />
          <Divider />
          <SettingRow
            label="Clear completed tasks"
            subtitle={completedCount > 0 ? `${completedCount} task${completedCount !== 1 ? "s" : ""} will be deleted` : "No completed tasks"}
            right={
              <Pressable onPress={handleClearCompleted}
                style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: completedCount > 0 ? "#F2646444" : colors.bgBorder, backgroundColor: completedCount > 0 ? "#F2646410" : "transparent", opacity: completedCount > 0 ? 1 : 0.4 }}>
                <Text size="xs" style={{ color: completedCount > 0 ? "#F26464" : colors.textTertiary }}>Clear</Text>
              </Pressable>
            }
          />
          <Divider />
          <SettingRow
            label="Export data"
            subtitle="Download all tasks and lists as JSON"
            right={
              <Pressable onPress={handleExport}
                style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}>
                <Text size="xs" secondary>Export</Text>
              </Pressable>
            }
          />
        </Section>

        <Section title="About">
          <SettingRow label="Version" right={<Text size="sm" secondary>1.0.0</Text>} />
          <Divider />
          <SettingRow label="Stack" subtitle="Expo SDK 54 · React Native 0.81 · Supabase" />
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}
