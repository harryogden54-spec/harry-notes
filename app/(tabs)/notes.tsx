import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, ScrollView, SafeAreaView, Pressable,
  KeyboardAvoidingView, Platform, RefreshControl, useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { Text, SearchBar, EmptyState, GradientBackground } from "@/components/ui";
import { spacing, getShadow } from "@/lib/theme";
import { cmpRecentDesc } from "@/lib/utils";
import { useNotesData, useNotesActions, useNotesSync, type Note } from "@/lib/NotesContext";
import {
  NoteEditor, NoteIndexRow, NoteCard, animate,
} from "@/components/notes";

function SectionLabel({ label, count }: { label: string; count: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: spacing[2.5] }}>
      <Text size="xs" weight="semibold" style={{ letterSpacing: 1, color: colors.textTertiary, textTransform: "uppercase" }}>
        {label}
      </Text>
      <View style={{ backgroundColor: colors.bgTertiary, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1 }}>
        <Text size="xs" style={{ color: colors.textTertiary }}>{count}</Text>
      </View>
    </View>
  );
}

function NoteCardGrid({ notes, onOpen }: { notes: Note[]; onOpen: (id: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[4] }}>
      {notes.map(note => (
        <View key={note.id} style={{ width: "47%" as any, flexGrow: 1 }}>
          <NoteCard note={note} onOpen={() => onOpen(note.id)} />
        </View>
      ))}
    </View>
  );
}

