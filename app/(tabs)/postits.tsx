import React, { useState, useCallback, useEffect, useRef } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, ScrollView, SafeAreaView, TextInput, Modal,
  Pressable, Platform, RefreshControl, useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { Text, GradientBackground, EmptyState } from "@/components/ui";
import { spacing, radius, fontFamily, getNotePastelIndex, getShadow } from "@/lib/theme";
import { useNotesData, useNotesActions, useNotesSync } from "@/lib/NotesContext";
import { useToast } from "@/lib/ToastContext";

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function PostItEditModal({
  id, text, onClose, onDelete,
}: {
  id: string; text: string; onClose: () => void; onDelete: () => void;
}) {
  const { updateNote } = useNotesActions();
  const { colors, notePastels, scheme } = useTheme();
  const [val, setVal] = useState(text);
  const inputRef = useRef<TextInput | null>(null);
  const idx = getNotePastelIndex(id);
  const bg = notePastels.bg[idx];
  const border = notePastels.border[idx];

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  function save() {
    const v = val.trim();
    if (!v) {
      onDelete();
    } else {
      updateNote(id, { title: v });
    }
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={save}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing[6] }}
        onPress={save}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: 320, maxWidth: "90%" as any,
            backgroundColor: bg,
            borderRadius: radius["2xl"],
            borderWidth: 1, borderColor: border,
            borderTopColor: "rgba(255,255,255,0.55)",
            padding: spacing[5],
            ...getShadow("overlay", scheme),
          }}
        >
          <TextInput
            ref={inputRef}
            value={val}
            onChangeText={setVal}
            onSubmitEditing={save}
            placeholder="Write something…"
            placeholderTextColor={`${notePastels.text}55`}
            maxLength={200}
            multiline
            returnKeyType="done"
            blurOnSubmit
            style={[
              {
                color: notePastels.text, fontSize: 15,
                fontFamily: fontFamily.medium, lineHeight: 22,
                minHeight: 100, textAlignVertical: "top",
              },
              { outlineStyle: "none" } as any,
            ]}
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing[4] }}>
            <Pressable
              onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onDelete(); onClose(); }}
              hitSlop={12}
              style={{ padding: spacing[1] }}
            >
              <Ionicons name="trash-outline" size={18} color={`${notePastels.text}99`} />
            </Pressable>
            <Pressable
              onPress={save}
              style={{
                paddingHorizontal: spacing[4], paddingVertical: spacing[2],
                borderRadius: radius.lg,
                backgroundColor: "rgba(0,0,0,0.12)",
              }}
            >
              <Text size="sm" weight="semibold" style={{ color: notePastels.text }}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Post-it Card (display only) ──────────────────────────────────────────────

function PostItCard({ id, text, onPress }: { id: string; text: string; onPress: () => void }) {
  const { notePastels, scheme } = useTheme();
  const idx = getNotePastelIndex(id);

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: notePastels.bg[idx],
        borderRadius: radius["2xl"],
        borderWidth: 1,
        borderColor: notePastels.border[idx],
        borderTopColor: "rgba(255,255,255,0.55)",
        padding: spacing[4],
        minHeight: 96,
        justifyContent: "center",
        ...getShadow("xs", scheme),
      }}
    >
      <Text
        size="xs"
        numberOfLines={4}
        style={{
          color: text ? notePastels.text : `${notePastels.text}55`,
          fontFamily: fontFamily.medium,
          lineHeight: 18,
        }}
      >
        {text || "Write something…"}
      </Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

function PostItsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { notes, loaded } = useNotesData();
  const { addNote, deleteNote } = useNotesActions();
  const { syncNow } = useNotesSync();
  const { showToast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);

  const postits = notes.filter(n => n.type === "postit");

  function handleAdd() {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = addNote("postit");
    setEditingId(id);
  }

  function handleDelete(id: string) {
    const undo = deleteNote(id);
    showToast("Post-it deleted", { label: "Undo", onPress: undo });
  }

  const numCols = width >= 1200 ? 5 : width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const gapTotal = spacing[3] * (numCols - 1);
  const colWidth = `${Math.floor((100 - (gapTotal / (width || 375)) * 100) / numCols)}%` as any;

  const editingNote = editingId ? notes.find(n => n.id === editingId) : null;

  if (!loaded) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text size="sm" secondary>Loading…</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing[4], paddingBottom: spacing[5] }}>
            <View>
              <Text size="2xl" weight="bold">Post Its</Text>
              {postits.length > 0 && (
                <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
                  {postits.length} post-it{postits.length !== 1 ? "s" : ""}
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
              <Text style={{ color: colors.textInverse, fontSize: 16, lineHeight: 20 }}>+</Text>
              <Text size="sm" weight="medium" style={{ color: colors.textInverse }}>New</Text>
            </Pressable>
          </View>

          {postits.length === 0 ? (
            <EmptyState type="sticky" title="No post-its yet" subtitle="Tap + to capture a quick thought." />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
              {postits.map(n => (
                <View key={n.id} style={{ width: colWidth }}>
                  <PostItCard
                    id={n.id}
                    text={n.title}
                    onPress={() => setEditingId(n.id)}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {editingId && editingNote !== undefined && (
          <PostItEditModal
            id={editingId}
            text={editingNote?.title ?? ""}
            onClose={() => setEditingId(null)}
            onDelete={() => handleDelete(editingId)}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

export default function PostItsScreenBounded() {
  return <ErrorBoundary><PostItsScreen /></ErrorBoundary>;
}
