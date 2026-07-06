import React from "react";
import { View, Text, Pressable, Platform, Image } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useThemeContext } from "@/lib/ThemeContext";
import { useSyncStatus } from "@/lib/useSyncStatus";
import { useMounted } from "@/lib/useMounted";

function syncChipLabel(status: string, lastSynced: string | null, mounted: boolean): string | null {
  if (!mounted) return null;
  if (status === "syncing") return "Syncing…";
  if (status === "error") return "Sync error";
  if (!lastSynced) return null;
  const diff = Math.floor((Date.now() - new Date(lastSynced).getTime()) / 1000);
  if (diff < 15) return "Just synced";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function PersistentHeader({ showTitle = true }: { showTitle?: boolean }) {
  const { colors, scheme } = useTheme();
  const { toggle } = useThemeContext();
  const { status, lastSynced } = useSyncStatus();
  const mounted = useMounted();

  function toggleScheme() {
    toggle();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const chipLabel = syncChipLabel(status, lastSynced, mounted);
  const chipColor = status === "error" ? colors.danger : status === "syncing" ? colors.accent : colors.textTertiary;

  return (
    <View style={{
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing[4], paddingVertical: spacing[2],
      borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
      backgroundColor: colors.bgSecondary,
      minHeight: 40,
    }}>
      {showTitle ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
          <Image source={require("@/assets/images/icon.png")} style={{ width: 16, height: 16, borderRadius: 4 }} />
          <Text style={{ fontFamily: fontFamily.bold, fontSize: 15, color: colors.textPrimary, letterSpacing: -0.5 }}>
            harry.
          </Text>
        </View>
      ) : <View style={{ width: 40 }} />}
      <View style={{ flex: 1, alignItems: "center" }}>
        {chipLabel && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: chipColor }} />
            <Text style={{ fontSize: 11, fontFamily: fontFamily.regular, color: chipColor }}>{chipLabel}</Text>
          </View>
        )}
      </View>
      <Pressable
        onPress={toggleScheme}
        hitSlop={8}
        accessibilityLabel={scheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        style={{
          paddingHorizontal: spacing[2], paddingVertical: 3,
          borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder,
        }}
      >
        <Ionicons
          name={scheme === "dark" ? "moon-outline" : "sunny-outline"}
          size={13}
          color={colors.textSecondary}
        />
      </Pressable>
    </View>
  );
}
