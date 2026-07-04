import React, { useState } from "react";
import { View, Pressable, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { spacing, fontFamily, getNotePastelIndex, getShadow } from "@/lib/theme";
import { useTheme } from "@/lib/useTheme";
import { useNotesActions } from "@/lib/NotesContext";
import type { Note } from "@/lib/NotesContext";
import { timeAgo, notePreview } from "./utils";

type Props = { note: Note; onOpen: () => void };

/**
 * Note card per the redesign (artboard 1d): a neutral floating surface with
 * the note's pastel as a small identity dot in the meta row — not a
 * full-pastel background.
 */
export const NoteCard = React.memo(function NoteCard({ note, onOpen }: Props) {
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
        paddingVertical: spacing[4],
        paddingHorizontal: spacing[4] + 2,
        gap: 7,
        minHeight: 100,
        ...(hovered && !pressed ? getShadow("md", scheme) : getShadow("sm", scheme)),
        ...(Platform.OS === "web" ? {
          // @ts-ignore web-only CSS — smooth hover lift
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          transitionProperty: "transform, box-shadow, background-color",
          transitionDuration: "150ms",
          transitionTimingFunction: "ease-out",
          transform: [{ translateY: hovered && !pressed ? -1 : 0 }, { scale: pressed ? 0.99 : 1 }],
          cursor: "pointer",
        } : {}),
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
        {note.pinned && <Ionicons name="pin" size={11} color={colors.accent} />}
        <Text size="sm" numberOfLines={1} style={{ flex: 1, fontFamily: fontFamily.semibold, color: note.title ? colors.textPrimary : colors.textTertiary }}>
          {note.title || "Untitled"}
        </Text>
      </View>
      {preview ? (
        <Text size="xs" numberOfLines={3} style={{ color: colors.textSecondary, lineHeight: 19, fontSize: 12.5 }}>
          {preview}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: "auto" as any, paddingTop: 2 }}>
        <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: notePastels.bg[idx], borderWidth: 1, borderColor: notePastels.border[idx] }} />
        <Text size="xs" style={{ color: colors.textTertiary, fontSize: 11.5 }}>{timeAgo(note.updated_at ?? note.created_at)}</Text>
      </View>
    </Pressable>
  );
});
