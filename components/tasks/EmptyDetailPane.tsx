import React from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import type { Task } from "@/lib/TasksContext";
import { PRIORITY_CONFIG, PRIORITY_ORDER } from "./constants";
import { getTodayStr } from "@/lib/utils";

type Props = { open: Task[]; onFocusAddInput?: () => void };

export const EmptyDetailPane = React.memo(function EmptyDetailPane({ open, onFocusAddInput }: Props) {
  const { colors } = useTheme();
  const today       = getTodayStr();
  const overdueCount = open.filter(t => !!t.due_date && t.due_date < today).length;
  const counts      = PRIORITY_ORDER.map(p => ({ p, count: open.filter(t => t.priority === p).length })).filter(x => x.count > 0);
  const noPriority  = open.filter(t => !t.priority).length;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[5], padding: spacing[8] }}>
      <Ionicons name="checkbox-outline" size={48} color={colors.textTertiary} style={{ opacity: 0.18 }} />

      <View style={{ alignItems: "center", gap: spacing[2] }}>
        {overdueCount > 0 ? (
          <>
            <Text size="base" weight="semibold" style={{ color: colors.danger }}>
              {overdueCount} overdue {overdueCount === 1 ? "task" : "tasks"}
            </Text>
            <Text size="sm" secondary style={{ textAlign: "center" }}>
              Select a task from the list to view and edit details.
            </Text>
          </>
        ) : open.length === 0 ? (
          <>
            <Text size="base" weight="semibold" style={{ color: colors.textSecondary }}>All clear</Text>
            <Text size="sm" secondary style={{ textAlign: "center" }}>
              No open tasks. Add one above to get started.
            </Text>
          </>
        ) : (
          <>
            <Text size="base" weight="semibold" style={{ color: colors.textSecondary }}>Nothing selected</Text>
            <Text size="sm" secondary style={{ textAlign: "center" }}>
              Select a task to view details.
            </Text>
          </>
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

      {onFocusAddInput && (
        <Pressable
          onPress={onFocusAddInput}
          style={{
            paddingHorizontal: spacing[4], paddingVertical: spacing[2],
            borderRadius: radius.md, borderWidth: 1,
            borderColor: colors.bgBorder, backgroundColor: "transparent",
          }}
        >
          <Text size="sm" secondary>+ New task</Text>
        </Pressable>
      )}
    </View>
  );
});
