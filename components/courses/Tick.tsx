import React from "react";
import { View, Platform } from "react-native";
import { useTheme } from "@/lib/useTheme";

/**
 * The tracker's tick mark: a ring that fills with the course colour, check cut
 * out in the page background. Visual only — the caller owns the Pressable, so a
 * whole table cell (not just the 20px circle) is the tap target.
 */
export function Tick({ done, color, size = 20, idleColor }: {
  done: boolean;
  color: string;
  size?: number;
  /** Ring colour while unticked. Defaults to tertiary ink; future weeks pass the border colour. */
  idleColor?: string;
}) {
  const { colors } = useTheme();
  const stroke = Math.max(1.5, size / 11);
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: done ? 0 : 1.5,
        borderColor: idleColor ?? colors.textTertiary,
        backgroundColor: done ? color : "transparent",
        alignItems: "center", justifyContent: "center",
        ...(Platform.OS === "web" ? { transitionProperty: "background-color, border-color", transitionDuration: "150ms" } : {}),
      } as any}
    >
      {done && (
        <View
          style={{
            width: size * 0.5, height: size * 0.26,
            borderLeftWidth: stroke, borderBottomWidth: stroke,
            borderColor: colors.bgPrimary,
            transform: [{ rotate: "-45deg" }, { translateY: -size * 0.04 }],
          }}
        />
      )}
    </View>
  );
}
