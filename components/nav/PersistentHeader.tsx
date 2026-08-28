import React from "react";
import { View, Pressable, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";
import { useThemeContext } from "@/lib/ThemeContext";
import { useSyncAll } from "@/lib/useSyncStatus";
import { useToast } from "@/lib/ToastContext";
import { useMounted } from "@/lib/useMounted";
import { OfflineBanner } from "./OfflineBanner";

function syncChipLabel(status: string, lastSynced: string | null, mounted: boolean): string | null {
  // Render nothing until mounted: the relative time would differ between the
  // server-rendered markup and the first client render.
  if (!mounted) return null;
  if (status === "syncing") return "Syncing…";
  if (status === "error") return "Sync failed";
  if (!lastSynced) return "Never synced";
  const diff = Math.floor((Date.now() - new Date(lastSynced).getTime()) / 1000);
  if (diff < 15) return "Just synced";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `Synced ${m}m ago`;
  return `Synced ${Math.floor(m / 60)}h ago`;
}

/**
 * Owns the useSyncAll subscription so the header around it doesn't.
 *
 * The header is the one component mounted on every screen, and useSyncAll reads
 * six sync contexts — so with the subscription at header level, every domain's
 * status change (including each background pull) re-rendered the wordmark,
 * theme toggle and settings gear too. Keeping it in this leaf confines those
 * renders to the chip.
 */
const SyncChip = React.memo(function SyncChip() {
  const { colors } = useTheme();
  const { status, lastSynced, syncAll } = useSyncAll();
  const { showToast } = useToast();
  const mounted = useMounted();

  const chipLabel = syncChipLabel(status, lastSynced, mounted);
  const chipColor = status === "error" ? colors.danger : status === "syncing" ? colors.accent : colors.textTertiary;

  async function handleSyncPress() {
    if (status === "syncing") return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const ok = await syncAll();
    showToast(ok ? "Synced" : "Some items couldn't sync — try again");
  }

  if (!chipLabel) return null;

  // Quiet status text that also *is* the manual-sync control — one chip
  // serving mobile and desktop, driven by the shared useSyncAll trigger
  // (no parallel sync path).
  return (
    <Pressable
      onPress={handleSyncPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${chipLabel}. Tap to sync now.`}
      // @ts-ignore web-only tooltip
      title={Platform.OS === "web" ? "Sync now" : undefined}
      style={({ hovered }: any) => ({
        flexDirection: "row", alignItems: "center", gap: 4,
        paddingHorizontal: spacing[1.5], paddingVertical: 2,
        borderRadius: radius.sm,
        backgroundColor: hovered ? colors.bgTertiary : "transparent",
        ...(Platform.OS === "web" ? {
          cursor: status === "syncing" ? "default" : "pointer",
          transitionProperty: "background-color",
          transitionDuration: "120ms",
        } : {}),
      } as any)}
    >
      <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: chipColor }} />
      <Text size="xs" color={chipColor}>{chipLabel}</Text>
    </Pressable>
  );
});

export function PersistentHeader({ showTitle = true }: { showTitle?: boolean }) {
  const { colors, scheme } = useTheme();
  const router = useRouter();
  const { toggle } = useThemeContext();
  // Standalone PWA / native render under the status bar — the header owns the
  // top inset (screens below no longer pad their own top).
  const insets = useSafeAreaInsets();

  function toggleScheme() {
    toggle();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <View style={{
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing[4],
      paddingTop: spacing[2] + insets.top, paddingBottom: spacing[2],
      borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
      backgroundColor: colors.bgSecondary,
      minHeight: 40,
      // Raise the header above the screen content that follows it in the tree,
      // so OfflineBanner — absolutely positioned below the header's bottom edge
      // — paints over that content instead of behind it.
      zIndex: 20,
    }}>
      {showTitle ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
          <Image source={require("@/assets/images/icon.png")} style={{ width: 16, height: 16, borderRadius: 4 }} />
          <Text size="base" weight="bold" style={{ letterSpacing: -0.5 }}>
            harry.
          </Text>
        </View>
      ) : <View style={{ width: 40 }} />}
      <View style={{ flex: 1, alignItems: "center" }}>
        <SyncChip />
      </View>
      {/* The touch target is the outer Pressable, inflated with padding and
          pulled back with an equal negative margin so the header keeps its
          height. `hitSlop` used to do this job and does nothing on web — see
          components/ui/IconButton for the full story. */}
      <Pressable
        onPress={toggleScheme}
        accessibilityRole="button"
        accessibilityLabel={scheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        // @ts-ignore web-only tooltip
        title={Platform.OS === "web" ? (scheme === "dark" ? "Switch to light mode" : "Switch to dark mode") : undefined}
        style={{ margin: -10, padding: 10 } as any}
      >
        {({ hovered, pressed }: any) => (
          <View style={{
            paddingHorizontal: spacing[2], paddingVertical: 3,
            minWidth: 30, minHeight: 22, alignItems: "center", justifyContent: "center",
            borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder,
            backgroundColor: hovered ? colors.bgTertiary : "transparent",
            ...(Platform.OS === "web" ? {
              transitionProperty: "background-color, transform",
              transitionDuration: "120ms",
              transform: [{ scale: pressed ? 0.96 : 1 }],
            } : {}),
          } as any}>
            <Ionicons
              name={scheme === "dark" ? "moon-outline" : "sunny-outline"}
              size={14}
              color={colors.textSecondary}
            />
          </View>
        )}
      </Pressable>
      {/* Mobile has no pinned sidebar, so Settings was only reachable from the
          Dashboard tab's gear icon — give every screen a way there. Desktop's
          Sidebar already has Settings pinned, so skip it there (showTitle is
          only true on mobile). */}
      {showTitle && (
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={{ marginLeft: spacing[2] - 8, marginVertical: -8, padding: 8 } as any}
        >
          <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
        </Pressable>
      )}
      {/* Lives inside the header so it can anchor to the header's bottom edge
          without measuring it, and overlays the screen rather than displacing
          it. Both layouts used to render it as a normal-flow sibling, which
          made every sync retry shove the page up and down. */}
      <OfflineBanner />
    </View>
  );
}
