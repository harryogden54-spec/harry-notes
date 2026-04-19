import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, ScrollView, SafeAreaView, TextInput,
  Pressable, KeyboardAvoidingView, Platform, LayoutAnimation, Modal, RefreshControl,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { Text, Divider, SearchBar, EmptyState, GlassCard, GradientBackground } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";
import { useNotes, type Note } from "@/lib/NotesContext";
import { useToast } from "@/lib/ToastContext";
import { useStickyNotes, STICKY_COLOURS, type StickyNote } from "@/lib/StickyNotesContext";
import { stripMarkdown } from "@/lib/utils";

function animate() {
  if (Platform.OS !== "web") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Markdown helpers ─────────────────────────────────────────────────────────

type Sel = { start: number; end: number };

function insertInline(text: string, sel: Sel, mark: string): { text: string; cursor: Sel } {
  const selected = text.slice(sel.start, sel.end);
  if (selected) {
    const next = text.slice(0, sel.start) + mark + selected + mark + text.slice(sel.end);
    return { text: next, cursor: { start: sel.start + mark.length, end: sel.end + mark.length } };
  }
  const next = text.slice(0, sel.start) + mark + mark + text.slice(sel.start);
  return { text: next, cursor: { start: sel.start + mark.length, end: sel.start + mark.length } };
}

function insertLinePrefix(text: string, sel: Sel, prefix: string): { text: string; cursor: Sel } {
  const lineStart = text.lastIndexOf("\n", sel.start - 1) + 1;
  const next = text.slice(0, lineStart) + prefix + text.slice(lineStart);
  return { text: next, cursor: { start: sel.start + prefix.length, end: sel.end + prefix.length } };
}

function insertBlock(text: string, sel: Sel, block: string): { text: string; cursor: Sel } {
  const before = text[sel.start - 1] === "\n" ? "" : "\n";
  const after  = text[sel.end] === "\n" ? "" : "\n";
  const insert = before + block + after;
  const next   = text.slice(0, sel.start) + insert + text.slice(sel.end);
  return { text: next, cursor: { start: sel.start + insert.length, end: sel.start + insert.length } };
}

// ─── Markdown toolbar ─────────────────────────────────────────────────────────

function MarkdownToolbar({ body, selRef, onApply }: {
  body: string;
  selRef: React.MutableRefObject<Sel>;
  onApply: (text: string, cursor: Sel) => void;
}) {
  const { colors } = useTheme();

  const tools: { label: string; bold?: boolean; italic?: boolean; fn: () => void }[] = [
    { label: "B", bold: true,   fn: () => { const r = insertInline(body, selRef.current, "**");     onApply(r.text, r.cursor); } },
    { label: "I", italic: true, fn: () => { const r = insertInline(body, selRef.current, "_");      onApply(r.text, r.cursor); } },
    { label: "H", fn: () => { const r = insertLinePrefix(body, selRef.current, "# ");  onApply(r.text, r.cursor); } },
    { label: "H2", fn: () => { const r = insertLinePrefix(body, selRef.current, "## "); onApply(r.text, r.cursor); } },
    { label: "•", fn: () => { const r = insertLinePrefix(body, selRef.current, "- ");  onApply(r.text, r.cursor); } },
    { label: "`", fn: () => { const r = insertInline(body, selRef.current, "`");       onApply(r.text, r.cursor); } },
    { label: "—", fn: () => { const r = insertBlock(body, selRef.current, "---");      onApply(r.text, r.cursor); } },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={{ borderTopWidth: 1, borderTopColor: colors.bgBorder, backgroundColor: colors.bgSecondary }}
      contentContainerStyle={{ flexDirection: "row", paddingHorizontal: spacing[2] }}
    >
      {tools.map(t => (
        <Pressable
          key={t.label}
          onPress={t.fn}
          style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}
        >
          <Text
            size="sm"
            style={{
              color: colors.textSecondary,
              fontFamily: t.bold ? fontFamily.bold : fontFamily.regular,
              fontStyle: t.italic ? "italic" : "normal",
            }}
          >
            {t.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Wiki-link autocomplete ───────────────────────────────────────────────────

/** Detects an open [[query at the cursor and returns the query string, or null */
function getWikiQuery(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos);
  const match  = before.match(/\[\[([^\][]*)$/);
  return match ? match[1] : null;
}

function WikiLinkSuggestions({ query, notes, onSelect }: {
  query: string;
  notes: Note[];
  onSelect: (title: string) => void;
}) {
  const { colors } = useTheme();
  const lower = query.toLowerCase();
  const suggestions = notes
    .filter(n => (n.title || "Untitled").toLowerCase().includes(lower))
    .slice(0, 5);

  if (suggestions.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={{ borderTopWidth: 1, borderTopColor: colors.accent + "44", backgroundColor: colors.bgTertiary }}
      contentContainerStyle={{ flexDirection: "row", gap: spacing[1], paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}
    >
      {suggestions.map(n => (
        <Pressable
          key={n.id}
          onPress={() => onSelect(n.title || "Untitled")}
          style={{
            paddingHorizontal: spacing[3], paddingVertical: spacing[1],
            borderRadius: radius.xl, borderWidth: 1,
            borderColor: colors.accent + "60",
            backgroundColor: colors.accent + "18",
          }}
        >
          <Text size="xs" style={{ color: colors.accent }}>{n.title || "Untitled"}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Note Editor ──────────────────────────────────────────────────────────────

function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const { colors } = useTheme();
  const { notes, updateNote, deleteNote, pinNote } = useNotes();
  const { showToast } = useToast();
  const bodyRef   = useRef<TextInput | null>(null);
  const selRef    = useRef<Sel>({ start: 0, end: 0 });
  const [cursor, setCursor] = useState<Sel | undefined>(undefined);

  // Wiki-link autocomplete state
  const [wikiQuery, setWikiQuery] = useState<string | null>(null);

  function handleBodyChange(body: string) {
    updateNote(note.id, { body });
    setCursor(undefined);
    const query = getWikiQuery(body, selRef.current.start);
    setWikiQuery(query);
  }

  function handleWikiSelect(title: string) {
    const pos  = selRef.current.start;
    const before = note.body.slice(0, pos);
    const after  = note.body.slice(pos);
    // Replace the open [[ + partial query with [[Title]]
    const replaced = before.replace(/\[\[([^\][]*)$/, `[[${title}]]`);
    const newBody  = replaced + after;
    const newCursorPos = replaced.length;
    updateNote(note.id, { body: newBody });
    setCursor({ start: newCursorPos, end: newCursorPos });
    setWikiQuery(null);
  }

  const wordCount = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;
  const charCount = note.body.length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1 }}>
        {/* Toolbar */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: spacing[2],
          paddingHorizontal: spacing[4], paddingVertical: spacing[3],
          borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
        }}>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: spacing[1] }}>
            <Text size="sm" style={{ color: colors.accent }}>← Back</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text size="xs" secondary>{timeAgo(note.updated_at ?? note.created_at)}</Text>
          <Pressable
            onPress={() => {
              pinNote(note.id);
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={12}
            style={{ padding: spacing[1] }}
          >
            <Text size="sm" style={{ color: note.pinned ? colors.accent : colors.textTertiary }}>
              {note.pinned ? "📌" : "📍"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const undo = deleteNote(note.id);
              onClose();
              showToast("Note deleted", { label: "Undo", onPress: undo });
              if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }}
            hitSlop={12}
            style={{ padding: spacing[1] }}
          >
            <Text size="xs" style={{ color: colors.danger }}>Delete</Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing[4], gap: spacing[3], ...webContentStyle }} keyboardShouldPersistTaps="handled">
          <TextInput
            value={note.title}
            onChangeText={title => updateNote(note.id, { title })}
            placeholder="Title"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="next"
            onSubmitEditing={() => bodyRef.current?.focus()}
            style={[
              { color: colors.textPrimary, fontSize: 22, fontFamily: fontFamily.bold, lineHeight: 30, marginBottom: spacing[2] },
              // @ts-ignore
              { outlineStyle: "none" },
            ]}
          />
          <TextInput
            ref={bodyRef}
            value={note.body}
            onChangeText={handleBodyChange}
            onSelectionChange={e => { selRef.current = e.nativeEvent.selection; }}
            selection={cursor}
            placeholder="Start writing…"
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
            style={[
              { color: colors.textSecondary, fontSize: 15, lineHeight: 24, minHeight: 300 },
              // @ts-ignore
              { outlineStyle: "none" },
            ]}
          />
        </ScrollView>

        {/* Word count footer */}
        <View style={{
          flexDirection: "row", justifyContent: "flex-end",
          paddingHorizontal: spacing[4], paddingVertical: spacing[2],
          borderTopWidth: 1, borderTopColor: colors.bgBorder,
        }}>
          <Text size="xs" tertiary>{wordCount} word{wordCount !== 1 ? "s" : ""} · {charCount} chars</Text>
        </View>

        {wikiQuery !== null && (
          <WikiLinkSuggestions
            query={wikiQuery}
            notes={notes.filter(n => n.id !== note.id)}
            onSelect={handleWikiSelect}
          />
        )}
        <MarkdownToolbar
          body={note.body}
          selRef={selRef}
          onApply={(text, cur) => {
            updateNote(note.id, { body: text });
            setCursor(cur);
            setWikiQuery(null);
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const { colors } = useTheme();
  const { pinNote } = useNotes();
  const preview = stripMarkdown(note.body.split("\n").find(l => l.trim()) ?? "");

  return (
    <Pressable
      onPress={onOpen}
      onLongPress={() => {
        pinNote(note.id);
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
      style={{ marginBottom: spacing[2] }}
    >
      <GlassCard style={{
        borderColor: note.pinned ? colors.accent : undefined,
        padding: spacing[4],
        gap: spacing[1],
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
          {note.pinned && <Text size="xs" style={{ color: colors.accent }}>📌</Text>}
          <Text size="sm" weight="semibold" style={{
            flex: 1,
            color: note.title ? colors.textPrimary : colors.textTertiary,
          }} numberOfLines={1}>
            {note.title || "Untitled"}
          </Text>
          <Text size="xs" secondary>{timeAgo(note.updated_at ?? note.created_at)}</Text>
        </View>
        {preview ? (
          <Text size="xs" secondary numberOfLines={2} style={{ lineHeight: 18 }}>{preview}</Text>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

// ─── Sticky note modal ────────────────────────────────────────────────────────

function StickyNoteModal({ note, visible, onClose }: {
  note: StickyNote | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { updateNote, deleteNote } = useStickyNotes();
  const [content, setContent] = useState(note?.content ?? "");

  useEffect(() => { setContent(note?.content ?? ""); }, [note]);

  if (!note) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing[6] }}
        onPress={onClose}
      >
        <Pressable onPress={e => e.stopPropagation?.()}>
          <GlassCard style={{ borderLeftWidth: 4, borderLeftColor: note.colour }}>
            <View style={{ gap: spacing[3] }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", gap: spacing[1.5], alignItems: "center" }}>
                  <View style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: note.colour }} />
                  <Text size="xs" secondary>Quick note</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text size="xs" style={{ color: colors.textTertiary }}>✕</Text>
                </Pressable>
              </View>
              <TextInput
                value={content}
                onChangeText={setContent}
                onBlur={() => updateNote(note.id, content)}
                placeholder="Note content…"
                placeholderTextColor={colors.textTertiary}
                multiline
                autoFocus
                style={[
                  { color: colors.textPrimary, fontSize: 14, lineHeight: 22, minHeight: 100, textAlignVertical: "top" },
                  // @ts-ignore
                  { outlineStyle: "none" },
                ]}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing[2] }}>
                <Pressable
                  onPress={() => { deleteNote(note.id); onClose(); }}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: `${colors.danger}44` }}
                >
                  <Text size="xs" style={{ color: colors.danger }}>Delete</Text>
                </Pressable>
                <Pressable
                  onPress={() => { updateNote(note.id, content); onClose(); }}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, backgroundColor: colors.accent }}
                >
                  <Text size="xs" weight="medium" style={{ color: "#fff" }}>Save</Text>
                </Pressable>
              </View>
            </View>
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotesScreen() {
  const { colors } = useTheme();
  const { notes, addNote, loaded, syncNow } = useNotes();
  const { notes: stickyNotes } = useStickyNotes();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);
  const [editingSticky, setEditingSticky] = useState<StickyNote | null>(null);
  const [search, setSearch]         = useState("");
  const [openId, setOpenId]         = useState<string | null>(null);
  const params = useLocalSearchParams<{ create?: string; openId?: string }>();
  const handledParam = useRef(false);

  useEffect(() => {
    if (!loaded || handledParam.current) return;
    if (params.openId) {
      handledParam.current = true;
      setOpenId(params.openId);
    } else if (params.create === "1") {
      handledParam.current = true;
      const id = addNote();
      setOpenId(id);
    }
  }, [loaded, params.create, params.openId, addNote]);

  const handleNew = useCallback(() => {
    const id = addNote();
    animate();
    setOpenId(id);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [addNote]);

  if (!loaded) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text size="sm" secondary>Loading…</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // Show editor when a note is open
  const openNote = notes.find(n => n.id === openId);
  if (openNote) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <NoteEditor note={openNote} onClose={() => { animate(); setOpenId(null); }} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const filtered = notes.filter(n => {
    if (!search) return true;
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
  });

  const pinned   = filtered.filter(n => n.pinned);
  const unpinned = filtered.filter(n => !n.pinned);

  return (
    <GradientBackground>
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16], ...webContentStyle }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing[4], paddingBottom: spacing[5] }}>
          <View>
            <Text size="2xl" weight="bold">Notes</Text>
            <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
              {notes.length > 0 ? `${notes.length} note${notes.length !== 1 ? "s" : ""}` : "No notes yet"}
            </Text>
          </View>
          <Pressable
            onPress={handleNew}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, backgroundColor: colors.accent }}
          >
            <Text style={{ color: "#fff", fontSize: 16, lineHeight: 20 }}>+</Text>
            <Text size="sm" weight="medium" style={{ color: "#fff" }}>New note</Text>
          </Pressable>
        </View>

        {/* ── Sticky notes grid ─────────────────────────────────────────── */}
        {stickyNotes.length > 0 && (
          <View style={{ marginBottom: spacing[6] }}>
            <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.textSecondary, fontFamily: fontFamily.semibold, textTransform: "uppercase", marginBottom: spacing[3] }}>
              QUICK NOTES · {stickyNotes.length}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {stickyNotes.map(n => (
                <Pressable
                  key={n.id}
                  onPress={() => setEditingSticky(n)}
                  style={{ width: "48%" as any }}
                >
                  <GlassCard style={{
                    borderLeftWidth: 3, borderLeftColor: n.colour,
                    padding: spacing[3], minHeight: 72,
                  }}>
                    <Text
                      size="xs"
                      numberOfLines={4}
                      style={{ color: n.content ? colors.textPrimary : colors.textTertiary, lineHeight: 18 }}
                    >
                      {n.content || "Empty note"}
                    </Text>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
            <Divider style={{ marginTop: spacing[4] }} />
          </View>
        )}

        {notes.length > 1 && <SearchBar value={search} onChange={setSearch} placeholder="Search notes…" />}

        {filtered.length === 0 ? (
          <EmptyState
            type="notes"
            title={search ? "No notes match" : "No notes yet"}
            subtitle={search ? "Try a different search term." : 'Tap "New note" to start writing.\nLong-press any note to pin it.'}
          />
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[2] }}>Pinned</Text>
                {pinned.map(n => <NoteCard key={n.id} note={n} onOpen={() => { animate(); setOpenId(n.id); }} />)}
                {unpinned.length > 0 && <Divider style={{ marginVertical: spacing[3] }} />}
              </>
            )}
            {unpinned.map(n => <NoteCard key={n.id} note={n} onOpen={() => { animate(); setOpenId(n.id); }} />)}
          </>
        )}
      </ScrollView>

      {/* Sticky note edit modal */}
      <StickyNoteModal
        note={editingSticky}
        visible={!!editingSticky}
        onClose={() => setEditingSticky(null)}
      />
    </SafeAreaView>
    </GradientBackground>
  );
}
