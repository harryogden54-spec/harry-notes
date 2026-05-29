import React, { useRef } from "react";
import { View, TextInput, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, fontFamily } from "@/lib/theme";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<TextInput | null>;
  shortcutKey?: string;
  onSubmitEditing?: () => void;
}

export function SearchBar({ value, onChange, placeholder = "Search…", inputRef, shortcutKey, onSubmitEditing }: SearchBarProps) {
  const { colors } = useTheme();
  const localRef = useRef<TextInput>(null);
  const ref = inputRef ?? localRef;

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[2],
      backgroundColor: colors.bgSecondary,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.bgBorder,
      paddingHorizontal: spacing[3],
      height: 40,
      marginBottom: spacing[3],
    }}>
      <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[
          { flex: 1, color: colors.textPrimary, fontSize: 14 },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChange("")} hitSlop={8}>
          <Ionicons name="close-outline" size={16} color={colors.textTertiary} />
        </Pressable>
      ) : shortcutKey && Platform.OS === "web" ? (
        <View style={{
          backgroundColor: colors.bgTertiary,
          borderRadius: radius.sm,
          paddingHorizontal: spacing[1.5],
          paddingVertical: 2,
          borderWidth: 1,
          borderColor: colors.bgBorder,
        }}>
          <Text style={{ fontSize: 11, fontFamily: "monospace" as any, color: colors.textTertiary }}>
            {shortcutKey}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
