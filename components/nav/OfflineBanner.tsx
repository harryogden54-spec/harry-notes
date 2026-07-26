import React, { useState, useEffect } from "react";
import { View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { spacing } from "@/lib/theme";
import { useSyncAll } from "@/lib/useSyncStatus";

export function OfflineBanner() {
  const { colors } = useTheme();
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
        flexDirection: "row", alignItems: "center", gap: spacing[2],
        paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
        backgroundColor: `${colors.warning}18`,
        borderBottomWidth: 1, borderBottomColor: `${colors.warning}30`,
      }}>
        <Ionicons name="cloud-offline-outline" size={13} color={colors.warning} />
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
        flexDirection: "row", alignItems: "center", gap: spacing[2],
        paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
        backgroundColor: `${colors.danger}18`,
        borderBottomWidth: 1, borderBottomColor: `${colors.danger}30`,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={13} color={colors.danger} />
      <Text size="xs" weight="medium" color={colors.danger} style={{ flex: 1 }}>
        Sync failed — tap to retry
      </Text>
      <Ionicons name="refresh-outline" size={13} color={colors.danger} />
    </Pressable>
  );
}
