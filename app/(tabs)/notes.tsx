import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, ScrollView, SafeAreaView, TextInput,
  Pressable, KeyboardAvoidingView, Platform, LayoutAnimation,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { Text, Divider, SearchBar, EmptyState, GlassCard } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";
import { useNotes, type Note } from "@/lib/NotesContext";
import { useToast } from "@/lib/ToastContext";

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

// ─── Markdown preview strip ───────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")   // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1")    // italic *
    .replace(/__(.+?)__/g, "$1")    // bold __
    .replace(/_(.+?)_/g, "$1")      // italic _
    .replace(/`(.+?)`/g, "$1")      // inline code
    .replace(/^[-*]\s+/gm, "")      // bullets
    .replace(/^---+$/gm, "")        // hr
    .trim();
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
              fontWeight: t.bold ? "700" : "400",
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

// ─── Note Editor ──────────────────────────────────────────────────────────────

function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const { colors } = useTheme();
  const { updateNote, deleteNote } = useNotes();
  const { showToast } = useToast();
  const bodyRef   = useRef<TextInput | null>(null);
  const selRef    = useRef<Sel>({ start: 0, end: 0 });
  const [cursor, setCursor] = useState<Sel | undefined>(undefined);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
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
              const undo = deleteNote(note.id);
              onClose();
              showToast("Note deleted", { label: "Undo", onPress: undo });
              if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }}
            hitSlop={12}
            style={{ padding: spacing[1] }}
          >
            <Text size="xs" style={{ color: "#F26464" }}>Delete</Text>
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
              { color: colors.textPrimary, fontSize: 22, fontWeight: "700", lineHeight: 30, marginBottom: spacing[2] },
              // @ts-ignore
              { outlineStyle: "none" },
            ]}
          />
          <TextInput
            ref={bodyRef}
            value={note.body}
            onChangeText={body => {
              updateNote(note.id, { body });
              setCursor(undefined);
            }}
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
        <MarkdownToolbar
          body={note.body}
          selRef={selRef}
          onApply={(text, cur) => {
            updateNote(note.id, { body: text });
            setCursor(cur);
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotesScreen() {
  const { colors } = useTheme();
  const { notes, addNote, loaded } = useNotes();
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: "center", alignItems: "center" }}>
        <Text size="sm" secondary>Loading…</Text>
      </SafeAreaView>
    );
  }

  // Show editor when a note is open
  const openNote = notes.find(n => n.id === openId);
  if (openNote) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        <NoteEditor note={openNote} onClose={() => { animate(); setOpenId(null); }} />
      </SafeAreaView>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16], ...webContentStyle }} keyboardShouldPersistTaps="handled">

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
    </SafeAreaView>
  );
}
