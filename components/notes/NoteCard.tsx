import React, { useState } from "react";
import { View, Pressable, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { spacing, shape, getNotePastelIndex, getShadow, transition, mountStagger } from "@/lib/theme";
import { useTheme } from "@/lib/useTheme";
import { useNotesActions } from "@/lib/NotesContext";
import type { Note } from "@/lib/NotesContext";
import { timeAgo, notePreview, noteDisplayTitle } from "./utils";

type Props = {
  note: Note;
  onOpen: () => void;
  pageCount?: number;
  /** Position in the grid, for the mount stagger. Not the pastel index — that
   *  is a hash of the id and would give a random delay rather than a sequence. */
  index?: number;
};

/**
 * Note card per the redesign (artboard 1d): a neutral floating surface with
 * the note's pastel as a small identity dot in the meta row — not a
 * full-pastel background.
 */
export const NoteCard = React.memo(function NoteCard({ note, onOpen, pageCount, index = 0 }: Props) {
  const { pinNote } = useNotesActions();
  const { colors, notePastels, scheme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const idx = getNotePastelIndex(note.id);
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
        borderColor: `${colors.bgBorder}88`,
        ...shape.card,
        gap: spacing[2],
        minHeight: 100,
        ...(hovered && !pressed ? getShadow("md", scheme) : getShadow("sm", scheme)),
        ...(Platform.OS === "web" ? {
          // @ts-ignore web-only CSS — smooth hover lift (no backdrop blur; see TaskCard)
          ...transition("transform, box-shadow, background-color"),
          ...mountStagger(index),
          transform: [{ translateY: hovered && !pressed ? -1 : 0 }, { scale: pressed ? 0.99 : 1 }],
          cursor: "pointer",
        } : {}),
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
        {/* Star, not a pin — the app's icon is a star, so it doubles as the
            signature mark. See lib/theme.ts elevation notes. */}
        {note.pinned && <Ionicons name="star" size={11} color={colors.accent} />}
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
        <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: notePastels.bg[idx], borderWidth: 1, borderColor: notePastels.border[idx] }} />
        <Text size="meta" tertiary>{timeAgo(note.updated_at ?? note.created_at)}</Text>
        {!!pageCount && pageCount > 1 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons name="documents-outline" size={11} color={colors.textTertiary} />
            <Text size="meta" tertiary>{pageCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});
