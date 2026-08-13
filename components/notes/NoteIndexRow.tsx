import React, { useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, getNotePastelIndex, getShadow, transition } from "@/lib/theme";
import type { Note } from "@/lib/NotesContext";
import { timeAgo, notePreview, noteDisplayTitle, extractTags } from "./utils";

type Props = { note: Note; isSelected: boolean; onSelect: () => void; pageCount?: number };

/**
 * Floating bubble card for the desktop notes index — same card language as
 * TaskCard/NoteCard (18px radius, frosted surface, soft shadow, pastel
 * identity dot), selection shown with an accent border.
 */
export const NoteIndexRow = React.memo(function NoteIndexRow({ note, isSelected, onSelect, pageCount }: Props) {
  const { colors, notePastels, scheme, shadow } = useTheme();
  const [hovered, setHovered] = useState(false);
  // Same rule as NoteCard: the pastel keys on the first tag, so it means
  // something. See the comment there.
  const tag = extractTags(note.body ?? "")[0];
  const idx = tag ? getNotePastelIndex(tag) : -1;
  const preview = notePreview(note);
  return (
    <Pressable
      onPress={onSelect}
      // @ts-ignore web hover events
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => ({
        paddingVertical: spacing[3], paddingHorizontal: spacing[4],
        borderRadius: 18,
        borderWidth: 1,
        // Selection outranks pinned; both outrank a plain row. See NoteCard.
        borderColor: isSelected ? colors.accent
          : note.pinned ? `${colors.accent}55`
          : `${colors.bgBorder}88`,
        backgroundColor: isSelected
          ? `${colors.accent}0C`
          : `${colors.bgSecondary}${hovered ? "F0" : "D0"}`,
        gap: spacing[1],
        ...(hovered && !pressed ? shadow("md") : shadow("sm")),
        ...(Platform.OS === "web" ? {
          // @ts-ignore web-only CSS — smooth hover lift
          ...transition("transform, box-shadow, background-color, border-color"),
          transform: [{ translateY: hovered && !pressed ? -1 : 0 }, { scale: pressed ? 0.99 : 1 }],
          cursor: "pointer",
        } : {}),
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
        {note.pinned && <Ionicons name="star" size={12} color={colors.accent} />}
        <Text size="cardTitle" weight={isSelected ? "semibold" : "medium"} numberOfLines={1} style={{ flex: 1 }}>
          {noteDisplayTitle(note)}
        </Text>
      </View>
      {preview
        ? <Text size="xs" secondary numberOfLines={1}>{preview}</Text>
        : <Text size="xs" tertiary numberOfLines={1}>No content</Text>
      }
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], paddingTop: 1 }}>
        {tag && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: notePastels.bg[idx], borderWidth: 1, borderColor: notePastels.border[idx] }} />
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
