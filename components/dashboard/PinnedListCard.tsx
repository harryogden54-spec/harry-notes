import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/Text";
import { GlassCard } from "@/components/ui/GlassCard";
import { Checkbox } from "@/components/ui/Checkbox";
import { useTheme } from "@/lib/useTheme";
import { spacing } from "@/lib/theme";
import { useLists, type NoteList } from "@/lib/ListsContext";

interface Props {
  list: NoteList;
  onPress: () => void;
}

export function PinnedListCard({ list, onPress }: Props) {
  const { colors } = useTheme();
  const { toggleItem } = useLists();
  const color = list.color ?? colors.accent;
  const items = list.items ?? [];
  const activeItems = items.filter(i => !i.done).slice(0, 5);
  const doneCount   = items.filter(i => i.done).length;

  return (
    <GlassCard style={{ marginBottom: spacing[5], borderTopWidth: 3, borderTopColor: color }}>
      <View style={{ padding: spacing[4], paddingBottom: activeItems.length > 0 ? spacing[2] : spacing[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: activeItems.length > 0 ? spacing[3] : 0 }}>
          <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: color }} />
          <Text size="sm" weight="semibold" style={{ flex: 1 }}>{list.name}</Text>
          <Pressable onPress={onPress} hitSlop={8}>
            <Text size="xs" style={{ color: colors.accent }}>See all</Text>
          </Pressable>
        </View>
        {activeItems.map(item => (
          <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[1.5] }}>
            {item.type === "checkbox" ? (
              <Checkbox checked={item.done} onToggle={() => toggleItem(list.id, item.id)} size={15} />
            ) : (
              <View style={{ width: 4, height: 4, borderRadius: 99, backgroundColor: colors.textTertiary, marginHorizontal: 4 }} />
            )}
            <Text size="sm" numberOfLines={1} style={{ flex: 1 }}>{item.content}</Text>
          </View>
        ))}
        {doneCount > 0 && (
          <Text size="xs" secondary style={{ marginTop: spacing[1] }}>{doneCount} completed</Text>
        )}
        {items.length === 0 && (
          <Text size="sm" secondary>Empty list</Text>
        )}
      </View>
    </GlassCard>
  );
}
