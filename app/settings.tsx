import React, { useState, useEffect } from "react";
import {
  View, ScrollView, SafeAreaView, Pressable,
  Platform, Alert, Switch, Modal, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";
import { THEMES } from "@/lib/theme";
import { useTasksData, useTasksActions, useTasksSync } from "@/lib/TasksContext";
import { useListsSync } from "@/lib/ListsContext";
import { useNotesData, useNotesActions, useNotesSync, type Note } from "@/lib/NotesContext";
import { notesToZip, pickMarkdownFiles } from "@/lib/notesExport";
import { useCoursesSync } from "@/lib/CoursesContext";
import { useDumpsSync } from "@/lib/DumpContext";
import { useToast } from "@/lib/ToastContext";
import { Text, Divider, GradientBackground } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";
import { getLocalDateStr } from "@/lib/utils";
import { getSyncKey, setSyncKey, generateSyncKey } from "@/lib/syncKey";

// ─── Shared row primitives ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text size="xs" weight="semibold" style={{
      textTransform: "uppercase", letterSpacing: 1.2,
      color: colors.textTertiary,
      paddingHorizontal: spacing[1],
      marginBottom: spacing[1.5], marginTop: spacing[1],
    }}>
      {children}
    </Text>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.bgSecondary,
      borderRadius: radius.xl,
      borderWidth: 1, borderColor: colors.bgBorder,
      overflow: "hidden",
      marginBottom: spacing[5],
    }}>
      {children}
    </View>
  );
}

