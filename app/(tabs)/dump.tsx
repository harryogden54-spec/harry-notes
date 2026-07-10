import React, { useState, useCallback, useEffect, useRef } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, ScrollView, Modal,
  Pressable, Platform, RefreshControl, TextInput as RNTextInput,
} from "react-native";
// Side-notch padding only — PersistentHeader owns the top inset, MobileTabBar the bottom.
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { Text, GradientBackground, EmptyState, DatePicker } from "@/components/ui";
import { spacing, radius, fontFamily, getShadow } from "@/lib/theme";
import { useDumpsData, useDumpsActions, useDumpsSync, type DumpTag } from "@/lib/DumpContext";
import { useToast } from "@/lib/ToastContext";
import { getLocalDateStr } from "@/lib/utils";
import { storage } from "@/lib/storage";

const HIDE_FILED_KEY = "dump_hide_filed";

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateStr(d);
}

// Compact date row — quick chips for the common cases (today, yesterday)
// with the full month-grid DatePicker only shown on demand. A dump capture
// is meant to be frictionless; a ~360x495px calendar by default undercut
// that.
function CompactDateSelector({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const today     = getLocalDateStr();
  const yesterday = getYesterdayStr();
  const presets = [
    { label: "Today", date: today },
    { label: "Yesterday", date: yesterday },
  ];
  const isPreset = presets.some(p => p.date === value);

  return (
    <View style={{ gap: spacing[1.5] }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5], alignItems: "center" }}>
        {presets.map(p => (
          <Pressable
            key={p.date}
            onPress={() => { onChange(p.date); setShowPicker(false); }}
            style={{
              paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
              borderRadius: radius["2xl"], borderWidth: 1,
              borderColor: value === p.date ? colors.accent : colors.bgBorder,
              backgroundColor: value === p.date ? `${colors.accent}18` : "transparent",
            }}
          >
            <Text size="xs" style={{ color: value === p.date ? colors.accent : colors.textSecondary }}>{p.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setShowPicker(v => !v)}>
          <Text size="xs" style={{ color: !isPreset ? colors.accent : colors.textTertiary }}>
            {!isPreset ? value : "Pick date…"}
          </Text>
        </Pressable>
      </View>
      {showPicker && <DatePicker value={value} onChange={d => { onChange(d ?? today); setShowPicker(false); }} />}
    </View>
  );
}

const TAG_LABELS: Record<DumpTag, string> = {
  journal:   "Journal",
  media:     "Media",
  knowledge: "Knowledge",
  todo:      "Todo",
};

const TAGS: DumpTag[] = ["journal", "media", "knowledge", "todo"];

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function DumpEditModal({
  id, initialContent, initialTag, initialDate, onClose, onDelete,
}: {
  id: string;
  initialContent: string;
  initialTag: DumpTag;
  initialDate: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { updateDump } = useDumpsActions();
  const { colors, scheme } = useTheme();
  const [content, setContent] = useState(initialContent);
  const [tag, setTag]         = useState<DumpTag>(initialTag);
  const [date, setDate]       = useState(initialDate);
  const inputRef = useRef<RNTextInput | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  function save() {
    const v = content.trim();
    if (!v) {
      onDelete();
    } else {
      updateDump(id, { content: v, tag, note_date: date });
    }
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={save}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: spacing[6] }}
        onPress={save}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: 360, maxWidth: "95%" as any,
            backgroundColor: colors.bgSecondary,
            borderRadius: radius["2xl"],
            borderWidth: 1, borderColor: colors.bgBorder,
            padding: spacing[5],
            ...getShadow("overlay", scheme),
          }}
        >
          {/* Tag pills */}
          <View style={{ flexDirection: "row", gap: spacing[2], marginBottom: spacing[4], flexWrap: "wrap" }}>
            {TAGS.map(t => (
              <Pressable
                key={t}
                onPress={() => setTag(t)}
                style={{
                  paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
                  borderRadius: radius["2xl"],
                  backgroundColor: tag === t ? colors.accent : colors.bgTertiary,
                  borderWidth: 1,
                  borderColor: tag === t ? colors.accent : colors.bgBorder,
                }}
              >
                <Text size="xs" weight="medium" style={{ color: tag === t ? colors.textInverse : colors.textSecondary }}>
                  {TAG_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Date */}
          <View style={{ marginBottom: spacing[4] }}>
            <CompactDateSelector value={date} onChange={setDate} />
          </View>

          {/* Text input */}
          <RNTextInput
            ref={inputRef}
            value={content}
            onChangeText={setContent}
            placeholder="Dump something…"
            placeholderTextColor={colors.textTertiary}
            multiline
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={save}
            style={[
              {
                color: colors.textPrimary,
                fontSize: 15,
                fontFamily: fontFamily.regular,
                lineHeight: 22,
                minHeight: 100,
                textAlignVertical: "top",
              },
              { outlineStyle: "none" } as any,
            ]}
          />

          {/* Footer */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing[4] }}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onDelete();
                onClose();
              }}
              hitSlop={12}
              style={{ padding: spacing[1] }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
            </Pressable>
            <Pressable
              onPress={save}
              style={{
                paddingHorizontal: spacing[4], paddingVertical: spacing[2],
                borderRadius: radius.lg,
                backgroundColor: colors.accent,
              }}
            >
              <Text size="sm" weight="semibold" style={{ color: colors.textInverse }}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Dump Card ────────────────────────────────────────────────────────────────

function DumpCard({ content, tag, note_date, filed, onPress }: {
  content: string; tag: DumpTag; note_date: string; filed: boolean; onPress: () => void;
}) {
  const { colors, scheme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.bgBorder,
        padding: spacing[4],
        gap: spacing[2],
        ...getShadow("xs", scheme),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{
          paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
          borderRadius: radius["2xl"],
          backgroundColor: colors.bgTertiary,
          borderWidth: 1, borderColor: colors.bgBorder,
        }}>
          <Text size="xs" weight="medium" secondary>{TAG_LABELS[tag]}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
          {filed && <Ionicons name="checkmark-circle" size={14} color={colors.accent} />}
          {note_date ? <Text size="xs" secondary>{note_date}</Text> : null}
        </View>
      </View>
      <Text size="sm" numberOfLines={4} style={{ color: content ? colors.textPrimary : colors.textTertiary, lineHeight: 20 }}>
        {content || "Empty…"}
      </Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

function DumpScreen() {
  const { colors } = useTheme();
  const { dumps, loaded } = useDumpsData();
  const { addDump, deleteDump } = useDumpsActions();
  const { syncNow } = useDumpsSync();
  const { showToast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hideFiled, setHideFiled] = useState(false);

  useEffect(() => {
    storage.get<boolean>(HIDE_FILED_KEY).then(v => { if (v != null) setHideFiled(v); });
  }, []);

  function toggleHideFiled() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHideFiled(v => {
      storage.set(HIDE_FILED_KEY, !v);
      return !v;
    });
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);

  const sorted = [...dumps].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const filedCount = sorted.filter(d => d.filed).length;
  const visible = hideFiled ? sorted.filter(d => !d.filed) : sorted;

  function handleAdd() {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = addDump({ tag: "journal", note_date: getLocalDateStr() });
    setEditingId(id);
  }

  function handleDelete(id: string) {
    const undo = deleteDump(id);
    showToast("Dump deleted", { label: "Undo", onPress: undo });
  }

  const editingDump = editingId ? dumps.find(d => d.id === editingId) : null;

  if (!loaded) {
    return (
      <GradientBackground>
        <SafeAreaView edges={["left", "right"]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text size="sm" secondary>Loading…</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView edges={["left", "right"]} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing[4], paddingBottom: spacing[5] }}>
            <View>
              <Text size="2xl" weight="bold">Dump</Text>
              {sorted.length > 0 && (
                <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
                  {sorted.length} capture{sorted.length !== 1 ? "s" : ""}
                  {filedCount > 0 ? ` · ${filedCount} filed` : ""}
                </Text>
              )}
            </View>
            <Pressable
              onPress={handleAdd}
              style={{
                flexDirection: "row", alignItems: "center", gap: spacing[1.5],
                paddingHorizontal: spacing[3], paddingVertical: spacing[2],
                borderRadius: radius.lg, backgroundColor: colors.accent,
              }}
            >
              <Ionicons name="add" size={15} color={colors.textInverse} />
              <Text size="sm" weight="medium" style={{ color: colors.textInverse }}>New</Text>
            </Pressable>
          </View>

          {/* Hide-filed toggle — filed captures are already in the vault, so
              tucking them away keeps this screen to what still needs filing. */}
          {filedCount > 0 && (
            <Pressable
              onPress={toggleHideFiled}
              style={{
                flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
                gap: spacing[1.5], marginBottom: spacing[4],
                paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
                borderRadius: radius["2xl"], borderWidth: 1,
                borderColor: hideFiled ? colors.accent : colors.bgBorder,
                backgroundColor: hideFiled ? `${colors.accent}18` : "transparent",
              }}
            >
              <Ionicons
                name={hideFiled ? "eye-off-outline" : "checkmark-circle-outline"}
                size={13}
                color={hideFiled ? colors.accent : colors.textSecondary}
              />
              <Text size="xs" style={{ color: hideFiled ? colors.accent : colors.textSecondary }}>
                {hideFiled ? `Filed hidden (${filedCount})` : "Hide filed"}
              </Text>
            </Pressable>
          )}

          {sorted.length === 0 ? (
            <EmptyState type="sticky" title="Nothing captured yet" subtitle="Tap + to dump a quick thought." />
          ) : visible.length === 0 ? (
            <EmptyState type="sticky" title="All filed away" subtitle="Every capture is in the vault. Nice." />
          ) : (
            <View style={{ gap: spacing[3] }}>
              {visible.map(d => (
                <DumpCard
                  key={d.id}
                  content={d.content}
                  tag={d.tag}
                  note_date={d.note_date}
                  filed={!!d.filed}
                  onPress={() => setEditingId(d.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {editingId && editingDump !== undefined && (
          <DumpEditModal
            id={editingId}
            initialContent={editingDump?.content ?? ""}
            initialTag={editingDump?.tag ?? "journal"}
            initialDate={editingDump?.note_date ?? getLocalDateStr()}
            onClose={() => setEditingId(null)}
            onDelete={() => handleDelete(editingId)}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

export default function DumpScreenBounded() {
  return <ErrorBoundary><DumpScreen /></ErrorBoundary>;
}
