import React from "react";
import { ScrollView, Pressable } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import type { Note } from "@/lib/NotesContext";

export function getWikiQuery(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos);
  const match = before.match(/\[\[([^\][]*)$/);
  return match ? match[1] : null;
}

type Props = { query: string; notes: Note[]; onSelect: (title: string) => void };

export function WikiLinkSuggestions({ query, notes, onSelect }: Props) {
  const { colors } = useTheme();
  const lower = query.toLowerCase();
  const suggestions = notes.filter(n => (n.title || "Untitled").toLowerCase().includes(lower)).slice(0, 5);
  if (suggestions.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always"
      style={{ borderTopWidth: 1, borderTopColor: `${colors.accent}44`, backgroundColor: colors.bgTertiary }}
      contentContainerStyle={{ flexDirection: "row", gap: spacing[1], paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}
    >
      {suggestions.map(n => (
        <Pressable key={n.id} onPress={() => onSelect(n.title || "Untitled")}
          style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.xl, borderWidth: 1, borderColor: `${colors.accent}60`, backgroundColor: `${colors.accent}18` }}>
          <Text size="xs" style={{ color: colors.accent }}>{n.title || "Untitled"}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
