import React from "react";
import { View, Pressable } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";

type Props = { label: string; count: number; onAdd: () => void; addLabel: string };

export function NotesSectionHeader({ label, count, onAdd, addLabel }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1 }}>{label}</Text>
        {count > 0 && <Text size="xs" tertiary>({count})</Text>}
      </View>
      <Pressable onPress={onAdd} hitSlop={12} style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[0.5], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}>
        <Text size="xs" secondary>+ {addLabel}</Text>
      </Pressable>
    </View>
  );
}
