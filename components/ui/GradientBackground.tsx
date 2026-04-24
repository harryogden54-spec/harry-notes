import React from "react";
import { View } from "react-native";
import { useTheme } from "@/lib/useTheme";

export function GradientBackground({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {children}
    </View>
  );
}
