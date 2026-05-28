import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { spacing } from "@/lib/theme";

type Props = { icon: React.ComponentProps<typeof Ionicons>["name"]; children: React.ReactNode };

export const MetaRow = React.memo(function MetaRow({ icon, children }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[2.5], minHeight: 22 }}>
      <Ionicons name={icon} size={14} color={colors.textTertiary} style={{ marginTop: 2, width: 14 }} />
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing[1] }}>
        {children}
      </View>
    </View>
  );
});
