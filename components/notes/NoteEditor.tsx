import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { View, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useNotesData, useNotesActions, type Note } from "@/lib/NotesContext";
import { useTasksData } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { getTodayStr } from "@/lib/utils";
import { blocksToMarkdown } from "@/lib/migrateBlocksToBody";
import { pickAndUploadNoteImage } from "@/lib/storageImages";
import { type Sel } from "./MarkdownToolbar";
import { WikiLinkSuggestions } from "./WikiLinkSuggestions";
import { NoteBodyEditor, type BodyEditorHandle } from "./editor/NoteBodyEditor";
import { timeAgo, extractTags, normalizeTag, addTagToBody, removeTagFromBody, sinkToggledCheckbox } from "./utils";

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

/** Tag chips + add-field for the editor top bar. Tags live as a //tag line
 *  at the top of the body, so list filtering and sync are unchanged. */
function TagRow({ note, onUpdateBody }: { note: Note; onUpdateBody: (body: string) => void }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState("");
  const tags = extractTags(note.body);

  function commit() {
    const tag = normalizeTag(draft);
    setDraft("");
    if (!tag) return;
    onUpdateBody(addTagToBody(note.body, tag));
  }

  return (
    <View style={{
      flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing[1.5],
      paddingHorizontal: spacing[4], paddingVertical: spacing[1.5],
      borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
    }}>
      <Ionicons name="pricetag-outline" size={12} color={colors.textTertiary} />
      {tags.map(tag => (
        <Pressable
          key={tag}
          onPress={() => onUpdateBody(removeTagFromBody(note.body, tag))}
          accessibilityLabel={`Remove tag ${tag}`}
          style={{
            flexDirection: "row", alignItems: "center", gap: 3,
            paddingHorizontal: spacing[2], paddingVertical: 2,
            borderRadius: 99, borderWidth: 1, borderColor: colors.bgBorder, backgroundColor: colors.bgSecondary,
          }}
        >
          <Text size="xs" style={{ color: colors.textSecondary }}>//{tag}</Text>
          <Ionicons name="close" size={10} color={colors.textTertiary} />
        </Pressable>
      ))}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={commit}
        onBlur={() => { if (draft.trim()) commit(); }}
        blurOnSubmit={false}
        placeholder="Add tag…"
        placeholderTextColor={colors.textTertiary}
        style={[{ color: colors.textSecondary, fontSize: 12, fontFamily: fontFamily.regular, minWidth: 70, paddingVertical: 2 }, { outlineStyle: "none" } as any]}
      />
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
  const { notes } = useNotesData();
  const { updateNote, deleteNote, pinNote, archiveNote, unarchiveNote } = useNotesActions();
  const { tasks } = useTasksData();
  const { showToast } = useToast();
  const today = getTodayStr();
  const titleRef = useRef<TextInput | null>(null);
  const bodyRef  = useRef<BodyEditorHandle | null>(null);
  const selRef   = useRef<Sel>({ start: 0, end: 0 });
  const [cursor, setCursor]       = useState<Sel | undefined>(undefined);
  const [preview, setPreview]     = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [wikiQuery, setWikiQuery] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const insets = useSafeAreaInsets();

  // Defensive convert-on-open: a block note synced from a not-yet-migrated
  // device still needs to become a markdown body so the single-TextInput editor
  // can render it. The bulk migration (migrateBlocksToBody) handles existing ones.
  useEffect(() => {
    if (note.blocks && note.blocks.length > 0) {
      updateNote(note.id, { body: blocksToMarkdown(note.blocks), blocks: undefined });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  async function handleCopy() {
    await Clipboard.setStringAsync(note.body ?? "");
    showToast("Note copied");
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handlePickImage() {
    if (uploading) return;
    setUploading(true);
    showToast("Uploading photo…");
    const result = await pickAndUploadNoteImage(note.id);
    setUploading(false);
    if (!result.ok) {
      if (result.reason === "cancelled") return;
      showToast(result.message ?? "Couldn't add photo");
      return;
    }
    bodyRef.current?.insertImage(result.url);
  }

  // Toggle a `- [ ]` / `- [x]` line from the rendered preview.
  function toggleCheckboxLine(lineIndex: number) {
    const lines = note.body.split("\n");
    const line = lines[lineIndex];
    if (line === undefined) return;
    lines[lineIndex] = line.replace(/^([-*] \[)([ xX])(\])/, (_m, p1, state, p3) =>
      `${p1}${state.toLowerCase() === "x" ? " " : "x"}${p3}`);
    updateNote(note.id, { body: sinkToggledCheckbox(lines, lineIndex).join("\n") });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

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

  function handleWikiSelect(title: string) {
    bodyRef.current?.insertWikiLink(title);
  }

  const handleOpenNote = useCallback((id: string) => {
    onOpenNote?.(id);
  }, [onOpenNote]);

  const wordCount = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;
  const allNotes = notes.filter(n => !n.archived);

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

  const editor = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1 }}>
        {/* Focus mode: all chrome hidden, one floating exit control */}
        {focusMode && (
          <Pressable
            onPress={() => setFocusMode(false)}
            hitSlop={12}
            accessibilityLabel="Exit focus mode"
            style={{
              position: "absolute", top: spacing[3], right: spacing[4], zIndex: 20,
              padding: spacing[1.5], borderRadius: 99,
              backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.bgBorder,
            }}
          >
            <Ionicons name="contract-outline" size={16} color={colors.textTertiary} />
          </Pressable>
        )}

        {/* Header */}
        {!focusMode && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.bgBorder }}>
          {showBackButton && (
            <Pressable onPress={onClose} hitSlop={12} style={{ padding: spacing[1] }}>
              <Text size="sm" style={{ color: colors.accent }}>← Back</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Text size="xs" secondary>{timeAgo(note.updated_at ?? note.created_at)}</Text>
          {Platform.OS !== "web" && (
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
            onPress={() => setFocusMode(true)}
            hitSlop={12}
            accessibilityLabel="Focus mode"
            style={{ padding: spacing[1] }}
          >
            <Ionicons name="expand-outline" size={15} color={colors.textTertiary} />
          </Pressable>
          <Pressable onPress={handleCopy} hitSlop={12} style={{ padding: spacing[1] }}>
            <Ionicons name="copy-outline" size={15} color={colors.textTertiary} />
          </Pressable>
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
              archiveNote(note.id);
              onClose();
              showToast("Note archived", { label: "Undo", onPress: () => unarchiveNote(note.id) });
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={12}
            accessibilityLabel="Archive note"
            style={{ padding: spacing[1] }}
          >
            <Ionicons name="archive-outline" size={15} color={colors.textTertiary} />
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
        )}

        {/* Tags — managed from the top bar; stored as a //tag line in the body */}
        {!focusMode && <TagRow note={note} onUpdateBody={body => updateNote(note.id, { body })} />}

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
          <NoteBodyEditor
            body={note.body}
            onChangeBody={body => updateNote(note.id, { body })}
            bodyRef={bodyRef}
            selRef={selRef}
            cursor={cursor}
            setCursor={setCursor}
            preview={preview}
            colors={colors}
            replCtx={replCtx}
            onToggleCheckboxLine={toggleCheckboxLine}
            onWikiQueryChange={setWikiQuery}
            onPickImage={handlePickImage}
            uploading={uploading}
          />
        </ScrollView>

        {/* Backlinks */}
        {!focusMode && <BacklinksPanel note={note} allNotes={allNotes} onOpen={handleOpenNote} />}

        {/* Footer */}
        {!focusMode && (
        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: spacing[6], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.bgBorder, backgroundColor: colors.bgSecondary }}>
          <Text size="xs" tertiary>{wordCount} word{wordCount !== 1 ? "s" : ""} · {note.body.length} chars</Text>
        </View>
        )}

        {/* Wiki-link autocomplete (edit mode) */}
        {!preview && wikiQuery !== null && (
          <WikiLinkSuggestions
            query={wikiQuery}
            notes={allNotes.filter(n => n.id !== note.id)}
            onSelect={handleWikiSelect}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );

  // Focus mode = truly full screen: a Modal portals above the whole app shell
  // (desktop sidebar + notes list included), not just the editor panel. The
  // modal covers the status-bar / home-indicator areas, so pad them itself.
  if (focusMode) {
    return (
      <Modal visible animationType="fade" onRequestClose={() => setFocusMode(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bgPrimary, paddingTop: insets.top, paddingBottom: insets.bottom }}>{editor}</View>
      </Modal>
    );
  }
  return editor;
}
