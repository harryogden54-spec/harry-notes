import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/Text";
import { GlassCard } from "@/components/ui/GlassCard";
import { useTheme } from "@/lib/useTheme";
import { spacing } from "@/lib/theme";
import type { NoteList } from "@/lib/ListsContext";

interface Props {
  list: NoteList;
  onPress: () => void;
}

export function ListShelfCard({ list, onPress }: Props) {
  const { colors } = useTheme();
  const color    = list.color ?? colors.accent;
  const items    = list.items ?? [];
  const total    = items.filter(i => i.type === "checkbox").length;
  const done     = items.filter(i => i.type === "checkbox" && i.done).length;
  const progress = total > 0 ? done / total : null;

  return (
    <Pressable onPress={onPress} style={{ marginRight: spacing[3] }}>
      <GlassCard style={{
        width: 130,
        borderTopWidth: 3,
        borderTopColor: color,
        padding: spacing[3],
        gap: spacing[2],
      }}>
        <View style={{ height: 5, width: 40, borderRadius: 99, backgroundColor: color }} />
        <Text size="sm" weight="semibold" numberOfLines={1}>{list.name}</Text>
        <Text size="xs" secondary>
          {items.length === 0 ? "Empty" : `${items.length} item${items.length !== 1 ? "s" : ""}`}
        </Text>
        {progress !== null && (
          <View style={{ height: 3, backgroundColor: colors.bgTertiary, borderRadius: 99 }}>
            <View style={{ height: 3, width: `${Math.round(progress * 100)}%` as any, backgroundColor: color, borderRadius: 99 }} />
          </View>
        )}
      </GlassCard>
    </Pressable>
  );
}
