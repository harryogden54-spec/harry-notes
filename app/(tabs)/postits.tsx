import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, ScrollView, SafeAreaView, TextInput,
  Pressable, Platform, RefreshControl, useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { Text, GradientBackground } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useNotes } from "@/lib/NotesContext";
import { useToast } from "@/lib/ToastContext";

// Pastel palette — intentional design constants
const PASTELS = ["#FFF9C4", "#FCE4EC", "#E8F5E9", "#E3F2FD", "#EDE7F6", "#FBE9E7"] as const;
const PASTEL_BORDERS = ["#F0E68C", "#F8BBD9", "#C8E6C9", "#BBDEFB", "#D1C4E9", "#FFCCBC"] as const;
const PASTEL_TEXT = "#1A1A2E";

function getPastelIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % PASTELS.length;
}

// ─── Post-it Card ─────────────────────────────────────────────────────────────

function PostItCard({ id, text, onDelete }: { id: string; text: string; onDelete: () => void }) {
  const { updateNote } = useNotes();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  const inputRef = useRef<TextInput | null>(null);
  const idx = getPastelIndex(id);

  // Start editing immediately for brand-new empty cards
  useEffect(() => {
    if (!text) {
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, []);

  // Keep val in sync if text changes externally
  useEffect(() => { setVal(text); }, [text]);

  function save() {
    const v = val.trim();
    if (!v) {
      onDelete();
    } else {
      updateNote(id, { title: v });
    }
    setEditing(false);
  }

  return (
    <Pressable
      onPress={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }}
      onLongPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onDelete(); }}
      style={{
        backgroundColor: PASTELS[idx],
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: PASTEL_BORDERS[idx],
        padding: spacing[3],
        minHeight: 72,
        justifyContent: "center",
        // shadow for lifted feel
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {editing ? (
        <TextInput
          ref={inputRef}
          value={val}
          onChangeText={setVal}
          onBlur={save}
          onSubmitEditing={save}
          placeholder="Write something…"
          placeholderTextColor={`${PASTEL_TEXT}55`}
          maxLength={100}
          multiline={false}
          returnKeyType="done"
          style={[
            { color: PASTEL_TEXT, fontSize: 13, fontFamily: fontFamily.medium, lineHeight: 18 },
            { outlineStyle: "none" } as any,
          ]}
        />
      ) : (
        <Text
          size="xs"
          numberOfLines={3}
          style={{ color: val ? PASTEL_TEXT : `${PASTEL_TEXT}55`, fontFamily: fontFamily.medium, lineHeight: 18 }}
        >
          {val || "Write something…"}
        </Text>
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PostItsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { notes, addNote, deleteNote, loaded, syncNow } = useNotes();
  const { showToast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);

  const postits = notes.filter(n => n.type === "postit");

  function handleAdd() {
    addNote("postit");
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleDelete(id: string) {
    const undo = deleteNote(id);
    showToast("Post-it deleted", { label: "Undo", onPress: undo });
  }

  // Determine number of columns from screen width
  const numCols = width >= 1200 ? 5 : width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const colWidth = `${Math.floor(100 / numCols)}%` as any;

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
              <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
                {postits.length > 0 ? `${postits.length} post-it${postits.length !== 1 ? "s" : ""}` : "No post-its yet"}
              </Text>
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
            <View style={{ alignItems: "center", paddingTop: spacing[12], gap: spacing[3] }}>
              <Text style={{ fontSize: 40 }}>🗒️</Text>
              <Text size="sm" secondary>Tap + to add a post-it</Text>
              <Text size="xs" tertiary>Long-press a card to delete it</Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
              {postits.map(n => (
                <View key={n.id} style={{ width: colWidth }}>
                  <PostItCard
                    id={n.id}
                    text={n.title}
                    onDelete={() => handleDelete(n.id)}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
