import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { GlassCard } from "@/components/ui/GlassCard";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";
import { PRIORITY_COLOR } from "@/lib/utils";
import type { Task } from "@/lib/TasksContext";

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

interface Props {
  tasksByDate: Record<string, Task[]>;
  selected: string;
  onSelect: (d: string) => void;
  today: string;
}

export function MiniCalendar({ tasksByDate, selected, onSelect, today }: Props) {
  const { colors } = useTheme();
  const now = new Date(today + "T00:00:00");
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const firstDay    = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <GlassCard style={{ marginBottom: spacing[5], padding: spacing[4] }}>
      {/* Month nav */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[3] }}>
        <Pressable onPress={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })} hitSlop={12} style={{ padding: spacing[1] }}>
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={() => { const n = new Date(); setView({ y: n.getFullYear(), m: n.getMonth() }); }} hitSlop={8}>
          <Text size="sm" weight="semibold">{MONTHS[view.m]} {view.y}</Text>
        </Pressable>
        <Pressable onPress={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 })} hitSlop={12} style={{ padding: spacing[1] }}>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: "row", marginBottom: spacing[1] }}>
        {DAYS.map(d => (
          <View key={d} style={{ flex: 1, alignItems: "center", paddingVertical: spacing[0.5] }}>
            <Text size="xs" tertiary weight="semibold" style={{ letterSpacing: 0.5 }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: "row" }}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={{ flex: 1, height: 38 }} />;
            const str       = toStr(view.y, view.m, day);
            const isToday   = str === today;
            const isSel     = str === selected;
            const dayTasks  = tasksByDate[str] ?? [];
            const openTasks = dayTasks.filter(t => !t.done);
            const hasOpen   = openTasks.length > 0;
            const isPast    = str < today;
            const isOverdue = isPast && hasOpen;
            const topP      = openTasks.find(t => t.priority === "urgent")?.priority
              ?? openTasks.find(t => t.priority === "high")?.priority
              ?? openTasks.find(t => t.priority === "medium")?.priority
              ?? openTasks.find(t => t.priority === "low")?.priority;
            const dotColor  = isOverdue ? colors.danger : (topP ? PRIORITY_COLOR[topP] : colors.accent);

            return (
              <Pressable
                key={col}
                onPress={() => onSelect(str)}
                style={{
                  flex: 1, height: 38, alignItems: "center", justifyContent: "center",
                  borderRadius: radius.md,
                  backgroundColor: isSel ? colors.accent : isToday ? `${colors.accent}22` : "transparent",
                }}
              >
                <Text
                  size="sm"
                  weight={isToday ? "bold" : undefined}
                  style={{ color: isSel ? "#fff" : isToday ? colors.accent : isPast ? colors.textTertiary : colors.textPrimary }}
                >
                  {day}
                </Text>
                {hasOpen && (
                  <View style={{
                    width: 6, height: 6, borderRadius: 99,
                    backgroundColor: isSel ? "#ffffff88" : dotColor,
                    marginTop: 1,
                  }} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </GlassCard>
  );
}
