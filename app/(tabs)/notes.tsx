import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, RefreshControl, useWindowDimensions,
} from "react-native";
// Side-notch padding only — PersistentHeader owns the top inset, MobileTabBar the bottom.
import { SideSafeArea } from "@/components/ui";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { Text, SearchBar, EmptyState, GradientBackground } from "@/components/ui";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { spacing, radius, getShadow, layout, transition, motion } from "@/lib/theme";
import { useScrollBottomPadding } from "@/lib/TabBarHeightContext";
import { cmpRecentDesc } from "@/lib/utils";
import { storage } from "@/lib/storage";
import { useNotesData, useNotesActions, useNotesSync, type Note } from "@/lib/NotesContext";
import {
  NoteEditor, NoteIndexRow, NoteCard, animate,
} from "@/components/notes";
import { extractTags, noteDisplayTitle } from "@/components/notes/utils";

type NotesSortBy = "recent" | "created" | "title";

const SORT_OPTIONS: [NotesSortBy, string][] = [
  ["recent",  "Recent"],
  ["created", "Added"],
  ["title",   "A–Z"],
];

function sortNotes(list: Note[], sortBy: NotesSortBy): Note[] {
  return [...list].sort((a, b) => {
    if (sortBy === "title")   return noteDisplayTitle(a).localeCompare(noteDisplayTitle(b), undefined, { sensitivity: "base" });
    if (sortBy === "created") return b.created_at.localeCompare(a.created_at);
    return cmpRecentDesc(a, b);
  });
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  const { colors, shadow } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: spacing[2.5] }}>
      <Text size="label" weight="semibold" tertiary style={{ textTransform: "uppercase" }}>
        {label}
      </Text>
      <View style={{ backgroundColor: colors.bgTertiary, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1 }}>
        <Text size="meta" tertiary>{count}</Text>
      </View>
    </View>
  );
}

/**
 * Masonry: `columns` vertical stacks, each card as tall as its own content.
 *
 * The grid was a wrapping row of equal-height tiles, so every note occupied an
 * identical rectangle whatever it held — a one-line thought took the same space
 * as a page of working, and the wall read as a spreadsheet. Letting height
 * follow content is what makes a set of notes look like a set of notes.
 *
 * Notes are dealt round-robin rather than into the shortest column: it needs no
 * measurement (heights aren't known until layout, and on web the first
 * ResizeObserver callback never arrives — see the TabBarHeightContext note), it
 * is stable as the list changes, and it keeps reading order predictable across
 * a row.
 */
