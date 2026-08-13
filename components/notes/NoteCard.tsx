import React, { useState } from "react";
import { View, Pressable, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { spacing, shape, getNotePastelIndex, getShadow, transition } from "@/lib/theme";
import { useTheme } from "@/lib/useTheme";
import { useNotesActions } from "@/lib/NotesContext";
import type { Note } from "@/lib/NotesContext";
import { timeAgo, notePreview, noteDisplayTitle, extractTags } from "./utils";

type Props = {
  note: Note;
  onOpen: () => void;
  pageCount?: number;
};

/**
 * Note card per the redesign (artboard 1d): a neutral floating surface, with
 * the pastel carrying the note's first tag in the meta row rather than acting
 * as a full-pastel background.
 */
export const NoteCard = React.memo(function NoteCard({ note, onOpen, pageCount }: Props) {
  const { pinNote } = useNotesActions();
  const { colors, notePastels, scheme, shadow } = useTheme();
  const [hovered, setHovered] = useState(false);
  // Colour keyed on the first TAG, not the note id: same tag always draws the
  // same pastel, so a grid visibly groups itself. Keyed on the id it was pure
  // decoration — six colours assigned at random, telling you nothing.
  const tag = extractTags(note.body ?? "")[0];
  const idx = tag ? getNotePastelIndex(tag) : -1;
  const preview = notePreview(note, 240);
  return (
    <Pressable
      onPress={onOpen}
      onLongPress={() => { pinNote(note.id); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
      // @ts-ignore web hover events
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: `${colors.bgSecondary}${hovered ? "F0" : "D0"}`,
        borderRadius: 18,
        borderWidth: 1,
        // Pinned cards carry an accent edge, so the section reads as pinned even
        // scrolled past its heading — the star alone was a 12px difference.
        borderColor: note.pinned ? `${colors.accent}55` : `${colors.bgBorder}88`,
        ...shape.card,
        gap: spacing[2],
        minHeight: 100,
        ...(hovered && !pressed ? shadow("md") : shadow("sm")),
        ...(Platform.OS === "web" ? {
          // @ts-ignore web-only CSS — smooth hover lift (no backdrop blur; see TaskCard)
          ...transition("transform, box-shadow, background-color"),
          transform: [{ translateY: hovered && !pressed ? -1 : 0 }, { scale: pressed ? 0.99 : 1 }],
          cursor: "pointer",
        } : {}),
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
        {/* Star, not a pin — the app's icon is a star, so it doubles as the
            signature mark. See lib/theme.ts elevation notes. */}
        {note.pinned && <Ionicons name="star" size={12} color={colors.accent} />}
        {/* Full-strength even when derived from the first line — that is real
            content now, not the placeholder word this used to grey out. */}
        <Text size="cardTitle" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
          {noteDisplayTitle(note)}
        </Text>
      </View>
      {preview ? (
        <Text size="xs" numberOfLines={3} secondary style={{ lineHeight: 19 }}>
          {preview}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: "auto" as any, paddingTop: 2 }}>
        {/* The tag itself, named — an untagged note simply has no mark, which is
            what makes a tagged one stand out. */}
        {tag && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: notePastels.bg[idx], borderWidth: 1, borderColor: notePastels.border[idx] }} />
            <Text size="meta" tertiary numberOfLines={1}>{tag}</Text>
          </View>
        )}
        <Text size="meta" tertiary>{timeAgo(note.updated_at ?? note.created_at)}</Text>
        {!!pageCount && pageCount > 1 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons name="documents-outline" size={12} color={colors.textTertiary} />
            <Text size="meta" tertiary>{pageCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});
