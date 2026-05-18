import React from "react";
import { View, Pressable, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui";
import { spacing, fontFamily, notePastels, getNotePastelIndex } from "@/lib/theme";
import { stripMarkdown } from "@/lib/utils";
import { useNotes } from "@/lib/NotesContext";
import type { Note } from "@/lib/NotesContext";
import { timeAgo } from "./utils";

type Props = { note: Note; onOpen: () => void };

export const NoteCard = React.memo(function NoteCard({ note, onOpen }: Props) {
  const { pinNote } = useNotes();
  const idx = getNotePastelIndex(note.id);
  const preview = stripMarkdown(note.body.trim());
  return (
    <Pressable
      onPress={onOpen}
      onLongPress={() => { pinNote(note.id); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
      style={{ flex: 1 }}
    >
      <View style={{ backgroundColor: notePastels.bg[idx], borderRadius: 12, borderWidth: 1, borderColor: notePastels.border[idx], padding: spacing[3], gap: spacing[1], minHeight: 90 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
          {note.pinned && <Text size="xs" style={{ color: notePastels.text }}>📌</Text>}
          <Text size="xs" numberOfLines={1} style={{ flex: 1, fontFamily: fontFamily.semibold, color: note.title ? notePastels.text : `${notePastels.text}80` }}>
            {note.title || "Untitled"}
          </Text>
        </View>
        {preview ? <Text size="xs" numberOfLines={3} style={{ color: `${notePastels.text}CC`, lineHeight: 17 }}>{preview}</Text> : null}
        <Text size="xs" style={{ color: `${notePastels.text}60`, marginTop: "auto" as any, fontSize: 10 }}>{timeAgo(note.updated_at ?? note.created_at)}</Text>
      </View>
    </Pressable>
  );
});
