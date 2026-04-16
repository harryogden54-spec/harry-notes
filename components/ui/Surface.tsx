import React from "react";
import { View, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { radius } from "@/lib/theme";

type Variant = "default" | "elevated" | "inset";

interface Props extends ViewProps {
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Solid background card for standard containers (no blur).
 * Reserve GlassCard (with blur) for dashboard calendar, pinned list,
 * and featured/promoted content. Use Surface for everything else.
 */
export function Surface({ variant = "default", style, children, ...props }: Props) {
  const { colors } = useTheme();

  const variantStyle: ViewStyle = variant === "elevated"
    ? {
        backgroundColor: colors.bgSecondary,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      }
    : variant === "inset"
    ? {
        backgroundColor: colors.bgTertiary,
        shadowColor: "transparent",
      }
    : {
        backgroundColor: colors.bgSecondary,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      };

  return (
    <View
      style={[
        {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.bgBorder,
          ...variantStyle,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
