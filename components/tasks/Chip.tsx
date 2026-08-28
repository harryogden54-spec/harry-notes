import React from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing } from "@/lib/theme";

type Props = {
  label: string;
  color?: string;
  onRemove?: () => void;
  active?: boolean;
  onPress?: () => void;
};

export const Chip = React.memo(function Chip({ label, color, onRemove, active, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 4,
        backgroundColor: active ? colors.bgTertiary : "transparent",
        borderWidth: 1,
        borderColor: active
          ? (color ?? colors.accent)
          : (color ? `${color}40` : colors.bgBorder),
        borderRadius: 99,
        paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
      }}
    >
      <Text size="xs" style={{ color: active ? (color ?? colors.accent) : (color ?? colors.textSecondary) }}>
        {label}
      </Text>
      {onRemove && (
        <Pressable style={{ margin: -8, padding: 8 } as any} onPress={onRemove} hitSlop={6}>
          <Text size="xs" style={{ color: color ?? colors.textTertiary }}>×</Text>
        </Pressable>
      )}
    </Pressable>
  );
});
