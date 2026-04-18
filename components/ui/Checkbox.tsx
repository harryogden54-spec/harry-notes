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
}

export function Checkbox({ checked, onToggle, size = 18, ...props }: CheckboxProps) {
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
    <Pressable onPress={handleToggle} hitSlop={8} {...props}>
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 4,
            borderWidth: 1.5,
            borderColor: checked ? colors.accent : colors.bgBorder,
            backgroundColor: checked ? colors.accent : "transparent",
            alignItems: "center",
            justifyContent: "center",
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
              borderColor: "#FFFFFF",
              transform: [{ rotate: "-45deg" }, { translateY: -size * 0.04 }],
            }}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}
