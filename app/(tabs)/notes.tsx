import React, { useState, useCallback, useRef, useEffect } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, ScrollView, SafeAreaView, Pressable,
  KeyboardAvoidingView, Platform, RefreshControl, useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { Text, Divider, SearchBar, EmptyState, GradientBackground } from "@/components/ui";
import { spacing } from "@/lib/theme";
import { useNotes } from "@/lib/NotesContext";
import { useLists } from "@/lib/ListsContext";
import { CreateListModal, ListCard, ListDetailPane, ListIndexRow } from "./lists";
import {
  NoteEditor, NoteIndexRow, NoteCard, NotesSectionHeader, animate,
} from "@/components/notes";

function NotesScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 768;

  const { notes, addNote, loaded: notesLoaded, syncNow: syncNotes } = useNotes();
  const { lists, loaded: listsLoaded, syncNow: syncLists } = useLists();
  const loaded = notesLoaded && listsLoaded;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([syncNotes().catch(() => {}), syncLists().catch(() => {})]);
    setRefreshing(false);
  }, [syncNotes, syncLists]);

  const [search, setSearch]               = useState("");
  const [selectedNote, setSelectedNote]   = useState<string | null>(null);
  const [selectedList, setSelectedList]   = useState<string | null>(null);
  const [openNoteId, setOpenNoteId]       = useState<string | null>(null);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [creatingList, setCreatingList]   = useState(false);

  const params = useLocalSearchParams<{ create?: string; listId?: string; openId?: string; _t?: string }>();
  const handledCreate = useRef(false);

  // One-shot: create actions should only fire once per navigation intent
  useEffect(() => {
    if (!loaded || handledCreate.current) return;
    if (params.create === "note") {
      handledCreate.current = true;
      const id = addNote("note");
      if (isDesktop) setSelectedNote(id);
      else setOpenNoteId(id);
    } else if (params.create === "list") {
      handledCreate.current = true;
      setCreatingList(true);
    }
  }, [loaded, params.create, addNote, isDesktop]);

  // Repeatable: listId/openId fire every time the param changes (sidebar navigation).
  // params._t is included so that re-navigating to the same listId (same-id sidebar click)
  // still triggers this effect — the sidebar appends &_t=<timestamp> for exactly this case.
  useEffect(() => {
    if (!loaded) return;
    if (params.listId) {
      if (isDesktop) setSelectedList(params.listId);
      else setExpandedListId(params.listId);
    } else if (params.openId) {
      if (isDesktop) setSelectedNote(params.openId);
      else setOpenNoteId(params.openId);
    }
  }, [loaded, params.listId, params.openId, params._t, isDesktop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop: auto-select first list when loaded
  useEffect(() => {
    if (isDesktop && loaded && !selectedNote && !selectedList && lists.length > 0) setSelectedList(lists[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, loaded]);

  // Desktop: auto-select newly created list
  const prevListsLen = useRef(0);
  useEffect(() => {
    if (isDesktop && lists.length > prevListsLen.current && prevListsLen.current > 0) {
      const sorted = [...lists].sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (sorted[0]) { setSelectedList(sorted[0].id); setSelectedNote(null); }
    }
    prevListsLen.current = lists.length;
  }, [lists.length, isDesktop]);

  // Derive filtered collections before the effects that depend on their length.
  const fullNotes = notes.filter(n => n.type === "note" || !n.type);

  const filteredNotes = fullNotes.filter(n => {
    if (!search) return true;
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
  });

  const filteredLists = lists.filter(l =>
    !search || l.name.toLowerCase().includes(search.toLowerCase())
  );

  // Desktop: auto-select newly created note
  const prevNotesLen = useRef(0);
  useEffect(() => {
    if (isDesktop && filteredNotes.length > prevNotesLen.current && prevNotesLen.current > 0) {
      const newest = [...filteredNotes].sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))[0];
      if (newest) { setSelectedNote(newest.id); setSelectedList(null); }
    }
    prevNotesLen.current = filteredNotes.length;
  }, [filteredNotes.length, isDesktop]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewNote = useCallback(() => {
    const id = addNote("note");
    animate();
    if (isDesktop) { setSelectedNote(id); setSelectedList(null); }
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
    const openNote = fullNotes.find(n => n.id === openNoteId);
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
          <CreateListModal visible={creatingList} onDone={() => setCreatingList(false)} />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16] }}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
            >
              <View style={{ paddingTop: spacing[4], paddingBottom: spacing[4] }}>
                <Text size="2xl" weight="bold">Notes</Text>
                <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
                  {lists.length} list{lists.length !== 1 ? "s" : ""} · {fullNotes.length} note{fullNotes.length !== 1 ? "s" : ""}
                </Text>
              </View>

              {(lists.length > 1 || fullNotes.length > 1) && (
                <View style={{ marginBottom: spacing[4] }}>
                  <SearchBar value={search} onChange={setSearch} placeholder="Search lists and notes…" />
                </View>
              )}

              <NotesSectionHeader label="Lists" count={filteredLists.length} onAdd={() => setCreatingList(true)} addLabel="New list" />
              {filteredLists.length === 0 ? (
                <View style={{ marginBottom: spacing[4] }}>
                  <EmptyState type="lists" title={search ? "No lists match" : "No lists yet"} subtitle={search ? "Try a different search." : "Create your first list."} />
                </View>
              ) : (
                <View style={{ marginBottom: spacing[4] }}>
                  {filteredLists.map(list => (
                    <ListCard
                      key={list.id}
                      list={list}
                      isExpanded={expandedListId === list.id}
                      onToggleExpand={() => { animate(); setExpandedListId(prev => prev === list.id ? null : list.id); }}
                      otherLists={lists.filter(l => l.id !== list.id)}
                    />
                  ))}
                </View>
              )}

              <Divider style={{ marginBottom: spacing[4] }} />

              <NotesSectionHeader label="Notes" count={filteredNotes.length} onAdd={handleNewNote} addLabel="New note" />
              {filteredNotes.length === 0 ? (
                <EmptyState type="notes" title={search ? "No notes match" : "No notes yet"} subtitle={search ? "Try a different search." : "Capture a thought."} />
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                  {filteredNotes.map(n => (
                    <View key={n.id} style={{ width: "48%" as any }}>
                      <NoteCard note={n} onOpen={() => { animate(); setOpenNoteId(n.id); }} />
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── Desktop: two-pane layout ──────────────────────────────────────────────────
  const openNote = selectedNote ? fullNotes.find(n => n.id === selectedNote) ?? null : null;
  const openList = selectedList ? lists.find(l => l.id === selectedList) ?? null : null;

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at);
  });

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <CreateListModal visible={creatingList} onDone={() => setCreatingList(false)} />
        <View style={{ flex: 1, flexDirection: "row" }}>
          {/* Left pane */}
          <View style={{ width: 300, borderRightWidth: 1, borderRightColor: colors.bgBorder, flexShrink: 0 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: spacing[16] }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
            >
              <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[5], paddingBottom: spacing[3] }}>
                <Text size="xl" weight="bold">Notes</Text>
              </View>
              <View style={{ paddingHorizontal: spacing[3], marginBottom: spacing[3] }}>
                <SearchBar value={search} onChange={setSearch} placeholder="Search lists and notes…" />
              </View>

              {/* Lists subsection */}
              <View style={{ paddingHorizontal: spacing[4], marginBottom: spacing[1] }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1 }}>Lists</Text>
                  <Pressable onPress={() => setCreatingList(true)} hitSlop={12}>
                    <Text size="xs" style={{ color: colors.accent }}>+</Text>
                  </Pressable>
                </View>
              </View>
              {filteredLists.length === 0 ? (
                <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2] }}>
                  <Text size="xs" secondary>{search ? "No lists match." : "No lists yet — tap + to create."}</Text>
                </View>
              ) : (
                filteredLists.map(list => (
                  <ListIndexRow
                    key={list.id}
                    list={list}
                    isSelected={selectedList === list.id}
                    onSelect={() => { setSelectedList(list.id); setSelectedNote(null); }}
                  />
                ))
              )}

              <View style={{ height: 1, backgroundColor: colors.bgBorder, marginHorizontal: spacing[4], marginVertical: spacing[3] }} />

              {/* Notes subsection */}
              <View style={{ paddingHorizontal: spacing[4], marginBottom: spacing[1] }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1 }}>Notes</Text>
                  <Pressable onPress={handleNewNote} hitSlop={12}>
                    <Text size="xs" style={{ color: colors.accent }}>+</Text>
                  </Pressable>
                </View>
              </View>
              {sortedNotes.length === 0 ? (
                <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2] }}>
                  <Text size="xs" secondary>{search ? "No notes match." : "No notes yet — tap + to create."}</Text>
                </View>
              ) : (
                sortedNotes.map(n => (
                  <NoteIndexRow
                    key={n.id}
                    note={n}
                    isSelected={selectedNote === n.id}
                    onSelect={() => { setSelectedNote(n.id); setSelectedList(null); }}
                  />
                ))
              )}
            </ScrollView>
          </View>

          {/* Right pane */}
          <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
            {openNote ? (
              <NoteEditor
                key={openNote.id}
                note={openNote}
                onClose={() => setSelectedNote(null)}
                showBackButton={false}
                onOpenNote={id => { setSelectedNote(id); setSelectedList(null); }}
              />
            ) : openList ? (
              <ListDetailPane list={openList} otherLists={lists.filter(l => l.id !== openList.id)} />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[2] }}>
                <Text size="2xl">📝</Text>
                <Text size="sm" secondary>Select a note or list to open it</Text>
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

