import React from "react";
import { View, Platform, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";
import { radius } from "@/lib/theme";

type Variant = "default" | "elevated" | "inset";

interface Props extends ViewProps {
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Surface({ variant = "default", style, children, ...props }: Props) {
  const { colors } = useTheme();
  const { bgStyle } = useThemeContext();
  const isBlur = bgStyle === "blur";

  const baseColor =
    variant === "inset"   ? colors.bgTertiary  :
    variant === "elevated"? colors.bgSecondary  :
                            colors.bgSecondary;

  // Blur panels: semi-transparent bg + backdrop-filter on web
  const blurOverride: ViewStyle = isBlur ? {
    backgroundColor: `${baseColor}CC`,
    ...(Platform.OS === "web" ? {
      // @ts-ignore web-only
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    } : {}),
  } : {};

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
          ...blurOverride,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
