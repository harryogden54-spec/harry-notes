import React, { useRef } from "react";
import { View, TextInput, Pressable } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<TextInput>;
}

export function SearchBar({ value, onChange, placeholder = "Search…", inputRef }: SearchBarProps) {
  const { colors } = useTheme();
  const localRef = useRef<TextInput>(null);
  const ref = inputRef ?? localRef;

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[2],
      backgroundColor: colors.bgSecondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.bgBorder,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      marginBottom: spacing[3],
    }}>
      <Text style={{ color: colors.textTertiary, fontSize: 14 }}>⌕</Text>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[
          { flex: 1, color: colors.textPrimary, fontSize: 14 },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange("")} hitSlop={8}>
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}
