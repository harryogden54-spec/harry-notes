import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { spacing, fontFamily } from "@/lib/theme";
import { useTasks } from "@/lib/TasksContext";

export function OfflineBanner() {
  const { colors } = useTheme();
  const { syncStatus, syncNow } = useTasks();
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
        <Text style={{ fontSize: 11, fontFamily: fontFamily.medium, color: colors.warning, flex: 1 }}>
          Offline — changes will sync when reconnected
        </Text>
      </View>
    );
  }

  if (syncStatus !== "error") return null;

  return (
    <Pressable
      onPress={() => syncNow()}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing[2],
        paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
        backgroundColor: `${colors.danger}18`,
        borderBottomWidth: 1, borderBottomColor: `${colors.danger}30`,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={13} color={colors.danger} />
      <Text style={{ fontSize: 11, fontFamily: fontFamily.medium, color: colors.danger, flex: 1 }}>
        Sync failed — tap to retry
      </Text>
      <Ionicons name="refresh-outline" size={13} color={colors.danger} />
    </Pressable>
  );
}
