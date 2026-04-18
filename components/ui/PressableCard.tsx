import React from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

interface Props extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Pressable that scales down to 0.97 on press.
 * Use as a wrapper around GlassCard or Surface for interactive cards.
 */
export function PressableCard({ onPress, style, children, ...props }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 20, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1.0, { damping: 20, stiffness: 300 }); }}
      {...props}
    >
      <Animated.View style={[animatedStyle, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
