import React from "react";
import { View } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing } from "@/lib/theme";

type Props = { icon: string; children: React.ReactNode };

export const MetaRow = React.memo(function MetaRow({ icon, children }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[2.5], minHeight: 22 }}>
      <Text size="xs" style={{ color: colors.textTertiary, width: 14, marginTop: 2 }}>{icon}</Text>
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing[1] }}>
        {children}
      </View>
    </View>
  );
});
