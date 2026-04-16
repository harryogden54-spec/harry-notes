import React from "react";
import { Pressable } from "react-native";
import { Text } from "@/components/ui/Text";
import { GlassCard } from "@/components/ui/GlassCard";
import { useTheme } from "@/lib/useTheme";
import { spacing } from "@/lib/theme";
import type { StickyNote } from "@/lib/StickyNotesContext";

interface Props {
  note: StickyNote;
  onPress: () => void;
}

export function StickyCard({ note, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ marginRight: spacing[3] }}>
      <GlassCard style={{
        width: 150,
        borderLeftWidth: 3,
        borderLeftColor: note.colour,
        padding: spacing[3],
        minHeight: 80,
      }}>
        <Text
          size="xs"
          numberOfLines={4}
          style={{ color: note.content ? colors.textPrimary : colors.textTertiary, lineHeight: 18 }}
        >
          {note.content || "Empty note"}
        </Text>
      </GlassCard>
    </Pressable>
  );
}
