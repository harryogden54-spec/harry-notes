import React, { useState, useEffect } from "react";
import { View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { spacing, getShadow } from "@/lib/theme";
import { useSyncAll } from "@/lib/useSyncStatus";

/**
 * Overlay geometry. The banner is rendered *inside* PersistentHeader and pinned
 * to the header's bottom edge, so it floats over the top of the screen content
 * instead of sitting in the layout.
 *
 * It used to be a normal-flow sibling of the header, which meant every
 * appearance and disappearance re-laid-out the entire screen below it. A domain
 * that flaps between `error` and `syncing` — which is exactly what the sync
 * scheduler's backoff produces while one collection keeps failing — therefore
 * jolted the page up and down every retry.
 *
 * `top: "100%"` keeps it glued to the header without anyone having to measure
 * the header, whose height varies with the safe-area inset.
 */
const OVERLAY: any = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  zIndex: 30,
};

/** Tint layer inside the banner — see the opaque-base note at the call sites. */
const FILL: any = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 };

export function OfflineBanner() {
  const { colors, scheme, shadow } = useTheme();
  // Roll-up, not Tasks alone: keyed on useTasksSync this banner stayed hidden
  // while another domain was erroring, and its retry button re-synced Tasks —
  // never the collection that had actually failed.
  const { status: syncStatus, syncAll } = useSyncAll();
  const [networkOffline, setNetworkOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onOffline = () => setNetworkOffline(true);
    const onOnline  = () => setNetworkOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online",  onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online",  onOnline);
    };
  }, []);

  if (networkOffline) {
    return (
      <View style={{
        ...OVERLAY,
        flexDirection: "row", alignItems: "center", gap: spacing[2],
        paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
        // Opaque base under the tint: the banner now floats over scrolling
        // content, and a translucent fill would let that content read through.
        backgroundColor: colors.bgSecondary,
        borderBottomWidth: 1, borderBottomColor: `${colors.warning}30`,
        ...shadow("sm"),
      }}>
        <View style={{ ...FILL, backgroundColor: `${colors.warning}18` }} pointerEvents="none" />
        <Ionicons name="cloud-offline-outline" size={12} color={colors.warning} />
        <Text size="xs" weight="medium" color={colors.warning} style={{ flex: 1 }}>
          Offline — changes will sync when reconnected
        </Text>
      </View>
    );
  }

  if (syncStatus !== "error") return null;

  return (
    <Pressable
      onPress={() => { void syncAll(); }}
      style={{
        ...OVERLAY,
        flexDirection: "row", alignItems: "center", gap: spacing[2],
        paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
        backgroundColor: colors.bgSecondary,
        borderBottomWidth: 1, borderBottomColor: `${colors.danger}30`,
        ...shadow("sm"),
      }}
    >
      <View style={{ ...FILL, backgroundColor: `${colors.danger}18` }} pointerEvents="none" />
      <Ionicons name="cloud-offline-outline" size={12} color={colors.danger} />
      <Text size="xs" weight="medium" color={colors.danger} style={{ flex: 1 }}>
        Sync failed — tap to retry
      </Text>
      <Ionicons name="refresh-outline" size={12} color={colors.danger} />
    </Pressable>
  );
}
