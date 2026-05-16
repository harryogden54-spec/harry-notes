import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, ScrollView, SafeAreaView, TextInput,
  Pressable, KeyboardAvoidingView, Platform, LayoutAnimation, RefreshControl,
  useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { Text, Divider, SearchBar, EmptyState, GradientBackground } from "@/components/ui";
import { spacing, radius, fontFamily, notePastels, getNotePastelIndex } from "@/lib/theme";
import { useNotes, type Note } from "@/lib/NotesContext";
import { useLists } from "@/lib/ListsContext";
import { useToast } from "@/lib/ToastContext";
import { stripMarkdown } from "@/lib/utils";
import {
  CreateListModal,
  ListCard,
  ListDetailPane,
  ListIndexRow,
} from "./lists";

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string, colors: ReturnType<typeof useTheme>["colors"]): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  const patterns: [RegExp, (inner: string) => React.ReactNode][] = [
    [/\*\*(.+?)\*\*/s, (s) => <Text key={keyIdx++} style={{ fontFamily: fontFamily.bold, color: colors.textPrimary }}>{s}</Text>],
    [/__(.+?)__/s,     (s) => <Text key={keyIdx++} style={{ fontFamily: fontFamily.bold, color: colors.textPrimary }}>{s}</Text>],
    [/_(.+?)_/s,       (s) => <Text key={keyIdx++} style={{ fontStyle: "italic", color: colors.textSecondary }}>{s}</Text>],
    [/\*(.+?)\*/s,     (s) => <Text key={keyIdx++} style={{ fontStyle: "italic", color: colors.textSecondary }}>{s}</Text>],
    [/`(.+?)`/s,       (s) => <Text key={keyIdx++} style={{ fontFamily: "monospace" as any, fontSize: 13, color: colors.accent, backgroundColor: colors.bgTertiary }}>{` ${s} `}</Text>],
    [/\[\[(.+?)\]\]/s, (s) => <Text key={keyIdx++} style={{ color: colors.accent, textDecorationLine: "underline" }}>{s}</Text>],
  ];

  while (remaining.length > 0) {
    let earliest: { index: number; match: RegExpMatchArray; render: (s: string) => React.ReactNode } | null = null;
    for (const [regex, render] of patterns) {
      const m = remaining.match(regex);
      if (m && m.index !== undefined) {
        if (!earliest || m.index < earliest.index) earliest = { index: m.index, match: m, render };
      }
    }
    if (!earliest) {
      parts.push(<Text key={keyIdx++} style={{ color: colors.textSecondary }}>{remaining}</Text>);
      break;
    }
    if (earliest.index > 0) parts.push(<Text key={keyIdx++} style={{ color: colors.textSecondary }}>{remaining.slice(0, earliest.index)}</Text>);
    parts.push(earliest.render(earliest.match[1]));
    remaining = remaining.slice(earliest.index + earliest.match[0].length);
  }
  return parts;
}

function MarkdownView({ body, colors }: { body: string; colors: ReturnType<typeof useTheme>["colors"] }) {
  const lines = body.split("\n");
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const key = `md-${i}`;
    if (line.startsWith("### ")) nodes.push(<Text key={key} style={{ fontSize: 15, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing[3], marginBottom: spacing[1] }}>{renderInline(line.slice(4), colors)}</Text>);
    else if (line.startsWith("## ")) nodes.push(<Text key={key} style={{ fontSize: 18, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing[4], marginBottom: spacing[1.5] }}>{renderInline(line.slice(3), colors)}</Text>);
    else if (line.startsWith("# ")) nodes.push(<Text key={key} style={{ fontSize: 22, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing[5], marginBottom: spacing[2] }}>{renderInline(line.slice(2), colors)}</Text>);
    else if (line.match(/^---+$/)) nodes.push(<View key={key} style={{ height: 1, backgroundColor: colors.bgBorder, marginVertical: spacing[3] }} />);
    else if (line.match(/^[-*] /)) nodes.push(
      <View key={key} style={{ flexDirection: "row", gap: spacing[2], marginVertical: 2 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 15, lineHeight: 24 }}>•</Text>
        <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}>{renderInline(line.slice(2), colors)}</Text>
      </View>
    );
    else if (line.trim() === "") nodes.push(<View key={key} style={{ height: spacing[2] }} />);
    else nodes.push(<Text key={key} style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}>{renderInline(line, colors)}</Text>);
  }
  return <View style={{ gap: 0 }}>{nodes}</View>;
}

