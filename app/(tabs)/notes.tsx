import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, ScrollView, SafeAreaView, Pressable,
  KeyboardAvoidingView, Platform, RefreshControl, useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { Text, SearchBar, EmptyState, GradientBackground } from "@/components/ui";
import { spacing } from "@/lib/theme";
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
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
      {notes.map(note => (
        <View key={note.id} style={{ width: "48%" as any }}>
          <NoteCard note={note} onOpen={() => onOpen(note.id)} />
        </View>
      ))}
    </View>
  );
}

function NotesScreen() {
  const { colors } = useTheme();
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
                  <Text size="2xl" weight="bold">Notes</Text>
                  <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
                    {allNotes.length} note{allNotes.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={handleNewNote}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: spacing[1.5],
                    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
                    borderRadius: 99, backgroundColor: colors.accent,
                  }}
                >
                  <Text style={{ color: colors.textInverse, fontSize: 18, lineHeight: 22 }}>+</Text>
                  <Text size="sm" weight="medium" style={{ color: "#fff" }}>New</Text>
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
          {/* Left pane — note index */}
          <View style={{ width: 380, borderRightWidth: 1, borderRightColor: colors.bgBorder, flexShrink: 0 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: spacing[16] }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
            >
              {/* Header */}
              <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[5], paddingBottom: spacing[3], flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text size="xl" weight="bold">Notes</Text>
                <Pressable
                  onPress={handleNewNote}
                  hitSlop={8}
                  style={{
                    width: 28, height: 28, borderRadius: 99,
                    backgroundColor: colors.accent,
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.textInverse, fontSize: 20, lineHeight: 24 }}>+</Text>
                </Pressable>
              </View>

              {allNotes.length > 1 && (
                <View style={{ paddingHorizontal: spacing[3], marginBottom: spacing[2] }}>
                  <SearchBar value={search} onChange={setSearch} placeholder="Search notes…" />
                </View>
              )}

              {allNotes.length === 0 ? (
                <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}>
                  <Text size="xs" secondary>No notes yet — tap + to create.</Text>
                </View>
              ) : pinnedNotes.length === 0 && restNotes.length === 0 ? (
                <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}>
                  <Text size="xs" secondary>No notes match.</Text>
                </View>
              ) : (
                <>
                  {pinnedNotes.length > 0 && (
                    <View style={{ marginBottom: spacing[3] }}>
                      <View style={{ paddingHorizontal: spacing[4] }}>
                        <SectionLabel label="Pinned" count={pinnedNotes.length} />
                      </View>
                      {pinnedNotes.map(note => (
                        <NoteIndexRow key={note.id} note={note} isSelected={selectedNote === note.id} onSelect={() => setSelectedNote(note.id)} />
                      ))}
                    </View>
                  )}
                  {restNotes.length > 0 && (
                    <View>
                      <View style={{ paddingHorizontal: spacing[4] }}>
                        <SectionLabel label="All notes" count={restNotes.length} />
                      </View>
                      {restNotes.map(note => (
                        <NoteIndexRow key={note.id} note={note} isSelected={selectedNote === note.id} onSelect={() => setSelectedNote(note.id)} />
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>

          {/* Right pane — editor */}
          <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
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
                <Text size="sm" secondary>Select a note, or tap + to create one</Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

export default function NotesScreenBounded() {
  return <ErrorBoundary><NotesScreen /></ErrorBoundary>;
}
