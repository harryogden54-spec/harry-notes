import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, FlatList, SafeAreaView, Pressable,
  KeyboardAvoidingView, Platform, RefreshControl, useWindowDimensions,
  type ListRenderItemInfo,
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

  const sortedNotes = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = !search ? allNotes : allNotes.filter(n => {
      const blockText = n.blocks?.map(b => b.content).join(" ") ?? "";
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        blockText.toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return cmpRecentDesc(a, b);
    });
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

  const renderNoteCard = useCallback(({ item }: ListRenderItemInfo<Note>) => (
    <View style={{ width: "48%" as any, marginBottom: spacing[2] }}>
      <NoteCard note={item} onOpen={() => { animate(); setOpenNoteId(item.id); }} />
    </View>
  ), []);

  const renderIndexRow = useCallback(({ item }: ListRenderItemInfo<Note>) => (
    <NoteIndexRow
      note={item}
      isSelected={selectedNote === item.id}
      onSelect={() => setSelectedNote(item.id)}
    />
  ), [selectedNote]);

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

    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <FlatList
              data={sortedNotes}
              keyExtractor={(n) => n.id}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: "space-between" }}
              renderItem={renderNoteCard}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16] }}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
              initialNumToRender={12}
              windowSize={7}
              removeClippedSubviews={Platform.OS !== "web"}
              ListHeaderComponent={
                <>
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
                </>
              }
              ListEmptyComponent={
                <EmptyState
                  type="notes"
                  title={search ? "No notes match" : "No notes yet"}
                  subtitle={search ? "Try a different search." : "Tap + to capture a thought."}
                />
              }
            />
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
            <FlatList
              data={sortedNotes}
              keyExtractor={(n) => n.id}
              renderItem={renderIndexRow}
              extraData={selectedNote}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: spacing[16] }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
              initialNumToRender={16}
              windowSize={7}
              ListHeaderComponent={
                <>
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
                </>
              }
              ListEmptyComponent={
                <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}>
                  <Text size="xs" secondary>{search ? "No notes match." : "No notes yet — tap + to create."}</Text>
                </View>
              }
            />
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
