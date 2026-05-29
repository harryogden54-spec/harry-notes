import React from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, fontFamily, getNotePastelIndex } from "@/lib/theme";
import type { Note } from "@/lib/NotesContext";
import { timeAgo, notePreview } from "./utils";

type Props = { note: Note; isSelected: boolean; onSelect: () => void };

export const NoteIndexRow = React.memo(function NoteIndexRow({ note, isSelected, onSelect }: Props) {
  const { colors, notePastels } = useTheme();
  const accentColor = notePastels.bg[getNotePastelIndex(note.id)];
  const preview = notePreview(note);
  return (
    <Pressable onPress={onSelect} style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3], backgroundColor: isSelected ? colors.bgTertiary : "transparent", borderLeftWidth: 2, borderLeftColor: isSelected ? accentColor : "transparent", gap: spacing[0.5] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
        {note.pinned && <Ionicons name="pin" size={10} color={colors.accent} />}
        <Text size="sm" weight={isSelected ? "semibold" : "regular"} numberOfLines={1} style={{ flex: 1, color: note.title ? colors.textPrimary : colors.textTertiary }}>
          {note.title || "Untitled"}
        </Text>
        <Text size="xs" tertiary style={{ flexShrink: 0 }}>{timeAgo(note.updated_at ?? note.created_at)}</Text>
      </View>
      {preview
        ? <Text size="xs" secondary numberOfLines={1}>{preview}</Text>
        : <Text size="xs" tertiary numberOfLines={1}>No content</Text>
      }
    </Pressable>
  );
});
