import React, { useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, getNotePastelIndex, getShadow } from "@/lib/theme";
import type { Note } from "@/lib/NotesContext";
import { timeAgo, notePreview } from "./utils";

type Props = { note: Note; isSelected: boolean; onSelect: () => void };

/**
 * Floating bubble card for the desktop notes index — same card language as
 * TaskCard/NoteCard (18px radius, frosted surface, soft shadow, pastel
 * identity dot), selection shown with an accent border.
 */
export const NoteIndexRow = React.memo(function NoteIndexRow({ note, isSelected, onSelect }: Props) {
  const { colors, notePastels, scheme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const idx = getNotePastelIndex(note.id);
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
        borderColor: isSelected ? colors.accent : `${colors.bgBorder}88`,
        backgroundColor: isSelected
          ? `${colors.accent}0C`
          : `${colors.bgSecondary}${hovered ? "F0" : "D0"}`,
        gap: spacing[1],
        ...(hovered && !pressed ? getShadow("md", scheme) : getShadow("sm", scheme)),
        ...(Platform.OS === "web" ? {
          // @ts-ignore web-only CSS — smooth hover lift
          transitionProperty: "transform, box-shadow, background-color, border-color",
          transitionDuration: "150ms",
          transitionTimingFunction: "ease-out",
          transform: [{ translateY: hovered && !pressed ? -1 : 0 }, { scale: pressed ? 0.99 : 1 }],
          cursor: "pointer",
        } : {}),
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
        {note.pinned && <Ionicons name="pin" size={10} color={colors.accent} />}
        <Text size="sm" weight={isSelected ? "semibold" : "medium"} numberOfLines={1} style={{ flex: 1, color: note.title ? colors.textPrimary : colors.textTertiary }}>
          {note.title || "Untitled"}
        </Text>
      </View>
      {preview
        ? <Text size="xs" secondary numberOfLines={1}>{preview}</Text>
        : <Text size="xs" tertiary numberOfLines={1}>No content</Text>
      }
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 1 }}>
        <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: notePastels.bg[idx], borderWidth: 1, borderColor: notePastels.border[idx] }} />
        <Text size="xs" style={{ color: colors.textTertiary, fontSize: 11 }}>{timeAgo(note.updated_at ?? note.created_at)}</Text>
      </View>
    </Pressable>
  );
});