function animate() {
  if (Platform.OS !== "web") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Markdown toolbar helpers ─────────────────────────────────────────────────

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
  const after = text[sel.end] === "\n" ? "" : "\n";
  const insert = before + block + after;
  const next = text.slice(0, sel.start) + insert + text.slice(sel.end);
  return { text: next, cursor: { start: sel.start + insert.length, end: sel.start + insert.length } };
}

function MarkdownToolbar({ body, selRef, onApply }: {
  body: string;
  selRef: React.MutableRefObject<Sel>;
  onApply: (text: string, cursor: Sel) => void;
}) {
  const { colors } = useTheme();
  const tools = [
    { label: "B", bold: true, fn: () => { const r = insertInline(body, selRef.current, "**"); onApply(r.text, r.cursor); } },
    { label: "I", italic: true, fn: () => { const r = insertInline(body, selRef.current, "_"); onApply(r.text, r.cursor); } },
    { label: "H", fn: () => { const r = insertLinePrefix(body, selRef.current, "# "); onApply(r.text, r.cursor); } },
    { label: "H2", fn: () => { const r = insertLinePrefix(body, selRef.current, "## "); onApply(r.text, r.cursor); } },
    { label: "•", fn: () => { const r = insertLinePrefix(body, selRef.current, "- "); onApply(r.text, r.cursor); } },
    { label: "`", fn: () => { const r = insertInline(body, selRef.current, "`"); onApply(r.text, r.cursor); } },
    { label: "—", fn: () => { const r = insertBlock(body, selRef.current, "---"); onApply(r.text, r.cursor); } },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always"
      style={{ borderTopWidth: 1, borderTopColor: colors.bgBorder, backgroundColor: colors.bgSecondary }}
      contentContainerStyle={{ flexDirection: "row", paddingHorizontal: spacing[2] }}
    >
      {tools.map(t => (
        <Pressable key={t.label} onPress={t.fn} style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
          <Text size="sm" style={{ color: colors.textSecondary, fontFamily: (t as any).bold ? fontFamily.bold : fontFamily.regular, fontStyle: (t as any).italic ? "italic" : "normal" }}>
            {t.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function getWikiQuery(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos);
  const match = before.match(/\[\[([^\][]*)$/);
  return match ? match[1] : null;
}

function WikiLinkSuggestions({ query, notes, onSelect }: { query: string; notes: Note[]; onSelect: (title: string) => void }) {
  const { colors } = useTheme();
  const lower = query.toLowerCase();
  const suggestions = notes.filter(n => (n.title || "Untitled").toLowerCase().includes(lower)).slice(0, 5);
  if (suggestions.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always"
      style={{ borderTopWidth: 1, borderTopColor: `${colors.accent}44`, backgroundColor: colors.bgTertiary }}
      contentContainerStyle={{ flexDirection: "row", gap: spacing[1], paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}
    >
      {suggestions.map(n => (
        <Pressable key={n.id} onPress={() => onSelect(n.title || "Untitled")}
          style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.xl, borderWidth: 1, borderColor: `${colors.accent}60`, backgroundColor: `${colors.accent}18` }}>
          <Text size="xs" style={{ color: colors.accent }}>{n.title || "Untitled"}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Note Editor ──────────────────────────────────────────────────────────────

function NoteEditor({ note, onClose, showBackButton = true }: { note: Note; onClose: () => void; showBackButton?: boolean }) {
  const { colors } = useTheme();
  const { notes, updateNote, deleteNote, pinNote } = useNotes();
  const { showToast } = useToast();
  const titleRef = useRef<TextInput | null>(null);
  const bodyRef = useRef<TextInput | null>(null);
  const selRef = useRef<Sel>({ start: 0, end: 0 });
  const [cursor, setCursor] = useState<Sel | undefined>(undefined);
  const [preview, setPreview] = useState(false);
  const [wikiQuery, setWikiQuery] = useState<string | null>(null);

  useEffect(() => { if (!note.title) setTimeout(() => titleRef.current?.focus(), 50); }, [note.id]);
  useEffect(() => { setPreview(false); }, [note.id]);

  function handleBodyChange(body: string) {
    updateNote(note.id, { body });
    setCursor(undefined);
    setWikiQuery(getWikiQuery(body, selRef.current.start));
  }

  function handleWikiSelect(title: string) {
    const pos = selRef.current.start;
    const replaced = note.body.slice(0, pos).replace(/\[\[([^\][]*)$/, `[[${title}]]`);
    const newBody = replaced + note.body.slice(pos);
    updateNote(note.id, { body: newBody });
    setCursor({ start: replaced.length, end: replaced.length });
    setWikiQuery(null);
  }

  const wordCount = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.bgBorder }}>
          {showBackButton && (
            <Pressable onPress={onClose} hitSlop={12} style={{ padding: spacing[1] }}>
              <Text size="sm" style={{ color: colors.accent }}>← Back</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Text size="xs" secondary>{timeAgo(note.updated_at ?? note.created_at)}</Text>
          <Pressable onPress={() => setPreview(v => !v)} hitSlop={12}
            style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[0.5], borderRadius: radius.sm, borderWidth: 1, borderColor: preview ? colors.accent : colors.bgBorder, backgroundColor: preview ? `${colors.accent}14` : "transparent" }}>
            <Text size="xs" weight={preview ? "semibold" : "regular"} style={{ color: preview ? colors.accent : colors.textTertiary }}>{preview ? "Edit" : "Preview"}</Text>
          </Pressable>
          <Pressable onPress={() => { pinNote(note.id); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} hitSlop={12} style={{ padding: spacing[1] }}>
            <Text size="sm" style={{ color: note.pinned ? colors.accent : colors.textTertiary }}>{note.pinned ? "📌" : "📍"}</Text>
          </Pressable>
          <Pressable onPress={() => { const undo = deleteNote(note.id); onClose(); showToast("Note deleted", { label: "Undo", onPress: undo }); if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }} hitSlop={12} style={{ padding: spacing[1] }}>
            <Text size="xs" style={{ color: colors.danger }}>Delete</Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing[4], gap: spacing[3] }} keyboardShouldPersistTaps="handled">
          <TextInput ref={titleRef} value={note.title} onChangeText={title => updateNote(note.id, { title })}
            placeholder="Title" placeholderTextColor={colors.textTertiary} returnKeyType="next"
            onSubmitEditing={() => { setPreview(false); bodyRef.current?.focus(); }}
            style={[{ color: colors.textPrimary, fontSize: 22, fontFamily: fontFamily.bold, lineHeight: 30, marginBottom: spacing[2] }, { outlineStyle: "none" } as any]}
          />
          {preview ? (
            note.body.trim()
              ? <MarkdownView body={note.body} colors={colors} />
              : <Text size="sm" tertiary style={{ fontStyle: "italic" }}>Nothing to preview yet.</Text>
          ) : (
            <TextInput ref={bodyRef} value={note.body} onChangeText={handleBodyChange}
              onSelectionChange={e => { selRef.current = e.nativeEvent.selection; }} selection={cursor}
              placeholder="Start writing…" placeholderTextColor={colors.textTertiary} multiline textAlignVertical="top"
              style={[{ color: colors.textSecondary, fontSize: 15, lineHeight: 24, minHeight: 300 }, { outlineStyle: "none" } as any]}
            />
          )}
        </ScrollView>

        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.bgBorder }}>
          <Text size="xs" tertiary>{wordCount} word{wordCount !== 1 ? "s" : ""} · {note.body.length} chars</Text>
        </View>

        {!preview && wikiQuery !== null && (
          <WikiLinkSuggestions query={wikiQuery} notes={notes.filter(n => n.id !== note.id && n.type === "note")} onSelect={handleWikiSelect} />
        )}
        {!preview && (
          <MarkdownToolbar body={note.body} selRef={selRef} onApply={(text, cur) => { updateNote(note.id, { body: text }); setCursor(cur); setWikiQuery(null); }} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Note Index Row (desktop left pane) ──────────────────────────────────────

function NoteIndexRow({ note, isSelected, onSelect }: { note: Note; isSelected: boolean; onSelect: () => void }) {
  const { colors } = useTheme();
  const accentColor = notePastels.bg[getNotePastelIndex(note.id)];
  const preview = stripMarkdown(note.body.trim()).slice(0, 120);
  return (
    <Pressable onPress={onSelect} style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3], backgroundColor: isSelected ? colors.bgTertiary : "transparent", borderLeftWidth: 2, borderLeftColor: isSelected ? accentColor : "transparent", gap: spacing[0.5] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
        {note.pinned && <Text size="xs" style={{ color: colors.accent }}>📌</Text>}
        <Text size="sm" weight={isSelected ? "semibold" : "regular"} numberOfLines={1} style={{ flex: 1, color: note.title ? colors.textPrimary : colors.textTertiary }}>
          {note.title || "Untitled"}
        </Text>
        <Text size="xs" tertiary style={{ flexShrink: 0 }}>{timeAgo(note.updated_at ?? note.created_at)}</Text>
      </View>
      {preview ? <Text size="xs" secondary numberOfLines={1}>{preview}</Text> : <Text size="xs" tertiary numberOfLines={1}>No content</Text>}
    </Pressable>
  );
}

// ─── Note Card (mobile grid card) ────────────────────────────────────────────

function NoteCard({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const { pinNote } = useNotes();
  const idx = getNotePastelIndex(note.id);
  const preview = stripMarkdown(note.body.trim());
  return (
    <Pressable onPress={onOpen} onLongPress={() => { pinNote(note.id); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }} style={{ flex: 1 }}>
      <View style={{ backgroundColor: notePastels.bg[idx], borderRadius: 12, borderWidth: 1, borderColor: notePastels.border[idx], padding: spacing[3], gap: spacing[1], minHeight: 90 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
          {note.pinned && <Text size="xs" style={{ color: notePastels.text }}>📌</Text>}
          <Text size="xs" numberOfLines={1} style={{ flex: 1, fontFamily: fontFamily.semibold, color: note.title ? notePastels.text : `${notePastels.text}80` }}>
            {note.title || "Untitled"}
          </Text>
        </View>
        {preview ? <Text size="xs" numberOfLines={3} style={{ color: `${notePastels.text}CC`, lineHeight: 17 }}>{preview}</Text> : null}
        <Text size="xs" style={{ color: `${notePastels.text}60`, marginTop: "auto" as any, fontSize: 10 }}>{timeAgo(note.updated_at ?? note.created_at)}</Text>
      </View>
    </Pressable>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ label, count, onAdd, addLabel }: { label: string; count: number; onAdd: () => void; addLabel: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1 }}>{label}</Text>
        {count > 0 && <Text size="xs" tertiary>({count})</Text>}
      </View>
      <Pressable onPress={onAdd} hitSlop={12} style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[0.5], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}>
        <Text size="xs" secondary>+ {addLabel}</Text>
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotesScreen() {
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

  const [search, setSearch] = useState("");

  // Desktop selection: either a note or a list
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<string | null>(null);

  // Mobile: open note full-screen
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  // Mobile: expanded list card
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  // Create list modal
  const [creatingList, setCreatingList] = useState(false);

  const params = useLocalSearchParams<{ create?: string; listId?: string; openId?: string }>();
  const handledParam = useRef(false);

  useEffect(() => {
    if (!loaded || handledParam.current) return;
    if (params.create === "note") {
      handledParam.current = true;
      const id = addNote("note");
      if (isDesktop) setSelectedNote(id);
      else setOpenNoteId(id);
    } else if (params.create === "list") {
      handledParam.current = true;
      setCreatingList(true);
    } else if (params.listId) {
      handledParam.current = true;
      if (isDesktop) setSelectedList(params.listId);
      else setExpandedListId(params.listId);
    } else if (params.openId) {
      handledParam.current = true;
      if (isDesktop) setSelectedNote(params.openId);
      else setOpenNoteId(params.openId);
    }
  }, [loaded, params.create, params.listId, params.openId, addNote, isDesktop]);

  // Desktop: auto-select first list when loaded
  useEffect(() => {
    if (isDesktop && loaded && !selectedNote && !selectedList && lists.length > 0) setSelectedList(lists[0].id);
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

  // Desktop: auto-select newly created note
  const prevNotesLen = useRef(0);
  useEffect(() => {
    if (isDesktop && filteredNotes.length > prevNotesLen.current && prevNotesLen.current > 0) {
      const newest = [...filteredNotes].sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))[0];
      if (newest) { setSelectedNote(newest.id); setSelectedList(null); }
    }
    prevNotesLen.current = filteredNotes.length;
  });

  const fullNotes = notes.filter(n => n.type === "note" || !n.type);

  const filteredNotes = fullNotes.filter(n => {
    if (!search) return true;
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
  });

  const filteredLists = lists.filter(l => {
    if (!search) return true;
    return l.name.toLowerCase().includes(search.toLowerCase());
  });

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
            <NoteEditor note={openNote} onClose={() => { animate(); setOpenNoteId(null); }} showBackButton />
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

              {/* Lists section */}
              <SectionHeader label="Lists" count={filteredLists.length} onAdd={() => setCreatingList(true)} addLabel="New list" />
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

              {/* Notes section */}
              <SectionHeader label="Notes" count={filteredNotes.length} onAdd={handleNewNote} addLabel="New note" />
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

          {/* Left pane — unified index */}
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

          {/* Right pane — detail / editor */}
          <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
            {openNote ? (
              <NoteEditor key={openNote.id} note={openNote} onClose={() => setSelectedNote(null)} showBackButton={false} />
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
