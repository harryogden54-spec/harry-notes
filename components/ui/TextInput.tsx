import React from "react";
import { TextInput as RNTextInput, TextInputProps, View, StyleSheet } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing, typography } from "@/lib/theme";

interface InputProps extends TextInputProps {
  label?: string;
}

export function TextInput({ label, style, ...props }: InputProps) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing[1] }}>
      {label && <Text size="xs" weight="medium" secondary>{label}</Text>}
      <RNTextInput
        placeholderTextColor={colors.textTertiary}
        style={[
          {
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.bgBorder,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            color: colors.textPrimary,
            minHeight: 44,
            ...typography.base,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}
