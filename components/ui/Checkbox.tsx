import React from "react";
import { Pressable, PressableProps, View, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { radius, spacing } from "@/lib/theme";

interface CheckboxProps extends Omit<PressableProps, "onPress"> {
  checked: boolean;
  onToggle: () => void;
  size?: number;
}

export function Checkbox({ checked, onToggle, size = 18, ...props }: CheckboxProps) {
  const { colors } = useTheme();

  function handleToggle() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  }

  return (
    <Pressable
      onPress={handleToggle}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        borderWidth: 1.5,
        borderColor: checked ? colors.accent : colors.bgBorder,
        backgroundColor: checked ? colors.accent : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
      {...props}
    >
      {checked && (
        <View
          style={{
            width: size * 0.55,
            height: size * 0.28,
            borderLeftWidth: 1.5,
            borderBottomWidth: 1.5,
            borderColor: "#FFFFFF",
            transform: [{ rotate: "-45deg" }, { translateY: -size * 0.04 }],
          }}
        />
      )}
    </Pressable>
  );
}
