import React from "react";
import { View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useSyncStatus } from "@/lib/useSyncStatus";
import { useNotesSync } from "@/lib/NotesContext";
import { useTasksSync } from "@/lib/TasksContext";
import { Text } from "./Text";
import { spacing, radius } from "@/lib/theme";
import { timeAgo } from "@/components/notes/utils";

/**
 * Compact sync-status pill for the dashboard header.
 * Shows: syncing spinner / synced + relative time / error.
 * Tap to trigger an immediate sync.
 */
export function SyncStatusBadge() {
  const { colors } = useTheme();
  const { status, lastSynced } = useSyncStatus();
  const { syncNow: syncNotes } = useNotesSync();
  const { syncNow: syncTasks } = useTasksSync();

  async function handlePress() {
    await Promise.all([syncNotes(), syncTasks()]);
  }

  if (status === "idle") return null;

  type ActiveStatus = "syncing" | "synced" | "error";
  const config: Record<ActiveStatus, { color: string; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }> = {
    syncing: { color: colors.warning, icon: "sync-outline",              label: "Syncing…" },
    synced:  { color: colors.success, icon: "checkmark-circle-outline",  label: lastSynced ? timeAgo(lastSynced) : "Synced" },
    error:   { color: colors.danger,  icon: "alert-circle-outline",      label: "Sync error" },
  };

  const { color, icon, label } = config[status as ActiveStatus];

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[1],
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        borderRadius: radius.lg,
        backgroundColor: `${color}18`,
        borderWidth: 1,
        borderColor: `${color}30`,
      }}
    >
      <Ionicons
        name={icon}
        size={12}
        color={color}
        style={status === "syncing" ? { opacity: 0.85 } : undefined}
      />
      <Text size="xs" style={{ color, fontVariant: ["tabular-nums"] as any }}>
        {label}
      </Text>
    </Pressable>
  );
}
