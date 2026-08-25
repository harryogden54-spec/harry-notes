import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { View, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius, fontFamily, getNotePastelIndex } from "@/lib/theme";
import { useNotesData, useNotesActions, type Note } from "@/lib/NotesContext";
import { useTasksData } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { getTodayStr } from "@/lib/utils";
import { blocksToMarkdown } from "@/components/notes/utils";
import { pickAndUploadNoteImage } from "@/lib/storageImages";
import { type Sel } from "./MarkdownToolbar";
import { WikiLinkSuggestions } from "./WikiLinkSuggestions";
import { NoteBodyEditor, type BodyEditorHandle } from "./editor/NoteBodyEditor";
import { timeAgo, extractTags, normalizeTag, addTagToBody, removeTagFromBody, sinkToggledCheckbox, splitTagLine } from "./utils";

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
  const { colors, notePastels } = useTheme();
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
      {tags.map(tag => {
        // Same colour rule as the note wall: the pastel keys on the tag itself,
        // so a chip here matches the dot on the card it came from.
        const idx = getNotePastelIndex(tag);
        return (
          <Pressable
            key={tag}
            onPress={() => onUpdateBody(removeTagFromBody(note.body, tag))}
            accessibilityLabel={`Remove tag ${tag}`}
            style={{
              flexDirection: "row", alignItems: "center", gap: 3,
              paddingHorizontal: spacing[2], paddingVertical: 2,
              borderRadius: 99, borderWidth: 1,
              borderColor: notePastels.border[idx],
              backgroundColor: notePastels.bg[idx],
            }}
          >
            <Text size="xs" style={{ color: colors.textSecondary }}>{tag}</Text>
            <Ionicons name="close-outline" size={12} color={colors.textTertiary} />
          </Pressable>
        );
      })}
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

/** Page tabs — each page is a child note (own sync row); the first tab is the
 *  parent note itself, so single-page notes are untouched by this feature. */