function NoteCardGrid({ notes, onOpen, pageCounts, columns = 2 }: {
  notes: Note[];
  onOpen: (id: string) => void;
  pageCounts?: Map<string, number>;
  columns?: number;
}) {
  const stacks: Note[][] = Array.from({ length: columns }, () => []);
  notes.forEach((note, i) => stacks[i % columns].push(note));

  return (
    <View style={{ flexDirection: "row", gap: spacing[4], alignItems: "flex-start" }}>
      {stacks.map((stack, col) => (
        <View key={col} style={{ flex: 1, gap: spacing[4], minWidth: 0 }}>
          {stack.map(note => (
            // Motion here tracks a real change: a card genuinely entering or
            // leaving (pin, archive, filter) and sliding to its new position when
            // the sort or the pinned set changes. The old per-index mount stagger
            // animated nothing — it replayed on every visit to the screen.
            <Animated.View
              key={note.id}
              entering={FadeIn.duration(motion.base)}
              exiting={FadeOut.duration(motion.fast)}
              layout={LinearTransition.duration(motion.base)}
            >
              <NoteCard note={note} onOpen={() => onOpen(note.id)} pageCount={pageCounts?.get(note.id)} />
            </Animated.View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Which note was open when the Notes screen last unmounted. The tab screen is
 * torn down when you navigate away, so plain component state loses the open
 * note every time you glance at Home. Module scope rather than storage is the
 * point: coming back mid-session should land you where you were, while a fresh
 * launch should still open the list.
 */
let lastOpenNoteId: string | null = null;

function NotesScreen() {
  const { colors, scheme, shadow } = useTheme();
  const scrollBottom = useScrollBottomPadding();
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
  const [selectedNote, setSelectedNote] = useState<string | null>(lastOpenNoteId);
  const [openNoteId, setOpenNoteId]     = useState<string | null>(lastOpenNoteId);
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

  // Remembered across unmounts so returning to the tab reopens the same note.
  // A missing id is harmless: the lookup below falls through to the list.
  useEffect(() => {
    lastOpenNoteId = isDesktop ? selectedNote : openNoteId;
  }, [isDesktop, selectedNote, openNoteId]);

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

  // Documents only — notes with parent_id are pages of another note, reached
  // via the parent's tab strip rather than the list.
  const allNotes = useMemo(
    () => notes.filter(n => !n.archived && !n.parent_id),
    [notes]
  );

  const archivedNotes = useMemo(
    () => notes.filter(n => n.archived && !n.parent_id).sort(cmpRecentDesc),
    [notes]
  );

  // Searchable text of each document's pages, keyed by parent id.
  const pageText = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of notes) {
      if (!n.parent_id) continue;
      map.set(n.parent_id, `${map.get(n.parent_id) ?? ""} ${n.title} ${n.body}`.toLowerCase());
    }
    return map;
  }, [notes]);

  // Tab count per document (pages + the note itself), for the list badge.
  const pageCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notes) {
      if (!n.parent_id) continue;
      map.set(n.parent_id, (map.get(n.parent_id) ?? 1) + 1);
    }
    return map;
  }, [notes]);

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

  const { pinnedNotes, restNotes } = useMemo(() => {
    const q = search.toLowerCase();
    let filtered = !search ? allNotes : allNotes.filter(n => {
      const blockText = n.blocks?.map(b => b.content).join(" ") ?? "";
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        blockText.toLowerCase().includes(q) ||
        (pageText.get(n.id)?.includes(q) ?? false)
      );
    });
    if (activeTag) filtered = filtered.filter(n => extractTags(n.body).includes(activeTag));
    const sorted = sortNotes(filtered, sortBy);
    return {
      pinnedNotes: sorted.filter(n => n.pinned),
      restNotes: sorted.filter(n => !n.pinned),
    };
  }, [allNotes, pageText, search, activeTag, sortBy]);

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

  if (!loaded) {
    return (
      <GradientBackground>
        <SideSafeArea style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text size="sm" secondary>Loading…</Text>
        </SideSafeArea>
      </GradientBackground>
    );
  }

  // ── Shared controls: sort chips + archive toggle + tag filter chips ──────────
  const controls = (
    <View style={{ gap: spacing[2], marginBottom: spacing[4] }}>
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
                  {tag}
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
      <Text size="label" weight="semibold" tertiary style={{ textTransform: "uppercase", marginBottom: spacing[3] }}>
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
              {noteDisplayTitle(n)}
            </Text>
            <Pressable style={{ margin: -8, padding: 8 } as any} onPress={() => { animate(); unarchiveNote(n.id); }} hitSlop={8}>
              <Text size="xs" style={{ color: colors.accent }}>Restore</Text>
            </Pressable>
            <Pressable style={{ margin: -8, padding: 8 } as any} onPress={() => { animate(); deleteNote(n.id); }} hitSlop={8}>
              <Ionicons name="close-outline" size={14} color={colors.textTertiary} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  ) : null;

  const noMatchSubtitle = search || activeTag ? "Try a different search or tag." : "Tap + to capture a thought.";

  // ── Mobile: full-screen note editor ──────────────────────────────────────────
  if (!isDesktop) {
    // If the id points at a page, open its parent document (tab strip handles pages).
    const found = notes.find(n => n.id === openNoteId);
    const openNote = found?.parent_id ? notes.find(n => n.id === found.parent_id) ?? found : found;
    if (openNote) {
      return (
        <GradientBackground>
          <SideSafeArea style={{ flex: 1 }}>
            <NoteEditor
              note={openNote}
              onClose={() => { animate(); setOpenNoteId(null); }}
              showBackButton
              onOpenNote={id => { animate(); setOpenNoteId(id); }}
            />
          </SideSafeArea>
        </GradientBackground>
      );
    }

    const openCard = (id: string) => { animate(); setOpenNoteId(id); };

    return (
      <GradientBackground>
        <SideSafeArea style={{ flex: 1 }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing[4], paddingBottom: scrollBottom }}
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
                    ...shadow("md"),
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

              {(allNotes.length > 0 || archivedNotes.length > 0) && controls}

              {allNotes.length === 0 ? (
                <EmptyState
                  type="notes"
                  title="No notes yet"
                  subtitle="Anything worth keeping — a thought, a page of working, a list."
                  action={{ label: "Write a note", onPress: handleNewNote }}
                />
              ) : pinnedNotes.length === 0 && restNotes.length === 0 ? (
                <EmptyState type="notes" title="No notes match" subtitle={noMatchSubtitle} />
              ) : (
                <>
                  {pinnedNotes.length > 0 && (
                    <View style={{ marginBottom: spacing[5] }}>
                      <SectionLabel label="Pinned" count={pinnedNotes.length} />
                      <NoteCardGrid notes={pinnedNotes} onOpen={openCard} pageCounts={pageCounts} />
                    </View>
                  )}
                  {restNotes.length > 0 && (
                    <View>
                      <SectionLabel label="All notes" count={restNotes.length} />
                      <NoteCardGrid notes={restNotes} onOpen={openCard} pageCounts={pageCounts} />
                    </View>
                  )}
                </>
              )}

              {archiveSection}
            </ScrollView>
          </KeyboardAvoidingView>
        </SideSafeArea>
      </GradientBackground>
    );
  }

  // ── Desktop ───────────────────────────────────────────────────────────────────
  const selFound = selectedNote ? notes.find(n => n.id === selectedNote) ?? null : null;
  const openNote = selFound?.parent_id ? notes.find(n => n.id === selFound.parent_id) ?? selFound : selFound;

  // Shared by both desktop layouts.
  const newNoteButton = (
    <Pressable
      onPress={handleNewNote}
      style={({ hovered, pressed }: any) => ({
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing[2],
        paddingVertical: spacing[3],
        borderRadius: 18,
        backgroundColor: colors.textPrimary,
        opacity: hovered && !pressed ? 0.92 : 1,
        ...shadow("md"),
        ...transition("opacity, transform"),
        ...(Platform.OS === "web" ? { transform: [{ scale: pressed ? 0.98 : 1 }] } : {}),
      } as any)}
    >
      <Ionicons name="add" size={14} color={colors.bgPrimary} />
      <Text size="sm" weight="semibold" style={{ color: colors.bgPrimary }}>New note</Text>
    </Pressable>
  );

  // Nothing open → browse. A 340px list column beside a large empty placeholder
  // wasted most of the window; tiles use the whole width and make the notes
  // themselves the content rather than an index of them.
  if (!openNote) {
    return (
      <GradientBackground>
        <SideSafeArea style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: spacing[6], paddingTop: spacing[5], paddingBottom: scrollBottom }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
          >
            <View style={{ alignSelf: "center", width: "100%", maxWidth: layout.maxWidth.wide }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], marginBottom: spacing[4] }}>
                <Text size="title" weight="bold" style={{ flex: 1 }}>Notes</Text>
                <View style={{ width: 150 }}>{newNoteButton}</View>
              </View>

              {allNotes.length > 1 && (
                <View style={{ marginBottom: spacing[3] }}>
                  <SearchBar value={search} onChange={setSearch} placeholder="Search notes…" />
                </View>
              )}

              {(allNotes.length > 0 || archivedNotes.length > 0) && controls}

              {allNotes.length === 0 ? (
                <View style={{ paddingVertical: spacing[10], alignItems: "center" }}>
                  <EmptyState
                    type="notes"
                    title="No notes yet"
                    subtitle="Anything worth keeping — a thought, a page of working, a list."
                    action={{ label: "Write a note", onPress: handleNewNote }}
                  />
                </View>
              ) : pinnedNotes.length === 0 && restNotes.length === 0 ? (
                <View style={{ paddingVertical: spacing[10], alignItems: "center" }}>
                  <EmptyState type="notes" title="No notes match" subtitle={noMatchSubtitle} />
                </View>
              ) : (
                <>
                  {pinnedNotes.length > 0 && (
                    <View style={{ marginBottom: spacing[6] }}>
                      <SectionLabel label="Pinned" count={pinnedNotes.length} />
                      <NoteCardGrid notes={pinnedNotes} onOpen={id => setSelectedNote(id)} pageCounts={pageCounts} columns={4} />
                    </View>
                  )}
                  {restNotes.length > 0 && (
                    <View>
                      <SectionLabel label="All notes" count={restNotes.length} />
                      <NoteCardGrid notes={restNotes} onOpen={id => setSelectedNote(id)} pageCounts={pageCounts} columns={4} />
                    </View>
                  )}
                </>
              )}

              {archiveSection}
            </View>
          </ScrollView>
        </SideSafeArea>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SideSafeArea style={{ flex: 1 }}>
        <View style={{ flex: 1, flexDirection: "row" }}>
          {/* Left column — New note button + floating note bubbles (no divider:
              cards sit directly on the gradient, per Harry's mockup) */}
          <View style={{ width: layout.panel.column, flexShrink: 0 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: spacing[4], paddingTop: spacing[5], paddingBottom: scrollBottom }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
            >
              {/* New note — the column's primary action, top of the stack */}
              <View style={{ marginBottom: spacing[3] }}>{newNoteButton}</View>

              {allNotes.length > 1 && (
                <View style={{ marginBottom: spacing[3] }}>
                  <SearchBar value={search} onChange={setSearch} placeholder="Search notes…" />
                </View>
              )}

              {(allNotes.length > 0 || archivedNotes.length > 0) && controls}

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
                          <NoteIndexRow key={note.id} note={note} isSelected={selectedNote === note.id} onSelect={() => setSelectedNote(note.id)} pageCount={pageCounts.get(note.id)} />
                        ))}
                      </View>
                    </View>
                  )}
                  {restNotes.length > 0 && (
                    <View>
                      <SectionLabel label="All notes" count={restNotes.length} />
                      <View style={{ gap: spacing[2.5] }}>
                        {restNotes.map(note => (
                          <NoteIndexRow key={note.id} note={note} isSelected={selectedNote === note.id} onSelect={() => setSelectedNote(note.id)} pageCount={pageCounts.get(note.id)} />
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}

              {archiveSection}
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
              ...shadow("md"),
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
      </SideSafeArea>
    </GradientBackground>
  );
}

export default function NotesScreenBounded() {
  return <ErrorBoundary><NotesScreen /></ErrorBoundary>;
}
