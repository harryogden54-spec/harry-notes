import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, FlatList, SafeAreaView, Pressable,
  KeyboardAvoidingView, Platform, RefreshControl, useWindowDimensions,
  type ListRenderItemInfo,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, SearchBar, EmptyState, GradientBackground } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { cmpRecentDesc } from "@/lib/utils";
import { storage } from "@/lib/storage";
import { useNotesData, useNotesActions, useNotesSync, type Note } from "@/lib/NotesContext";
import {
  NoteEditor, NoteIndexRow, NoteCard, animate,
} from "@/components/notes";
import { extractTags } from "@/components/notes/utils";

type NotesSortBy = "recent" | "created" | "title";

const SORT_OPTIONS: [NotesSortBy, string][] = [
  ["recent",  "Recent"],
  ["created", "Added"],
  ["title",   "A–Z"],
];

function sortNotes(list: Note[], sortBy: NotesSortBy): Note[] {
  const sorted = [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sortBy === "title")   return (a.title || "Untitled").localeCompare(b.title || "Untitled", undefined, { sensitivity: "base" });
    if (sortBy === "created") return b.created_at.localeCompare(a.created_at);
    return cmpRecentDesc(a, b);
  });
  return sorted;
}

function NotesScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 768;

  const { notes, loaded: notesLoaded } = useNotesData();
  const { addNote, unarchiveNote, deleteNote } = useNotesActions();
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
  const [sortBy, setSortBy]             = useState<NotesSortBy>("recent");
  const [activeTag, setActiveTag]       = useState<string | null>(null);
  const [showArchive, setShowArchive]   = useState(false);

  // Persisted sort preference (same pattern as the tasks screen).
  const sortLoaded = useRef(false);
  useEffect(() => {
    storage.get<NotesSortBy>("notes_sort_by").then(v => {
      if (v === "recent" || v === "created" || v === "title") setSortBy(v);
      sortLoaded.current = true;
    });
  }, []);
  useEffect(() => { if (sortLoaded.current) storage.set("notes_sort_by", sortBy); }, [sortBy]);

  const params = useLocalSearchParams<{ create?: string; openId?: string; _t?: string }>();
  const handledCreate = useRef(false);

  useEffect(() => {
    if (!loaded || handledCreate.current) return;
    if (params.create === "note" || params.create === "1") {
      handledCreate.current = true;
      const id = addNote();
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
    () => notes.filter(n => !n.archived),
    [notes]
  );

  const archivedNotes = useMemo(
    () => notes.filter(n => n.archived).sort(cmpRecentDesc),
    [notes]
  );

  // Tags across all active notes (//tag in the body), for the filter chips.
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const n of allNotes) for (const t of extractTags(n.body)) tags.add(t);
    return [...tags].sort();
  }, [allNotes]);

  // Auto-clear a tag filter if its last note is deleted/untagged.
  useEffect(() => {
    if (activeTag && !allTags.includes(activeTag)) setActiveTag(null);
  }, [activeTag, allTags]);

  const sortedNotes = useMemo(() => {
    const q = search.toLowerCase();
    let filtered = !search ? allNotes : allNotes.filter(n => {
      const blockText = n.blocks?.map(b => b.content).join(" ") ?? "";
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        blockText.toLowerCase().includes(q)
      );
    });
    if (activeTag) filtered = filtered.filter(n => extractTags(n.body).includes(activeTag));
    return sortNotes(filtered, sortBy);
  }, [allNotes, search, activeTag, sortBy]);

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
    const id = addNote();
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

  // ── Shared controls: sort chips + archive toggle + tag filter chips ──────────
  const controls = (
    <View style={{ gap: spacing[2], marginBottom: spacing[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], flexWrap: "wrap" }}>
        {SORT_OPTIONS.map(([key, label]) => (
          <Pressable key={key} onPress={() => { animate(); setSortBy(key); }} style={{
            paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
            borderRadius: radius.sm, borderWidth: 1,
            borderColor: sortBy === key ? colors.accent : colors.bgBorder,
            backgroundColor: sortBy === key ? `${colors.accent}15` : "transparent",
          }}>
            <Text size="xs" style={{ color: sortBy === key ? colors.accent : colors.textSecondary }}>{label}</Text>
          </Pressable>
        ))}
        {archivedNotes.length > 0 && (
          <Pressable onPress={() => { animate(); setShowArchive(v => !v); }} style={{
            paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
            borderRadius: radius.sm, borderWidth: 1,
            borderColor: showArchive ? colors.accent : colors.bgBorder,
            backgroundColor: showArchive ? `${colors.accent}15` : "transparent",
          }}>
            <Text size="xs" style={{ color: showArchive ? colors.accent : colors.textSecondary }}>
              Archive · {archivedNotes.length}
            </Text>
          </Pressable>
        )}
      </View>
      {allTags.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], flexWrap: "wrap" }}>
          {allTags.map(tag => {
            const active = activeTag === tag;
            return (
              <Pressable key={tag} onPress={() => setActiveTag(prev => prev === tag ? null : tag)} style={{
                flexDirection: "row", alignItems: "center", gap: 3,
                paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
                borderRadius: 99, borderWidth: 1,
                borderColor: active ? colors.accent : colors.bgBorder,
                backgroundColor: active ? `${colors.accent}18` : colors.bgSecondary,
              }}>
                <Text size="xs" weight={active ? "semibold" : "regular"} style={{ color: active ? colors.accent : colors.textSecondary }}>
                  //{tag}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  // ── Archive section (shown when the Archive chip is active) ──────────────────
  const archiveSection = showArchive && archivedNotes.length > 0 ? (
    <View style={{ marginTop: spacing[4] }}>
      <Text size="xs" weight="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.2, color: colors.textTertiary, fontSize: 11, marginBottom: spacing[3] }}>
        Archive · {archivedNotes.length}
      </Text>
      <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.bgBorder, overflow: "hidden" }}>
        {archivedNotes.map((n, i) => (
          <View key={n.id} style={{
            flexDirection: "row", alignItems: "center",
            paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3],
            borderBottomWidth: i === archivedNotes.length - 1 ? 0 : 1, borderBottomColor: colors.bgBorder,
          }}>
            <Ionicons name="archive-outline" size={14} color={colors.textTertiary} />
            <Text size="sm" style={{ flex: 1, color: colors.textTertiary }} numberOfLines={1}>
              {n.title || "Untitled"}
            </Text>
            <Pressable onPress={() => { animate(); unarchiveNote(n.id); }} hitSlop={8}>
              <Text size="xs" style={{ color: colors.accent }}>Restore</Text>
            </Pressable>
            <Pressable onPress={() => { animate(); deleteNote(n.id); }} hitSlop={8}>
              <Ionicons name="close-outline" size={14} color={colors.textTertiary} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  ) : null;

  // ── Mobile: full-screen note editor ──────────────────────────────────────────
  if (!isDesktop) {
    const openNote = notes.find(n => n.id === openNoteId);
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
                    <SearchBar value={search} onChange={setSearch} placeholder="Search notes…" />
                  )}
                  {(allNotes.length > 0 || archivedNotes.length > 0) && controls}
                </>
              }
              ListFooterComponent={archiveSection}
              ListEmptyComponent={
                <EmptyState
                  type="notes"
                  title={search || activeTag ? "No notes match" : "No notes yet"}
                  subtitle={search || activeTag ? "Try a different search or tag." : "Tap + to capture a thought."}
                />
              }
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── Desktop: two-pane layout ──────────────────────────────────────────────────
  const openNote = selectedNote ? notes.find(n => n.id === selectedNote) ?? null : null;

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
                    <View style={{ paddingHorizontal: spacing[3] }}>
                      <SearchBar value={search} onChange={setSearch} placeholder="Search notes…" />
                    </View>
                  )}
                  {(allNotes.length > 0 || archivedNotes.length > 0) && (
                    <View style={{ paddingHorizontal: spacing[3] }}>{controls}</View>
                  )}
                </>
              }
              ListFooterComponent={archiveSection ? <View style={{ paddingHorizontal: spacing[3] }}>{archiveSection}</View> : null}
              ListEmptyComponent={
                <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}>
                  <Text size="xs" secondary>{search || activeTag ? "No notes match." : "No notes yet — tap + to create."}</Text>
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
