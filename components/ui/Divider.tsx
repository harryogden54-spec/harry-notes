import React from "react";
import { View, ViewProps } from "react-native";
import { useTheme } from "@/lib/useTheme";

export function Divider({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[{ height: 1, backgroundColor: colors.bgBorder }, style]}
      {...props}
    />
  );
}
