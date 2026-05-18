import React from "react";
import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, fontFamily } from "@/lib/theme";

const SHORTCUTS: [string, string][] = [
  ["Cmd+K", "Quick-add task"],
  ["/",     "Global search"],
  ["N",     "New task (Tasks screen)"],
  ["F",     "Toggle Focus mode"],
  ["G then H", "Go to Home"],
  ["G then T", "Go to Tasks"],
  ["G then N", "Go to Notes"],
  ["G then P", "Go to Post Its"],
  ["?",     "Show this panel"],
  ["Esc",   "Close / cancel"],
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onClose}
      style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 200, alignItems: "center", justifyContent: "center" } as any}
    >
      <Pressable onPress={e => e.stopPropagation()} style={{
        backgroundColor: colors.bgSecondary,
        borderWidth: 1, borderColor: colors.bgBorder,
        borderRadius: radius.xl,
        padding: spacing[6],
        width: 400, maxWidth: "90%" as any,
        gap: spacing[4],
      }}>
        <Text style={{ fontSize: 16, fontFamily: fontFamily.semibold, color: colors.textPrimary }}>
          Keyboard shortcuts
        </Text>
        <View style={{ gap: spacing[2] }}>
          {SHORTCUTS.map(([key, desc]) => (
            <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, fontFamily: fontFamily.regular, color: colors.textSecondary, flex: 1 }}>{desc}</Text>
              <View style={{ backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontFamily: "monospace" as any, color: colors.textPrimary }}>{key}</Text>
              </View>
            </View>
          ))}
        </View>
        <Pressable onPress={onClose} style={{ alignSelf: "flex-end", paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.md, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder }}>
          <Text style={{ fontSize: 13, fontFamily: fontFamily.medium, color: colors.textSecondary }}>Close</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}