function NotesScreen() {
  const { colors, scheme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 768;

  const { notes, loaded: notesLoaded } = useNotesData();
  const { addNote } = useNotesActions();
  const { syncNow: syncNotes } = useNotesSync();
  const loaded = notesLoaded;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNotes().catch(() => {});
    setRefreshing(false);
  }, [syncNotes]);

  const [search, setSearch]             = useState("");
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId]     = useState<string | null>(null);

  const params = useLocalSearchParams<{ create?: string; openId?: string; _t?: string }>();
  const handledCreate = useRef(false);

  useEffect(() => {
    if (!loaded || handledCreate.current) return;
    if (params.create === "note" || params.create === "1") {
      handledCreate.current = true;
      const id = addNote("note");
      if (isDesktop) setSelectedNote(id);
      else setOpenNoteId(id);
    }
  }, [loaded, params.create, addNote, isDesktop]);

  useEffect(() => {
    if (!loaded) return;
    if (params.openId) {
      if (isDesktop) setSelectedNote(params.openId);
      else setOpenNoteId(params.openId);
    }
  }, [loaded, params.openId, params._t, isDesktop]); // eslint-disable-line react-hooks/exhaustive-deps

  const allNotes = useMemo(
    () => notes.filter(n => n.type === "note" || !n.type),
    [notes]
  );

  const { pinnedNotes, restNotes } = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = !search ? allNotes : allNotes.filter(n => {
      const blockText = n.blocks?.map(b => b.content).join(" ") ?? "";
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        blockText.toLowerCase().includes(q)
      );
    });
    const sorted = [...filtered].sort(cmpRecentDesc);
    return {
      pinnedNotes: sorted.filter(n => n.pinned),
      restNotes: sorted.filter(n => !n.pinned),
    };
  }, [allNotes, search]);

  // Desktop: auto-select newest note when created
  const prevNotesLen = useRef(0);
  useEffect(() => {
    if (isDesktop && allNotes.length > prevNotesLen.current && prevNotesLen.current > 0) {
      const newest = [...allNotes].sort(cmpRecentDesc)[0];
      if (newest) setSelectedNote(newest.id);
    }
    prevNotesLen.current = allNotes.length;
  }, [allNotes.length, isDesktop]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewNote = useCallback(() => {
    const id = addNote("note");
    animate();
    if (isDesktop) setSelectedNote(id);
    else setOpenNoteId(id);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [addNote, isDesktop]);

  if (!loaded) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text size="sm" secondary>Loading…</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── Mobile: full-screen note editor ──────────────────────────────────────────
  if (!isDesktop) {
    const openNote = allNotes.find(n => n.id === openNoteId);
    if (openNote) {
      return (
        <GradientBackground>
          <SafeAreaView style={{ flex: 1 }}>
            <NoteEditor
              note={openNote}
              onClose={() => { animate(); setOpenNoteId(null); }}
              showBackButton
              onOpenNote={id => { animate(); setOpenNoteId(id); }}
            />
          </SafeAreaView>
        </GradientBackground>
      );
    }

    const openCard = (id: string) => { animate(); setOpenNoteId(id); };

    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16] }}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
            >
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingTop: spacing[4], paddingBottom: spacing[4] }}>
                <View>
                  <Text size="title" weight="bold">Notes</Text>
                  <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
                    {allNotes.length} note{allNotes.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={handleNewNote}
                  style={({ pressed }) => ({
                    flexDirection: "row", alignItems: "center", gap: spacing[2],
                    paddingHorizontal: spacing[4] + 2, paddingVertical: spacing[2.5],
                    borderRadius: 999,
                    // Inverse pill per design 1d — dark on light themes, light on dark.
                    backgroundColor: colors.textPrimary,
                    ...getShadow("md", scheme),
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <Ionicons name="add" size={14} color={colors.bgPrimary} />
                  <Text size="sm" weight="semibold" style={{ color: colors.bgPrimary }}>New note</Text>
                </Pressable>
              </View>

              {allNotes.length > 1 && (
                <View style={{ marginBottom: spacing[4] }}>
                  <SearchBar value={search} onChange={setSearch} placeholder="Search notes…" />
                </View>
              )}

              {allNotes.length === 0 ? (
                <EmptyState type="notes" title="No notes yet" subtitle="Tap + to capture a thought." />
              ) : pinnedNotes.length === 0 && restNotes.length === 0 ? (
                <EmptyState type="notes" title="No notes match" subtitle="Try a different search." />
              ) : (
                <>
                  {pinnedNotes.length > 0 && (
                    <View style={{ marginBottom: spacing[5] }}>
                      <SectionLabel label="Pinned" count={pinnedNotes.length} />
                      <NoteCardGrid notes={pinnedNotes} onOpen={openCard} />
                    </View>
                  )}
                  {restNotes.length > 0 && (
                    <View>
                      <SectionLabel label="All notes" count={restNotes.length} />
                      <NoteCardGrid notes={restNotes} onOpen={openCard} />
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── Desktop: two-pane layout ──────────────────────────────────────────────────
  const openNote = selectedNote ? allNotes.find(n => n.id === selectedNote) ?? null : null;

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, flexDirection: "row" }}>
          {/* Left column — New note button + floating note bubbles (no divider:
              cards sit directly on the gradient, per Harry's mockup) */}
          <View style={{ width: 340, flexShrink: 0 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: spacing[4], paddingTop: spacing[5], paddingBottom: spacing[16] }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
            >
              {/* New note — the column's primary action, top of the stack */}
              <Pressable
                onPress={handleNewNote}
                style={({ hovered, pressed }: any) => ({
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing[2],
                  paddingVertical: spacing[3],
                  borderRadius: 18,
                  backgroundColor: colors.textPrimary,
                  marginBottom: spacing[3],
                  opacity: hovered && !pressed ? 0.92 : 1,
                  ...getShadow("md", scheme),
                  ...(Platform.OS === "web" ? {
                    transitionProperty: "opacity, transform",
                    transitionDuration: "150ms",
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  } : {}),
                } as any)}
              >
                <Ionicons name="add" size={15} color={colors.bgPrimary} />
                <Text size="sm" weight="semibold" style={{ color: colors.bgPrimary }}>New note</Text>
              </Pressable>

              {allNotes.length > 1 && (
                <View style={{ marginBottom: spacing[3] }}>
                  <SearchBar value={search} onChange={setSearch} placeholder="Search notes…" />
                </View>
              )}

              {allNotes.length === 0 ? (
                <View style={{ paddingVertical: spacing[3], alignItems: "center" }}>
                  <Text size="xs" secondary>No notes yet — create your first one.</Text>
                </View>
              ) : pinnedNotes.length === 0 && restNotes.length === 0 ? (
                <View style={{ paddingVertical: spacing[3], alignItems: "center" }}>
                  <Text size="xs" secondary>No notes match.</Text>
                </View>
              ) : (
                <>
                  {pinnedNotes.length > 0 && (
                    <View style={{ marginBottom: spacing[4] }}>
                      <SectionLabel label="Pinned" count={pinnedNotes.length} />
                      <View style={{ gap: spacing[2.5] }}>
                        {pinnedNotes.map(note => (
                          <NoteIndexRow key={note.id} note={note} isSelected={selectedNote === note.id} onSelect={() => setSelectedNote(note.id)} />
                        ))}
                      </View>
                    </View>
                  )}
                  {restNotes.length > 0 && (
                    <View>
                      <SectionLabel label="All notes" count={restNotes.length} />
                      <View style={{ gap: spacing[2.5] }}>
                        {restNotes.map(note => (
                          <NoteIndexRow key={note.id} note={note} isSelected={selectedNote === note.id} onSelect={() => setSelectedNote(note.id)} />
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>

          {/* Right — editor in a large rounded floating panel (iOS-Notes feel) */}
          <View style={{ flex: 1, paddingVertical: spacing[5], paddingRight: spacing[5], paddingLeft: spacing[1] }}>
            <View style={{
              flex: 1,
              borderRadius: 24,
              borderWidth: 1, borderColor: `${colors.bgBorder}88`,
              backgroundColor: colors.bgSecondary,
              overflow: "hidden",
              ...getShadow("md", scheme),
            }}>
              {openNote ? (
                <NoteEditor
                  key={openNote.id}
                  note={openNote}
                  onClose={() => setSelectedNote(null)}
                  showBackButton={false}
                  onOpenNote={id => setSelectedNote(id)}
                />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[3] }}>
                  <Ionicons name="document-text-outline" size={28} color={colors.textTertiary} />
                  <Text size="sm" secondary>Select a note, or create a new one</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

export default function NotesScreenBounded() {
  return <ErrorBoundary><NotesScreen /></ErrorBoundary>;
}
