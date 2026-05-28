import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { View, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useNotes, type Note } from "@/lib/NotesContext";
import { useTasks } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { getTodayStr } from "@/lib/utils";
import { MarkdownView } from "./MarkdownView";
import { MarkdownToolbar, type Sel } from "./MarkdownToolbar";
import { WikiLinkSuggestions, getWikiQuery } from "./WikiLinkSuggestions";
import { BlockEditor } from "./BlockEditor";
import { timeAgo } from "./utils";

function BacklinksPanel({ note, allNotes, onOpen }: { note: Note; allNotes: Note[]; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const title = note.title || "Untitled";

  // Incoming: notes that contain [[this note's title]]
  const linkedFrom = allNotes.filter(n => n.id !== note.id && n.body.includes(`[[${title}]]`));

  // Outgoing: notes this note references via [[Title]]
  const wikiPattern = /\[\[([^\][\n]+)\]\]/g;
  const referencedTitles = new Set<string>();
  for (const m of note.body.matchAll(wikiPattern)) {
    referencedTitles.add(m[1]);
  }
  const linkedTo = allNotes.filter(n => n.id !== note.id && referencedTitles.has(n.title || "Untitled"));

  if (linkedFrom.length === 0 && linkedTo.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: colors.bgBorder, gap: spacing[2.5] }}>
      {linkedTo.length > 0 && (
        <View>
          <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[1.5] }}>
            Links to · {linkedTo.length}
          </Text>
          <View style={{ gap: spacing[1] }}>
            {linkedTo.map(n => (
              <Pressable
                key={n.id}
                onPress={() => onOpen(n.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
              >
                <Text size="xs" style={{ color: colors.textTertiary }}>→</Text>
                <Text size="xs" style={{ color: colors.accent, textDecorationLine: "underline" }}>
                  {n.title || "Untitled"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {linkedFrom.length > 0 && (
        <View>
          <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[1.5] }}>
            Linked from · {linkedFrom.length}
          </Text>
          <View style={{ gap: spacing[1] }}>
            {linkedFrom.map(n => (
              <Pressable
                key={n.id}
                onPress={() => onOpen(n.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
              >
                <Text size="xs" style={{ color: colors.textTertiary }}>←</Text>
                <Text size="xs" style={{ color: colors.accent, textDecorationLine: "underline" }}>
                  {n.title || "Untitled"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
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
  const { notes, updateNote, deleteNote, pinNote, toggleBlockCheck } = useNotes();
  const { tasks } = useTasks();
  const { showToast } = useToast();
  const today = getTodayStr();
  const titleRef = useRef<TextInput | null>(null);
  const bodyRef  = useRef<TextInput | null>(null);
  const selRef   = useRef<Sel>({ start: 0, end: 0 });
  const [cursor, setCursor]       = useState<Sel | undefined>(undefined);
  const [preview, setPreview]     = useState(false);
  const [wikiQuery, setWikiQuery] = useState<string | null>(null);

  // Track the title as it was when editing began so we can propagate renames.
  const committedTitleRef = useRef(note.title);
  useEffect(() => { committedTitleRef.current = note.title; }, [note.id]);

  useEffect(() => { if (!note.title) setTimeout(() => titleRef.current?.focus(), 50); }, [note.id]);
  useEffect(() => { setPreview(false); }, [note.id]);

  // Propagate title renames to all notes that contain [[oldTitle]].
  // Runs on blur/submit so we don't rewrite on every keystroke.
  function handleTitleCommit() {
    const oldTitle = committedTitleRef.current;
    const newTitle = note.title;
    committedTitleRef.current = newTitle;
    if (!oldTitle || oldTitle === newTitle) return;
    const pattern = `[[${oldTitle}]]`;
    const replacement = `[[${newTitle || "Untitled"}]]`;
    let count = 0;
    for (const n of notes) {
      if (n.id !== note.id && n.body.includes(pattern)) {
        updateNote(n.id, { body: n.body.split(pattern).join(replacement) });
        count++;
      }
    }
    if (count > 0) showToast(`Updated ${count} link${count !== 1 ? "s" : ""}`);
  }

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

  const openTasks = tasks.filter(t => !t.done && !t.archived);
  const replCtx = useMemo(() => ({
    tasksOverdue: openTasks.filter(t => !!t.due_date && t.due_date < today).length,
    tasksToday:   openTasks.filter(t => t.due_date === today).length,
    tasksOpen:    openTasks.length,
    notesCount:   allNotes.length,
    tasksDueIn:   (n: number) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + n);
      const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
      return openTasks.filter(t => !!t.due_date && t.due_date >= today && t.due_date <= cutoffStr).length;
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [openTasks.length, today, allNotes.length]);

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
          {/* Preview toggle only for legacy plain-text notes */}
          {!note.blocks && (
            <Pressable
              onPress={() => setPreview(v => !v)}
              hitSlop={12}
              style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[0.5], borderRadius: radius.sm, borderWidth: 1, borderColor: preview ? colors.accent : colors.bgBorder, backgroundColor: preview ? `${colors.accent}14` : "transparent" }}
            >
              <Text size="xs" weight={preview ? "semibold" : "regular"} style={{ color: preview ? colors.accent : colors.textTertiary }}>
                {preview ? "Edit" : "Preview"}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => { pinNote(note.id); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            hitSlop={12}
            style={{ padding: spacing[1] }}
          >
            <Ionicons
              name={note.pinned ? "pin" : "pin-outline"}
              size={16}
              color={note.pinned ? colors.accent : colors.textTertiary}
            />
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing[6], paddingTop: spacing[6], paddingBottom: spacing[16], gap: spacing[3] }} keyboardShouldPersistTaps="handled">
          <TextInput
            ref={titleRef}
            value={note.title}
            onChangeText={title => updateNote(note.id, { title })}
            placeholder="Untitled"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="next"
            onBlur={handleTitleCommit}
            onSubmitEditing={() => { handleTitleCommit(); setPreview(false); bodyRef.current?.focus(); }}
            style={[{ color: colors.textPrimary, fontSize: 26, fontFamily: fontFamily.bold, lineHeight: 34, marginBottom: spacing[3] }, { outlineStyle: "none" } as any]}
          />
          {/* Block-based editor (new notes) */}
          {note.blocks ? (
            <BlockEditor
              blocks={note.blocks}
              onChange={blocks => updateNote(note.id, { blocks })}
              onToggleCheck={blockId => toggleBlockCheck(note.id, blockId)}
              placeholder="Start writing…"
            />
          ) : preview ? (
            note.body.trim()
              ? <MarkdownView body={note.body} colors={colors} replCtx={replCtx} />
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
              style={[{ color: colors.textSecondary, fontSize: 15, lineHeight: 26, minHeight: 300 }, { outlineStyle: "none", minHeight: "60vh" } as any]}
            />
          )}
        </ScrollView>

        {/* Backlinks */}
        <BacklinksPanel note={note} allNotes={allNotes} onOpen={handleOpenNote} />

        {/* Footer */}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: spacing[6], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.bgBorder, backgroundColor: colors.bgSecondary }}>
          {note.blocks ? (
            <Text size="xs" tertiary>{note.blocks.length} block{note.blocks.length !== 1 ? "s" : ""}</Text>
          ) : (
            <Text size="xs" tertiary>{wordCount} word{wordCount !== 1 ? "s" : ""} · {note.body.length} chars</Text>
          )}
        </View>

        {/* Markdown-only features — hidden for block notes */}
        {!note.blocks && !preview && wikiQuery !== null && (
          <WikiLinkSuggestions
            query={wikiQuery}
            notes={allNotes.filter(n => n.id !== note.id)}
            onSelect={handleWikiSelect}
          />
        )}
        {!note.blocks && !preview && (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.bgBorder, backgroundColor: colors.bgSecondary }}>
            <MarkdownToolbar
              body={note.body}
              selRef={selRef}
              onApply={(text, cur) => { updateNote(note.id, { body: text }); setCursor(cur); setWikiQuery(null); }}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