function PageTabs({ pages, activeId, onSelect, onAdd, onDeletePage, onMovePage }: {
  pages: Note[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDeletePage: (id: string) => void;
  onMovePage: (id: string, dir: -1 | 1) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.bgBorder }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], paddingHorizontal: spacing[3], paddingVertical: spacing[1.5] }}
      >
        {pages.map((p, i) => {
          const active = p.id === activeId;
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelect(p.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
                borderRadius: radius.md, borderWidth: 1, maxWidth: 170,
                borderColor: active ? colors.accent : colors.bgBorder,
                backgroundColor: active ? `${colors.accent}14` : "transparent",
              }}
            >
              <Text size="xs" weight={active ? "semibold" : "regular"} numberOfLines={1} style={{ color: active ? colors.accent : colors.textSecondary, flexShrink: 1 }}>
                {p.title || (i === 0 ? "Untitled" : `Page ${i + 1}`)}
              </Text>
              {/* Reorder/delete only on the active child tab — the first tab is the note itself */}
              {active && i > 0 && (
                <>
                  {i > 1 && (
                    <Pressable onPress={() => onMovePage(p.id, -1)} hitSlop={6} accessibilityLabel="Move page left">
                      <Ionicons name="chevron-back" size={12} color={colors.textTertiary} />
                    </Pressable>
                  )}
                  {i < pages.length - 1 && (
                    <Pressable onPress={() => onMovePage(p.id, 1)} hitSlop={6} accessibilityLabel="Move page right">
                      <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
                    </Pressable>
                  )}
                  <Pressable onPress={() => onDeletePage(p.id)} hitSlop={8} accessibilityLabel="Delete page">
                    <Ionicons name="close-outline" size={12} color={colors.textTertiary} />
                  </Pressable>
                </>
              )}
            </Pressable>
          );
        })}
        <Pressable onPress={onAdd} hitSlop={8} accessibilityLabel="Add page" style={{ padding: spacing[1] }}>
          <Ionicons name="add" size={14} color={colors.textTertiary} />
        </Pressable>
      </ScrollView>
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
  const { colors, notePastels } = useTheme();
  const { notes } = useNotesData();
  const { addNote, updateNote, deleteNote, pinNote, archiveNote, unarchiveNote } = useNotesActions();
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

  // Pages: the note itself is tab 1; children (parent_id === note.id) are the
  // rest. Every edit below targets `page` — the active tab's note row.
  const pages = useMemo(() => {
    const children = notes
      .filter(n => n.parent_id === note.id)
      .sort((a, b) => (a.page_order ?? 0) - (b.page_order ?? 0) || a.created_at.localeCompare(b.created_at));
    return [note, ...children];
  }, [notes, note]);
  const [activePageId, setActivePageId] = useState(note.id);
  useEffect(() => { setActivePageId(note.id); }, [note.id]);
  const page = pages.find(p => p.id === activePageId) ?? note;

  // The managed //tag line (kept at the top of the body by TagRow) is hidden
  // from the editor: strip it before display, re-join it on save. Only the
  // exact line captured when the page opened (or after a TagRow action) is
  // hidden — a tag line typed manually mid-session stays visible, so the DOM
  // is never rebuilt out from under the caret. Reset during render on page
  // switch to avoid a one-frame unstripped flash.
  const [tagState, setTagState] = useState(() => ({ pageId: page.id, line: splitTagLine(page.body)[0] }));
  if (tagState.pageId !== page.id) {
    setTagState({ pageId: page.id, line: splitTagLine(page.body)[0] });
  }
  const [hiddenTagLine, visibleBody] = useMemo((): [string | null, string] => {
    if (tagState.line === null) return [null, page.body];
    const [line, rest] = splitTagLine(page.body);
    return line === tagState.line ? [line, rest] : [null, page.body];
  }, [page.body, tagState.line]);

  const commitBody = useCallback((visible: string) => {
    const body = hiddenTagLine === null
      ? visible
      : visible === "" ? hiddenTagLine : `${hiddenTagLine}\n${visible}`;
    updateNote(page.id, { body });
  }, [hiddenTagLine, updateNote, page.id]);

  // TagRow edits the stored (tab-1) body directly; re-capture the managed
  // line so the new tag set stays hidden without a body-editor rebuild.
  // (Skipped when a child page is active — tagState belongs to that page.)
  const handleTagsChanged = useCallback((body: string) => {
    if (tagState.pageId === note.id) {
      setTagState({ pageId: note.id, line: splitTagLine(body)[0] });
    }
    updateNote(note.id, { body });
  }, [note.id, tagState.pageId, updateNote]);

  const handleAddPage = useCallback(() => {
    const id = addNote({ parent_id: note.id, page_order: pages.length, title: `Page ${pages.length + 1}` });
    setActivePageId(id);
  }, [addNote, note.id, pages.length]);

  const handleDeletePage = useCallback((id: string) => {
    const idx = pages.findIndex(p => p.id === id);
    const undo = deleteNote(id);
    setActivePageId(pages[Math.max(0, idx - 1)]?.id ?? note.id);
    showToast("Page deleted", { label: "Undo", onPress: undo });
  }, [pages, deleteNote, note.id, showToast]);

  // Swap a child page with its neighbour. Writing index positions as
  // page_order also normalises any stale values from concurrent edits.
  const handleMovePage = useCallback((id: string, dir: -1 | 1) => {
    const children = pages.slice(1);
    const idx = children.findIndex(p => p.id === id);
    const j = idx + dir;
    if (idx === -1 || j < 0 || j >= children.length) return;
    updateNote(id, { page_order: j });
    updateNote(children[j].id, { page_order: idx });
  }, [pages, updateNote]);

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
    await Clipboard.setStringAsync(visibleBody ?? "");
    showToast("Note copied");
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handlePickImage() {
    if (uploading) return;
    setUploading(true);
    showToast("Uploading photo…");
    const result = await pickAndUploadNoteImage(page.id);
    setUploading(false);
    if (!result.ok) {
      if (result.reason === "cancelled") return;
      showToast(result.message ?? "Couldn't add photo");
      return;
    }
    bodyRef.current?.insertImage(result.url);
  }

  // Toggle a `- [ ]` / `- [x]` line from the rendered preview.
  // Line indices are in visible-body space (the hidden tag line is stripped
  // before the preview renders), so operate on visibleBody and re-join.
  function toggleCheckboxLine(lineIndex: number) {
    const lines = visibleBody.split("\n");
    const line = lines[lineIndex];
    if (line === undefined) return;
    lines[lineIndex] = line.replace(/^([-*] \[)([ xX])(\])/, (_m, p1, state, p3) =>
      `${p1}${state.toLowerCase() === "x" ? " " : "x"}${p3}`);
    commitBody(sinkToggledCheckbox(lines, lineIndex).join("\n"));
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  // Track the title as it was when editing began so we can propagate renames.
  const committedTitleRef = useRef(page.title);
  useEffect(() => { committedTitleRef.current = page.title; }, [activePageId]);

  useEffect(() => { if (!note.title) setTimeout(() => titleRef.current?.focus(), 50); }, [note.id]);
  useEffect(() => { setPreview(false); }, [note.id, activePageId]);

  // Propagate title renames to all notes that contain [[oldTitle]].
  // Runs on blur/submit so we don't rewrite on every keystroke. Only the
  // document title (tab 1) participates in wiki links — page renames don't.
  function handleTitleCommit() {
    const oldTitle = committedTitleRef.current;
    const newTitle = page.title;
    committedTitleRef.current = newTitle;
    if (page.id !== note.id) return;
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

  const wordCount = visibleBody.trim() ? visibleBody.trim().split(/\s+/).length : 0;
  // Colour identity of the whole document, keyed on its first tag — read from
  // the note's own body rather than the active page's, so every page of a note
  // shares the note's colour.
  const firstTag = extractTags(note.body ?? "")[0];
  const firstTagIndex = firstTag ? getNotePastelIndex(firstTag) : -1;

  // Documents only — pages don't participate in wiki links / backlinks.
  const allNotes = notes.filter(n => !n.archived && !n.parent_id);

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
        {/* The open note carries its first tag's pastel as a top edge, so it
            reads as the same object as the card that was tapped to reach it.
            An untagged note gets no edge — which is what makes a tagged one
            recognisable. Hidden in focus mode with the rest of the chrome. */}
        {!focusMode && firstTagIndex >= 0 && (
          <View style={{ height: 3, backgroundColor: notePastels.border[firstTagIndex] }} />
        )}
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
            onPress={handleAddPage}
            hitSlop={12}
            accessibilityLabel="Add page"
            // @ts-ignore web-only tooltip
            title={Platform.OS === "web" ? "Add page" : undefined}
            style={{ padding: spacing[1] }}
          >
            <Ionicons name="duplicate-outline" size={14} color={colors.textTertiary} />
          </Pressable>
          <Pressable
            onPress={() => setFocusMode(true)}
            hitSlop={12}
            accessibilityLabel="Focus mode"
            style={{ padding: spacing[1] }}
          >
            <Ionicons name="expand-outline" size={14} color={colors.textTertiary} />
          </Pressable>
          <Pressable onPress={handleCopy} hitSlop={12} style={{ padding: spacing[1] }}>
            <Ionicons name="copy-outline" size={14} color={colors.textTertiary} />
          </Pressable>
          <Pressable
            onPress={() => { pinNote(note.id); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            hitSlop={12}
            style={{ padding: spacing[1] }}
          >
            <Ionicons
              name={note.pinned ? "star" : "star-outline"}
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
            <Ionicons name="archive-outline" size={14} color={colors.textTertiary} />
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
        {!focusMode && <TagRow note={note} onUpdateBody={handleTagsChanged} />}

        {/* Page tabs — appear once the note has more than one page */}
        {!focusMode && pages.length > 1 && (
          <PageTabs pages={pages} activeId={page.id} onSelect={setActivePageId} onAdd={handleAddPage} onDeletePage={handleDeletePage} onMovePage={handleMovePage} />
        )}

        {/* Body */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing[6], paddingTop: spacing[6], paddingBottom: spacing[16], gap: spacing[3] }} keyboardShouldPersistTaps="handled">
          <TextInput
            ref={titleRef}
            value={page.title}
            onChangeText={title => updateNote(page.id, { title })}
            placeholder={page.id === note.id ? "Untitled" : "Page title"}
            placeholderTextColor={colors.textTertiary}
            returnKeyType="next"
            onBlur={handleTitleCommit}
            onSubmitEditing={() => { handleTitleCommit(); setPreview(false); bodyRef.current?.focus(); }}
            style={[{ color: colors.textPrimary, fontSize: 26, fontFamily: fontFamily.bold, lineHeight: 34, marginBottom: spacing[3] }, { outlineStyle: "none" } as any]}
          />
          <NoteBodyEditor
            key={page.id}
            body={visibleBody}
            onChangeBody={commitBody}
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
          <Text size="xs" tertiary>{wordCount} word{wordCount !== 1 ? "s" : ""} · {visibleBody.length} chars</Text>
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
