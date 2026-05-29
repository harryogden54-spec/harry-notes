import React from "react";
import { View, Platform, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { radius } from "@/lib/theme";

type Variant = "default" | "elevated" | "inset";

interface Props extends ViewProps {
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Themed surface card. Always renders with a frosted-glass treatment:
 *   - Web:   semi-transparent background + backdrop-filter blur
 *   - Native: semi-transparent background (expo-blur via GlassCard if needed)
 *
 * Use variant="elevated" for floating panels, variant="inset" for inner wells.
 */
export function Surface({ variant = "default", style, children, ...props }: Props) {
  const { colors } = useTheme();

  const baseColor =
    variant === "inset"    ? colors.bgTertiary  :
    variant === "elevated" ? colors.bgSecondary :
                             colors.bgSecondary;

  // Frosted treatment: semi-transparent + blur on web
  const frostedStyle: ViewStyle = {
    backgroundColor: `${baseColor}D0`, // ~82% opacity
    ...(Platform.OS === "web" ? {
      // @ts-ignore web-only CSS properties
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
    } : {}),
  };

  const shadowStyle: ViewStyle = variant === "elevated"
    ? {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 4,
      }
    : variant === "default"
    ? {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.10,
        shadowRadius: 4,
        elevation: 2,
      }
    : {};

  return (
    <View
      style={[
        {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: `${colors.bgBorder}88`,
          ...frostedStyle,
          ...shadowStyle,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
