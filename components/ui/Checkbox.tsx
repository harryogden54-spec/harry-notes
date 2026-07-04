import React from "react";
import { Pressable, PressableProps, View, Platform } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSequence, withTiming, withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";

interface CheckboxProps extends Omit<PressableProps, "onPress"> {
  checked: boolean;
  onToggle: () => void;
  size?: number;
  /** "circle" matches the task-card design language; "square" is the default elsewhere. */
  shape?: "square" | "circle";
  accessibilityLabel?: string;
}

export function Checkbox({ checked, onToggle, size = 18, shape = "square", accessibilityLabel, ...props }: CheckboxProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handleToggle() {
    if (!checked) {
      scale.value = withSequence(
        withTiming(1.3, { duration: 100 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  }

  return (
    <Pressable
      onPress={handleToggle}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}
      {...props}
    >
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: shape === "circle" ? size / 2 : size / 4,
            borderWidth: 1.5,
            borderColor: checked ? colors.accent : colors.bgBorder,
            backgroundColor: checked ? colors.accent : "transparent",
            alignItems: "center",
            justifyContent: "center",
            ...(Platform.OS === "web" ? {
              // @ts-ignore web-only CSS transition
              transitionProperty: "background-color, border-color",
              transitionDuration: "150ms",
            } : {}),
          },
          animatedStyle,
        ]}
      >
        {checked && (
          <View
            style={{
              width: size * 0.55,
              height: size * 0.28,
              borderLeftWidth: 1.5,
              borderBottomWidth: 1.5,
              borderColor: colors.textInverse,
              transform: [{ rotate: "-45deg" }, { translateY: -size * 0.04 }],
            }}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}
