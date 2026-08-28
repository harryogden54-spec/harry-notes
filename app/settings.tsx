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
import { useTasksData, useTasksActions } from "@/lib/TasksContext";
import { useNotesData, useNotesActions, type Note } from "@/lib/NotesContext";
import { notesToZip, pickMarkdownFiles } from "@/lib/notesExport";
import { useSyncAll } from "@/lib/useSyncStatus";
import { lastFailureFor, useSyncFailures } from "@/lib/syncLog";
import { useToast } from "@/lib/ToastContext";
import { Text, Divider, GradientBackground } from "@/components/ui";
import { SectionLabel, RowGroup, Row, SyncDot, formatRelativeTime } from "@/components/settings/rows";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";
import { getLocalDateStr } from "@/lib/utils";
import { getSyncKey, setSyncKey, generateSyncKey } from "@/lib/syncKey";
import { cryptoAvailable, encryptionEnabled, setEncryptionEnabled } from "@/lib/crypto";
import { reEncryptAll } from "@/lib/encryptExisting";

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors }     = useTheme();
  const { scheme, toggle, themeId, density, setDensity } = useThemeContext();
  // One source for sync state and the manual trigger, shared with the header
  // chip — see lib/useSyncStatus.ts.
  const { status: overallSync, lastSynced, domains: syncDomains, syncAll } = useSyncAll();
  // Subscription only — the per-domain lookup below reads the same store.
  useSyncFailures();
  const { tasks } = useTasksData();
  const { clearCompleted } = useTasksActions();
  const { notes } = useNotesData();
  const { bulkAddNotes } = useNotesActions();
  const { showToast } = useToast();
  const router = useRouter();
  const { unarchiveTask, deleteTask } = useTasksActions();
  const [clearing, setClearing]   = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  // ── Disclosures ───────────────────────────────────────────────────────────
  const [syncExpanded, setSyncExpanded]     = useState(false);
  const [backupExpanded, setBackupExpanded] = useState(false);

  // ── Sync key state ────────────────────────────────────────────────────────
  const [currentKey, setCurrentKey]   = useState<string | null>(null);
  const [showKeySheet, setShowKeySheet] = useState(false);

  // ── Encryption at rest ────────────────────────────────────────────────────
  const [encOn, setEncOn]             = useState(false);
  const [showEncSheet, setShowEncSheet] = useState(false);
  const [encBusy, setEncBusy]         = useState(false);
  const canEncrypt = cryptoAvailable();
  useEffect(() => { encryptionEnabled().then(setEncOn); }, []);

  async function handleToggleEncryption(next: boolean) {
    await setEncryptionEnabled(next);
    setEncOn(next);
    showToast(next
      ? "Encryption on — new writes are encrypted. Run \u201cEncrypt existing rows\u201d for older data."
      : "Encryption off — new writes go up as plain text.");
  }

  async function handleReEncrypt() {
    setEncBusy(true);
    const res = await reEncryptAll();
    setEncBusy(false);
    if (res.refused) { showToast(res.refused); return; }
    const total = Object.values(res.counts).reduce((a, b) => a + b, 0);
    showToast(res.ok
      ? `Re-encrypted ${total} row${total === 1 ? "" : "s"}`
      : `Partly done — ${res.failed.join(", ")} failed. Try again when back online.`);
  }
  const [keyInput, setKeyInput]       = useState("");
  const [keyVisible, setKeyVisible]   = useState(false);

  useEffect(() => {
    getSyncKey().then(k => setCurrentKey(k));
  }, []);

  async function handleSaveKey() {
    const trimmed = keyInput.trim().toUpperCase();
    await setSyncKey(trimmed);
    setCurrentKey(trimmed || null);
    setShowKeySheet(false);
    setKeyInput("");
    showToast(trimmed ? "Sync key saved — enter the same key on your other devices" : "Sync key cleared");
  }

  async function handleGenerateKey() {
    const key = generateSyncKey();
    setKeyInput(key);
    await setSyncKey(key);
    setCurrentKey(key);
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

  const completedCount = tasks.filter(t => t.done).length;
  const currentTheme   = THEMES[themeId];

  async function handleSyncNow() {
    // Single shared trigger (lib/useSyncStatus.ts) — the same one the header
    // chip uses, so there is no second sync path to keep in step. It is the
    // reconciliation path: full fetch per domain, ignoring the delta cursor.
    const ok = await syncAll();
    // Don't claim success when a domain failed — the old toast said "Synced
    // successfully" unconditionally, hiding real errors (e.g. RLS rejections).
    showToast(ok
      ? "Synced successfully"
      : "Some items couldn't sync — check the status above and try again");
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
              right={
                <Switch
                  value={scheme === "dark"}
                  onValueChange={toggle}
                  trackColor={{ false: colors.bgBorder, true: colors.accent }}
                  thumbColor={colors.textInverse}
                />
              }
            />
            {/* How much air lists get. The right answer depends on how many
                tasks you are looking at, so it is yours to set rather than a
                value picked centrally. */}
            <Row
              icon="reorder-three-outline"
              label="Density"
              subtitle={density === "compact" ? "Compact — more on screen" : "Comfortable — more air"}
              isLast
              right={
                <View style={{ flexDirection: "row", gap: spacing[1], alignItems: "center" }}>
                  {(["comfortable", "compact"] as const).map(opt => {
                    const active = density === opt;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => setDensity(opt)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={{
                          paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
                          borderRadius: 999, borderWidth: 1,
                          borderColor: active ? colors.accent : colors.bgBorder,
                          backgroundColor: active ? `${colors.accent}18` : "transparent",
                        }}
                      >
                        <Text size="meta" weight="medium" style={{ color: active ? colors.accent : colors.textSecondary }}>
                          {opt === "comfortable" ? "Comfortable" : "Compact"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              }
            />
          </RowGroup>

          {/* ── Sync ─────────────────────────────────────────────────────────
              Status, last-synced and the per-collection dots were four rows
              carrying one piece of information. One row now; the breakdown
              (and the Supabase project) is behind the disclosure. */}
          <SectionLabel>Sync</SectionLabel>
          <RowGroup>
            <Row
              icon="cloud-outline"
              label="Sync status"
              subtitle={lastSynced ? `Last synced ${formatRelativeTime(lastSynced).toLowerCase()}` : "Never synced"}
              onPress={() => setSyncExpanded(v => !v)}
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                  <SyncDot status={overallSync} />
                  <Ionicons
                    name={syncExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={colors.textTertiary}
                  />
                </View>
              }
            />
            {syncExpanded && (
              <View style={{ backgroundColor: colors.bgTertiary }}>
                {syncDomains.map(d => {
                  // Show the reason, not just the dot. Only while the domain is
                  // actually failing: the log keeps entries after a domain
                  // recovers, and a stale message next to a green dot reads as a
                  // live problem. See lib/syncLog.ts.
                  const failure = d.status === "error" ? lastFailureFor(d.table) : null;
                  return (
                    <Row
                      key={d.label}
                      label={d.label}
                      subtitle={failure ? `${failure.op} — ${failure.message}` : undefined}
                      right={<SyncDot status={d.status} />}
                    />
                  );
                })}
                <Row label="Project" subtitle="vbegnnwyrbxiqdnzvhwk · eu-north-1" />
              </View>
            )}
            {/* One row for the whole key story — the bare status row it replaced
                said nothing the subtitle can't. */}
            <Row
              icon="key-outline"
              label="Sync key"
              subtitle={
                currentKey
                  ? `${currentKey.slice(0, 4)}-••••-•••• · tap to change or copy`
                  : "Not set — this device is offline-only"
              }
              onPress={() => { setKeyInput(currentKey ?? ""); setShowKeySheet(true); }}
              chevron
            />
            <Row
              icon="lock-closed-outline"
              label="Encryption at rest"
              subtitle={
                !canEncrypt
                  ? "Unavailable on this device"
                  : encOn
                    ? "On — rows are unreadable in the database"
                    : "Off — your text is stored as plain words"
              }
              onPress={() => setShowEncSheet(true)}
              chevron
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
            {/* Export/import live behind one disclosure. JSON is demoted to sit
                with the rest, not removed: Markdown is lossy (no recurrence
                rules, priorities, subtask relationships, ids or timestamps), so
                JSON is the only full-fidelity backup. */}
            <Row
              icon="cloud-download-outline"
              label="Backup & export"
              subtitle="JSON, Markdown, .zip · import notes"
              onPress={() => setBackupExpanded(v => !v)}
              right={
                <Ionicons
                  name={backupExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={colors.textTertiary}
                />
              }
              isLast={!backupExpanded}
            />
            {backupExpanded && (
              <View style={{ backgroundColor: colors.bgTertiary }}>
                <Row icon="document-outline"      label="Export as JSON"      subtitle="Full-fidelity backup of everything" onPress={handleExportJSON}     chevron />
                <Row icon="document-text-outline" label="Export as Markdown"  subtitle="Notes + tasks as .md (lossy)"       onPress={handleExportMarkdown} chevron />
                <Row icon="albums-outline"        label="Export notes (.zip)" subtitle="One .md file per note"              onPress={handleExportNotesZip} chevron />
                <Row icon="download-outline"      label="Import notes"        subtitle="Pick .md files — one note each"     onPress={handleImportNotes}    chevron isLast />
              </View>
            )}
          </RowGroup>

          {/* ── Bulk actions ─────────────────────────────────────────────────
              Archiving every completed task is a bulk mutation; it was styled
              as an ordinary Data row next to read-only counts. Its own group,
              away from anything you'd tap casually. (It already confirms —
              native Alert, web toast-confirm.) */}
          <SectionLabel>Bulk actions</SectionLabel>
          <RowGroup>
            <Row
              icon="checkmark-done-outline"
              label="Archive completed tasks"
              subtitle={completedCount > 0 ? `${completedCount} task${completedCount !== 1 ? "s" : ""} will be archived — asks first` : "No completed tasks"}
              danger={completedCount > 0}
              onPress={handleClearCompleted}
              isLast
            />
          </RowGroup>

          {/* Encryption at rest. Behind a sheet rather than a bare switch: the
              consequence (losing the sync key destroys the data) has to be
              read before it is accepted, and a toggle in a list is not read. */}
          <Modal visible={showEncSheet} animationType="none" presentationStyle="pageSheet" onRequestClose={() => setShowEncSheet(false)}>
            <GradientBackground>
              <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                    <Text size="lg" weight="bold" style={{ flex: 1 }}>Encryption at rest</Text>
                    <Pressable onPress={() => setShowEncSheet(false)} hitSlop={8} accessibilityLabel="Close">
                      <Ionicons name="close-outline" size={22} color={colors.textSecondary} />
                    </Pressable>
                  </View>

                  <Text size="sm" secondary style={{ lineHeight: 21 }}>
                    Your rows currently sit in Supabase as plain words — anyone who gets at the
                    database can read your journal. With this on, your device scrambles each row
                    before uploading it and unscrambles it on the way back. The server only ever
                    holds gibberish.
                  </Text>

                  <View style={{
                    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger,
                    backgroundColor: `${colors.danger}12`, padding: spacing[3], gap: spacing[1.5],
                  }}>
                    <Text size="sm" weight="semibold" style={{ color: colors.danger }}>
                      Save your sync key somewhere permanent first
                    </Text>
                    <Text size="xs" secondary style={{ lineHeight: 18 }}>
                      The scrambling key is derived from your sync key. Today, losing that key
                      means you cannot find your rows — the text is still there. Once this is on,
                      losing it means the data is gone for good. Nobody can recover it, including
                      Supabase.
                    </Text>
                  </View>

                  <Text size="xs" tertiary style={{ lineHeight: 18 }}>
                    Worth knowing: your sync key is sent to Supabase as a request header, which is
                    how it finds your rows. So this protects you against a stolen copy of the
                    database, not against Supabase itself. Note photos are stored separately and
                    stay unencrypted.
                  </Text>

                  <RowGroup>
                    <Row
                      label="Encrypt new writes"
                      subtitle={canEncrypt ? undefined : "This device has no WebCrypto"}
                      right={
                        <Switch
                          value={encOn}
                          onValueChange={handleToggleEncryption}
                          disabled={!canEncrypt}
                          trackColor={{ false: colors.bgTertiary, true: colors.accent }}
                        />
                      }
                      isLast
                    />
                  </RowGroup>

                  <View style={{ gap: spacing[2] }}>
                    <Pressable
                      onPress={handleReEncrypt}
                      disabled={!encOn || encBusy}
                      style={{
                        backgroundColor: encOn && !encBusy ? colors.accent : colors.bgTertiary,
                        borderRadius: radius.xl, paddingVertical: spacing[3], alignItems: "center",
                      }}
                    >
                      <Text size="sm" weight="semibold" style={{ color: encOn && !encBusy ? colors.textInverse : colors.textTertiary }}>
                        {encBusy ? "Encrypting…" : "Encrypt existing rows"}
                      </Text>
                    </Pressable>
                    <Text size="xs" tertiary style={{ lineHeight: 18 }}>
                      Turning the switch on only affects what you write from now on. This rewrites
                      everything already up there. Safe to run more than once.
                    </Text>
                  </View>
                </ScrollView>
              </SafeAreaView>
            </GradientBackground>
          </Modal>

          {/* Sync key sheet — set/change, generate and copy in one place, so the
              settings list carries a single row instead of four. */}
          <Modal visible={showKeySheet} animationType="none" presentationStyle="pageSheet" onRequestClose={() => setShowKeySheet(false)}>
            <GradientBackground>
              <SafeAreaView style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.bgBorder }}>
                  <Text size="lg" weight="bold" style={{ flex: 1 }}>Sync key</Text>
                  <Pressable onPress={() => setShowKeySheet(false)} hitSlop={12}>
                    <Text size="sm" style={{ color: colors.accent }}>Done</Text>
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8], gap: spacing[4] }}>
                  <Text size="xs" style={{ color: colors.textTertiary }}>
                    All devices sharing this key see the same data. Leave it blank to
                    turn sync off and keep this device offline-only.
                  </Text>

                  <View style={{ gap: spacing[2] }}>
                    <TextInput
                      value={keyInput}
                      onChangeText={t => setKeyInput(t.toUpperCase())}
                      placeholder="e.g. ABCD-EFGH-IJKL"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      secureTextEntry={!keyVisible && Platform.OS !== "web"}
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
                    <Pressable onPress={handleSaveKey} style={{
                      paddingVertical: spacing[2.5], borderRadius: radius.md,
                      backgroundColor: colors.accent, alignItems: "center",
                    }}>
                      <Text size="sm" weight="semibold" style={{ color: colors.textInverse }}>Save key</Text>
                    </Pressable>
                  </View>

                  <RowGroup>
                    <Row
                      icon="shuffle-outline"
                      label="Generate new key"
                      subtitle="Random key, set here — then enter it on your other devices"
                      onPress={handleGenerateKey}
                    />
                    <Row
                      icon="copy-outline"
                      label="Copy current key"
                      subtitle={currentKey ? "Paste it on your other devices" : "No key set yet"}
                      onPress={currentKey ? handleCopyKey : undefined}
                    />
                    <Row
                      icon={keyVisible ? "eye-off-outline" : "eye-outline"}
                      label={keyVisible ? "Hide key" : "Reveal key"}
                      subtitle={currentKey ? (keyVisible ? currentKey : `${currentKey.slice(0, 4)}-••••-••••`) : "No key set yet"}
                      onPress={() => setKeyVisible(v => !v)}
                      isLast
                    />
                  </RowGroup>
                </ScrollView>
              </SafeAreaView>
            </GradientBackground>
          </Modal>

          {/* Trash modal */}
          <Modal visible={showTrash} animationType="none" presentationStyle="pageSheet" onRequestClose={() => setShowTrash(false)}>
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

          {/* Two rows of static text didn't need a card. The version string
              stays because it's what you check when two devices disagree. */}
          <Text size="xs" style={{ color: colors.textTertiary, textAlign: "center", marginTop: spacing[2] }}>
            v1.0.0 · Expo SDK 54 · React Native 0.81
          </Text>

        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
