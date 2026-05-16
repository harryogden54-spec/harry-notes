import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing } from "@/lib/theme";
import type { Task } from "@/lib/TasksContext";
import { PRIORITY_CONFIG, PRIORITY_ORDER } from "./constants";

type Props = { open: Task[] };

export const EmptyDetailPane = React.memo(function EmptyDetailPane({ open }: Props) {
  const { colors } = useTheme();
  const counts    = PRIORITY_ORDER.map(p => ({ p, count: open.filter(t => t.priority === p).length })).filter(x => x.count > 0);
  const noPriority = open.filter(t => !t.priority).length;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], padding: spacing[6] }}>
      <Ionicons name="checkbox-outline" size={40} color={colors.textTertiary} />
      <View style={{ alignItems: "center", gap: spacing[1] }}>
        <Text size="sm" secondary>Select a task to view details</Text>
        {open.length > 0 && (
          <Text size="xs" style={{ color: colors.textTertiary }}>{open.length} open task{open.length !== 1 ? "s" : ""}</Text>
        )}
      </View>
      {(counts.length > 0 || noPriority > 0) && (
        <View style={{ gap: spacing[1.5], alignItems: "flex-start" }}>
          {counts.map(({ p, count }) => (
            <View key={p} style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: PRIORITY_CONFIG[p].color }} />
              <Text size="xs" secondary>{count} {PRIORITY_CONFIG[p].label}</Text>
            </View>
          ))}
          {noPriority > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: colors.bgBorder }} />
              <Text size="xs" secondary>{noPriority} No priority</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});
