import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useNotes, type Note } from "@/lib/NotesContext";
import { useToast } from "@/lib/ToastContext";
import { MarkdownView } from "./MarkdownView";
import { MarkdownToolbar, type Sel } from "./MarkdownToolbar";
import { WikiLinkSuggestions, getWikiQuery } from "./WikiLinkSuggestions";
import { timeAgo } from "./utils";

function BacklinksPanel({ note, allNotes, onOpen }: { note: Note; allNotes: Note[]; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const title = note.title || "Untitled";
  const pattern = `[[${title}]]`;
  const linkedFrom = allNotes.filter(n => n.id !== note.id && n.body.includes(pattern));
  if (linkedFrom.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: colors.bgBorder }}>
      <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[2] }}>
        Linked from ({linkedFrom.length})
      </Text>
      <View style={{ gap: spacing[1.5] }}>
        {linkedFrom.map(n => (
          <Pressable
            key={n.id}
            onPress={() => onOpen(n.id)}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
          >
            <View style={{ width: 4, height: 4, borderRadius: 99, backgroundColor: colors.accent }} />
            <Text size="xs" style={{ color: colors.accent, textDecorationLine: "underline" }}>
              {n.title || "Untitled"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type Props = {
  note: Note;
  onClose: () => void;
  showBackButton?: boolean;
  onOpenNote?: (id: string) => void;
};

export function NoteEditor({ note, onClose, showBackButton = true, onOpenNote }: Props) {
  const { colors } = useTheme();
  const { notes, updateNote, deleteNote, pinNote } = useNotes();
  const { showToast } = useToast();
  const titleRef = useRef<TextInput | null>(null);
  const bodyRef  = useRef<TextInput | null>(null);
  const selRef   = useRef<Sel>({ start: 0, end: 0 });
  const [cursor, setCursor]       = useState<Sel | undefined>(undefined);
  const [preview, setPreview]     = useState(false);
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

  const handleOpenNote = useCallback((id: string) => {
    onOpenNote?.(id);
  }, [onOpenNote]);

  const wordCount = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;
  const allNotes = notes.filter(n => n.type === "note" || !n.type);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.bgBorder }}>
          {showBackButton && (
            <Pressable onPress={onClose} hitSlop={12} style={{ padding: spacing[1] }}>
              <Text size="sm" style={{ color: colors.accent }}>← Back</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Text size="xs" secondary>{timeAgo(note.updated_at ?? note.created_at)}</Text>
          <Pressable
            onPress={() => setPreview(v => !v)}
            hitSlop={12}
            style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[0.5], borderRadius: radius.sm, borderWidth: 1, borderColor: preview ? colors.accent : colors.bgBorder, backgroundColor: preview ? `${colors.accent}14` : "transparent" }}
          >
            <Text size="xs" weight={preview ? "semibold" : "regular"} style={{ color: preview ? colors.accent : colors.textTertiary }}>
              {preview ? "Edit" : "Preview"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { pinNote(note.id); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
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

        {/* Body */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing[4], gap: spacing[3] }} keyboardShouldPersistTaps="handled">
          <TextInput
            ref={titleRef}
            value={note.title}
            onChangeText={title => updateNote(note.id, { title })}
            placeholder="Title"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="next"
            onSubmitEditing={() => { setPreview(false); bodyRef.current?.focus(); }}
            style={[{ color: colors.textPrimary, fontSize: 22, fontFamily: fontFamily.bold, lineHeight: 30, marginBottom: spacing[2] }, { outlineStyle: "none" } as any]}
          />
          {preview ? (
            note.body.trim()
              ? <MarkdownView body={note.body} colors={colors} />
              : <Text size="sm" tertiary style={{ fontStyle: "italic" }}>Nothing to preview yet.</Text>
          ) : (
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
              style={[{ color: colors.textSecondary, fontSize: 15, lineHeight: 24, minHeight: 300 }, { outlineStyle: "none" } as any]}
            />
          )}
        </ScrollView>

        {/* Backlinks */}
        <BacklinksPanel note={note} allNotes={allNotes} onOpen={handleOpenNote} />

        {/* Footer */}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.bgBorder }}>
          <Text size="xs" tertiary>{wordCount} word{wordCount !== 1 ? "s" : ""} · {note.body.length} chars</Text>
        </View>

        {!preview && wikiQuery !== null && (
          <WikiLinkSuggestions
            query={wikiQuery}
            notes={allNotes.filter(n => n.id !== note.id)}
            onSelect={handleWikiSelect}
          />
        )}
        {!preview && (
          <MarkdownToolbar
            body={note.body}
            selRef={selRef}
            onApply={(text, cur) => { updateNote(note.id, { body: text }); setCursor(cur); setWikiQuery(null); }}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
