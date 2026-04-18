import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Surface } from "@/components/ui/Surface";
import { useTheme } from "@/lib/useTheme";
import { spacing } from "@/lib/theme";
import { useTaskStats } from "@/lib/useTaskStats";

const BAR_MAX_HEIGHT = 28;
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function WeeklyStatsCard() {
  const { colors } = useTheme();
  const { completedThisWeekCount, sparkline, streak } = useTaskStats();

  const maxVal = Math.max(...sparkline, 1);

  return (
    <Surface style={{ padding: spacing[4], gap: spacing[3] }}>
      {/* Top row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ gap: spacing[0.5] }}>
          <Text size="xs" secondary style={{ textTransform: "uppercase", letterSpacing: 1 }}>This week</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing[1] }}>
            <Text size="2xl" weight="bold">{completedThisWeekCount}</Text>
            <Text size="sm" secondary>done</Text>
          </View>
        </View>
        {streak > 0 && (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: spacing[1],
            backgroundColor: `${colors.accent}18`,
            paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
            borderRadius: 99, borderWidth: 1, borderColor: `${colors.accent}30`,
          }}>
            <Text style={{ fontSize: 13 }}>🔥</Text>
            <Text size="xs" weight="semibold" style={{ color: colors.accent }}>{streak}d streak</Text>
          </View>
        )}
      </View>

      {/* Sparkline */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing[1.5] }}>
        {sparkline.map((val, i) => {
          const barHeight = Math.max(3, Math.round((val / maxVal) * BAR_MAX_HEIGHT));
          const isToday = i === 6;
          return (
            <View key={i} style={{ flex: 1, alignItems: "center", gap: spacing[1] }}>
              <View style={{
                width: "100%", height: barHeight,
                borderRadius: 3,
                backgroundColor: isToday
                  ? colors.accent
                  : val > 0
                    ? `${colors.accent}55`
                    : colors.bgBorder,
              }} />
              <Text size="xs" style={{
                color: isToday ? colors.accent : colors.textTertiary,
                fontSize: 10,
              }}>
                {DAY_LABELS[i]}
              </Text>
            </View>
          );
        })}
      </View>
    </Surface>
  );
}