function Row({
  icon, label, subtitle, right, onPress, chevron = false, danger = false, isLast = false,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
  isLast?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <View style={{
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing[4], paddingVertical: spacing[3],
      gap: spacing[3],
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: colors.bgBorder,
    }}>
      {icon && (
        <View style={{
          width: 30, height: 30, borderRadius: radius.md,
          backgroundColor: `${colors.accent}18`,
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name={icon} size={16} color={colors.accent} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text size="sm" weight="medium" style={{ color: danger ? colors.danger : colors.textPrimary }}>
          {label}
        </Text>
        {subtitle && (
          <Text size="xs" style={{ color: colors.textTertiary }}>{subtitle}</Text>
        )}
      </View>
      {right}
      {chevron && (
        <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

function SyncDot({ status }: { status: string }) {
  const { colors } = useTheme();
  const statusColor: Record<string, string> = {
    idle:    colors.textSecondary,
    syncing: colors.warning,
    synced:  colors.success,
    error:   colors.danger,
  };
  const label: Record<string, string> = {
    idle: "Not synced yet", syncing: "Syncing…", synced: "Up to date", error: "Sync error",
  };
  const color = statusColor[status] ?? statusColor.idle;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
      <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: color }} />
      <Text size="xs" style={{ color }}>{label[status] ?? status}</Text>
    </View>
  );
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)    return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors }     = useTheme();
  const { scheme, toggle, themeId } = useThemeContext();
  const { syncStatus: taskSync, syncNow: syncTasks, lastSynced: taskLastSynced } = useTasksSync();
  const { tasks } = useTasksData();
  const { clearCompleted } = useTasksActions();
  const { syncStatus: listSync, syncNow: syncLists, lastSynced: listLastSynced } = useListsSync();
  const { syncStatus: noteSync, syncNow: syncNotes, lastSynced: noteLastSynced } = useNotesSync();
  const { syncStatus: courseSync, syncNow: syncCourses, lastSynced: courseLastSynced } = useCoursesSync();
  const { syncNow: syncDumps } = useDumpsSync();
  const { notes } = useNotesData();
  const { bulkAddNotes } = useNotesActions();
  const { showToast } = useToast();
  const router = useRouter();
  const { unarchiveTask, deleteTask } = useTasksActions();
  const [clearing, setClearing]   = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  // ── Sync key state ────────────────────────────────────────────────────────
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState(false);
  const [keyInput, setKeyInput]     = useState("");
  const [keyVisible, setKeyVisible] = useState(false);

  useEffect(() => {
    getSyncKey().then(k => setCurrentKey(k));
  }, []);

  async function handleSaveKey() {
    const trimmed = keyInput.trim().toUpperCase();
    await setSyncKey(trimmed);
    setCurrentKey(trimmed || null);
    setEditingKey(false);
    setKeyInput("");
    showToast(trimmed ? "Sync key saved — enter the same key on your other devices" : "Sync key cleared");
  }

  async function handleGenerateKey() {
    const key = generateSyncKey();
    setKeyInput(key);
    await setSyncKey(key);
    setCurrentKey(key);
    setEditingKey(false);
    showToast("New sync key generated — enter this key on your other devices");
  }

  function handleCopyKey() {
    if (!currentKey) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      navigator.clipboard?.writeText(currentKey).then(() => showToast("Sync key copied"));
    } else {
      showToast("Copy the key shown above");
    }
  }

  const domainStatuses = [taskSync, listSync, noteSync, courseSync];
  const overallSync = domainStatuses.includes("error") ? "error"
    : domainStatuses.includes("syncing") ? "syncing"
    : domainStatuses.every(s => s === "synced") ? "synced"
    : "idle";

  const allSyncTimes = [taskLastSynced, listLastSynced, noteLastSynced, courseLastSynced].filter(Boolean) as string[];
  const lastSynced   = allSyncTimes.length > 0
    ? new Date(Math.max(...allSyncTimes.map(t => new Date(t).getTime()))).toISOString()
    : null;

  const completedCount = tasks.filter(t => t.done).length;
  const currentTheme   = THEMES[themeId];

  async function handleSyncNow() {
    // Manual sync is the reconciliation path: full fetch, ignoring the delta
    // cursor, so it can repair any divergence the incremental sync missed.
    // Covers every synced domain (lists/dumps/courses were previously missed).
    await Promise.all([
      syncTasks({ full: true }), syncNotes({ full: true }),
      syncLists({ full: true }), syncDumps({ full: true }), syncCourses({ full: true }),
    ]);
    showToast("Synced successfully");
  }

  function handleClearCompleted() {
    if (completedCount === 0) { showToast("No completed tasks to archive"); return; }
    if (Platform.OS === "web") {
      if (!clearing) {
        setClearing(true);
        showToast(`Archive ${completedCount} completed task${completedCount !== 1 ? "s" : ""}?`, {
          label: "Confirm",
          onPress: () => { clearCompleted(); setClearing(false); showToast("Archived completed tasks"); },
        });
        setTimeout(() => setClearing(false), 4000);
      }
    } else {
      Alert.alert(
        "Archive completed tasks",
        `Move ${completedCount} completed task${completedCount !== 1 ? "s" : ""} to the archive?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Archive", style: "destructive", onPress: () => { clearCompleted(); showToast("Archived completed tasks"); } },
        ]
      );
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJSON() {
    if (Platform.OS !== "web") { showToast("Export is only available on web"); return; }
    const data = { exportedAt: new Date().toISOString(), tasks, notes };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `harry-notes-${getLocalDateStr()}.json`);
    showToast("JSON export downloaded");
  }

  function handleExportMarkdown() {
    if (Platform.OS !== "web") { showToast("Export is only available on web"); return; }
    const date = getLocalDateStr();
    let md = `# harry-notes export — ${date}\n\n`;
    md += `## Tasks\n\n`;
    tasks.filter(t => !t.archived).forEach(t => {
      md += `- [${t.done ? "x" : " "}] ${t.title}`;
      if (t.due_date) md += ` (due ${t.due_date})`;
      if (t.description) md += `\n  > ${t.description}`;
      md += "\n";
    });
    md += `\n## Notes\n\n`;
    notes.filter(n => n.type === "note" || !n.type).forEach(n => {
      md += `### ${n.title || "Untitled"}\n\n`;
      if (n.blocks && n.blocks.length > 0) {
        n.blocks.forEach(b => {
          if (b.type === "heading")  md += `## ${b.content}\n`;
          else if (b.type === "bullet") md += `- ${b.content}\n`;
          else if (b.type === "checkbox") md += `- [${b.checked ? "x" : " "}] ${b.content}\n`;
          else md += `${b.content}\n`;
        });
      } else {
        md += `${n.body}`;
      }
      md += `\n\n---\n\n`;
    });
    downloadBlob(new Blob([md], { type: "text/markdown" }), `harry-notes-${date}.md`);
    showToast("Markdown export downloaded");
  }

  function handleExportNotesZip() {
    if (Platform.OS !== "web") { showToast("Export is only available on web"); return; }
    downloadBlob(notesToZip(notes), `harry-notes-${getLocalDateStr()}.zip`);
    showToast("Notes exported");
  }

  async function handleImportNotes() {
    if (Platform.OS !== "web") { showToast("Import is only available on web"); return; }
    const files = await pickMarkdownFiles();
    if (files.length === 0) return;
    const now = new Date().toISOString();
    bulkAddNotes(files.map((f): Note => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: f.title, body: f.body, pinned: false, type: "note",
      created_at: now, updated_at: now,
    })));
    showToast(`Imported ${files.length} note${files.length !== 1 ? "s" : ""}`);
  }

  const archivedTasks = tasks.filter(t => t.archived);

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[{ padding: spacing[4], paddingBottom: spacing[16] }, webContentStyle]}>

          {/* Header */}
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5] }}>
            <Pressable onPress={() => router.back()} hitSlop={12}
              style={{ marginBottom: spacing[2], flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}>
              <Ionicons name="chevron-back" size={16} color={colors.accent} />
              <Text size="sm" style={{ color: colors.accent }}>Back</Text>
            </Pressable>
            <Text size="2xl" weight="bold">Settings</Text>
          </View>

          {/* ── Appearance ───────────────────────────────────────────────── */}
          <SectionLabel>Appearance</SectionLabel>
          <RowGroup>
            <Row
              icon="color-palette-outline"
              label="Theme & Colours"
              subtitle={`${currentTheme.label} · ${scheme === "dark" ? "Dark" : "Light"}`}
              onPress={() => router.push("/settings/appearance" as any)}
              chevron
            />
            <Row
              icon={scheme === "dark" ? "moon-outline" : "sunny-outline"}
              label="Dark mode"
              isLast
              right={
                <Switch
                  value={scheme === "dark"}
                  onValueChange={toggle}
                  trackColor={{ false: colors.bgBorder, true: colors.accent }}
                  thumbColor={colors.textInverse}
                />
              }
            />
          </RowGroup>

          {/* ── Sync key ─────────────────────────────────────────────────── */}
          <SectionLabel>Sync Key</SectionLabel>
          <RowGroup>
            <Row
              icon="key-outline"
              label="Sync key"
              subtitle={
                currentKey
                  ? (keyVisible ? currentKey : `${currentKey.slice(0, 4)}-••••-••••`)
                  : "Not set — this device is offline-only"
              }
              right={
                currentKey ? (
                  <Pressable onPress={() => setKeyVisible(v => !v)} hitSlop={8}>
                    <Ionicons name={keyVisible ? "eye-off-outline" : "eye-outline"} size={16} color={colors.textTertiary} />
                  </Pressable>
                ) : undefined
              }
            />
            {currentKey && (
              <Row
                icon="copy-outline"
                label="Copy key"
                subtitle="Paste this on your other devices"
                onPress={handleCopyKey}
                chevron={Platform.OS === "web"}
              />
            )}
            <Row
              icon="create-outline"
              label={currentKey ? "Change key" : "Set sync key"}
              subtitle="Enter the same key on every device you own"
              onPress={() => { setKeyInput(currentKey ?? ""); setEditingKey(true); }}
              chevron
            />
            <Row
              icon="shuffle-outline"
              label="Generate new key"
              subtitle="Creates a random key and sets it here"
              onPress={handleGenerateKey}
              isLast
            />
          </RowGroup>

          {/* Inline key editor */}
          {editingKey && (
            <View style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.xl,
              borderWidth: 1, borderColor: colors.accent,
              padding: spacing[4],
              marginTop: -spacing[4],
              marginBottom: spacing[5],
              gap: spacing[3],
            }}>
              <Text size="xs" style={{ color: colors.textTertiary }}>
                Enter your sync key — use the same key on every device. Leave blank to disable sync.
              </Text>
              <TextInput
                value={keyInput}
                onChangeText={t => setKeyInput(t.toUpperCase())}
                placeholder="e.g. ABCD-EFGH-IJKL"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{
                  backgroundColor: colors.bgTertiary,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.bgBorder,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2.5],
                  color: colors.textPrimary,
                  fontFamily: fontFamily.medium,
                  fontSize: 15,
                  letterSpacing: 1,
                }}
              />
              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                <Pressable
                  onPress={() => { setEditingKey(false); setKeyInput(""); }}
                  style={{
                    flex: 1, paddingVertical: spacing[2.5], borderRadius: radius.md,
                    borderWidth: 1, borderColor: colors.bgBorder, alignItems: "center",
                  }}
                >
                  <Text size="sm" style={{ color: colors.textSecondary }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveKey}
                  style={{
                    flex: 2, paddingVertical: spacing[2.5], borderRadius: radius.md,
                    backgroundColor: colors.accent, alignItems: "center",
                  }}
                >
                  <Text size="sm" weight="semibold" style={{ color: colors.textInverse }}>Save key</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Sync ─────────────────────────────────────────────────────── */}
          <SectionLabel>Sync — Supabase</SectionLabel>
          <RowGroup>
            <Row label="Status"      right={<SyncDot status={overallSync} />} />
            <Row label="Last synced" right={<Text size="xs" style={{ color: colors.textSecondary }}>{formatRelativeTime(lastSynced)}</Text>} />
            <Row label="Tasks"       right={<SyncDot status={taskSync} />} />
            <Row label="Notes"       right={<SyncDot status={noteSync} />} />
            <Row
              label="Project"
              subtitle="vbegnnwyrbxiqdnzvhwk · eu-north-1"
              isLast
            />
          </RowGroup>
          <View style={{ marginBottom: spacing[5] }}>
            <Pressable
              onPress={handleSyncNow}
              style={{
                backgroundColor: colors.accent,
                borderRadius: radius.xl,
                paddingVertical: spacing[3],
                alignItems: "center",
              }}
            >
              <Text size="sm" weight="semibold" style={{ color: colors.textInverse }}>Sync now</Text>
            </Pressable>
          </View>

          {/* ── Data ─────────────────────────────────────────────────────── */}
          <SectionLabel>Data</SectionLabel>
          <RowGroup>
            <Row label="Tasks" right={<Text size="sm" style={{ color: colors.textSecondary }}>{tasks.filter(t => !t.archived).length} active · {completedCount} done</Text>} />
            <Row label="Notes" right={<Text size="sm" style={{ color: colors.textSecondary }}>{notes.length} total</Text>} />
            <Row icon="archive-outline" label="Trash / Archive" subtitle={archivedTasks.length > 0 ? `${archivedTasks.length} archived task${archivedTasks.length !== 1 ? "s" : ""}` : "Empty"} onPress={() => setShowTrash(true)} chevron />
            <Row icon="document-outline"      label="Export as JSON"     subtitle="Download all data as JSON"     onPress={handleExportJSON}     chevron />
            <Row icon="document-text-outline" label="Export as Markdown" subtitle="Download notes + tasks as .md" onPress={handleExportMarkdown} chevron />
            <Row icon="albums-outline"        label="Export notes (.zip)" subtitle="One .md file per note"        onPress={handleExportNotesZip} chevron />
            <Row icon="download-outline"      label="Import notes"        subtitle="Pick .md files — one note each" onPress={handleImportNotes}  chevron />
            <Row
              label="Archive completed tasks"
              subtitle={completedCount > 0 ? `${completedCount} task${completedCount !== 1 ? "s" : ""} will be archived` : "No completed tasks"}
              danger={completedCount > 0}
              onPress={handleClearCompleted}
              isLast
            />
          </RowGroup>

          {/* Trash modal */}
          <Modal visible={showTrash} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTrash(false)}>
            <GradientBackground>
              <SafeAreaView style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.bgBorder }}>
                  <Text size="lg" weight="bold" style={{ flex: 1 }}>Trash</Text>
                  <Pressable onPress={() => setShowTrash(false)} hitSlop={12}>
                    <Text size="sm" style={{ color: colors.accent }}>Done</Text>
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}>
                  {archivedTasks.length === 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: spacing[12] }}>
                      <Ionicons name="trash-outline" size={36} color={colors.textTertiary} style={{ marginBottom: spacing[2] }} />
                      <Text size="sm" secondary>No archived tasks</Text>
                    </View>
                  ) : (
                    <View style={{ gap: spacing[2] }}>
                      {archivedTasks.map(t => (
                        <View key={t.id} style={{ backgroundColor: colors.bgSecondary, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.bgBorder, padding: spacing[4], flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                          <View style={{ flex: 1 }}>
                            <Text size="sm" weight="medium" numberOfLines={1} style={{ color: colors.textPrimary }}>{t.title}</Text>
                            {t.completed_at && (
                              <Text size="xs" style={{ color: colors.textTertiary, marginTop: 2 }}>
                                Completed {new Date(t.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              </Text>
                            )}
                          </View>
                          <Pressable
                            onPress={() => { unarchiveTask(t.id); showToast("Task restored"); }}
                            style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent }}
                          >
                            <Text size="xs" style={{ color: colors.accent }}>Restore</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => { deleteTask(t.id); showToast("Task deleted"); }}
                            style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.danger }}
                          >
                            <Text size="xs" style={{ color: colors.danger }}>Delete</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </SafeAreaView>
            </GradientBackground>
          </Modal>

          {/* ── About ────────────────────────────────────────────────────── */}
          <SectionLabel>About</SectionLabel>
          <RowGroup>
            <Row label="Version" right={<Text size="sm" style={{ color: colors.textSecondary }}>1.0.0</Text>} />
            <Row label="Stack" subtitle="Expo SDK 54 · React Native 0.81 · Supabase" isLast />
          </RowGroup>

        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
