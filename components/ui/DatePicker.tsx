import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, fontFamily } from "@/lib/theme";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface DatePickerProps {
  value?: string;      // "YYYY-MM-DD"
  onChange: (date?: string) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const { colors } = useTheme();
  const today = new Date();

  const [view, setView] = useState(() => {
    if (value) { const d = new Date(value + "T00:00:00"); return { y: d.getFullYear(), m: d.getMonth() }; }
    return { y: today.getFullYear(), m: today.getMonth() };
  });

  const todayStr = today.toISOString().slice(0, 10);

  function toStr(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function prevMonth() {
    setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  }

  function nextMonth() {
    setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 });
  }

  const firstDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={{
      backgroundColor: colors.bgTertiary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.bgBorder,
      padding: spacing[3],
      width: 224,
    }}>
      {/* Month nav */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[2] }}>
        <Pressable onPress={prevMonth} hitSlop={8} style={{ padding: spacing[1] }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>‹</Text>
        </Pressable>
        <Text size="xs" weight="semibold" style={{ color: colors.textPrimary }}>
          {MONTHS[view.m]} {view.y}
        </Text>
        <Pressable onPress={nextMonth} hitSlop={8} style={{ padding: spacing[1] }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>›</Text>
        </Pressable>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: "row", marginBottom: spacing[1] }}>
        {DAYS.map(d => (
          <View key={d} style={{ flex: 1, alignItems: "center" }}>
            <Text size="xs" style={{ color: colors.textTertiary }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: "row" }}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={{ flex: 1, height: 28 }} />;
            const str = toStr(view.y, view.m, day);
            const selected = value === str;
            const isToday  = str === todayStr;
            const isPast   = str < todayStr;

            return (
              <Pressable
                key={col}
                onPress={() => onChange(selected ? undefined : str)}
                style={{
                  flex: 1, height: 28,
                  alignItems: "center", justifyContent: "center",
                  borderRadius: radius.sm,
                  backgroundColor: selected ? colors.accent : "transparent",
                }}
              >
                <Text
                  size="xs"
                  style={{
                    color: selected
                      ? "#fff"
                      : isToday
                      ? colors.accent
                      : isPast
                      ? colors.textTertiary
                      : colors.textPrimary,
                    fontFamily: isToday ? fontFamily.bold : fontFamily.regular,
                  }}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Clear */}
      {value && (
        <Pressable
          onPress={() => onChange(undefined)}
          style={{ marginTop: spacing[2], alignItems: "center" }}
        >
          <Text size="xs" style={{ color: colors.textTertiary }}>Clear date</Text>
        </Pressable>
      )}
    </View>
  );
}
