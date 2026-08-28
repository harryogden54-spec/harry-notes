import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, IconButton } from "@/components/ui";
import { spacing, radius, iconSize } from "@/lib/theme";
import { getLocalDateStr, MONTH_NAMES } from "@/lib/utils";
import { isFiled, type Dump } from "@/lib/DumpContext";

/** What the dot under a day means. */
export type DayMark = {
  /** Something was captured for this day. */
  written: boolean;
  /** Everything captured for it has reached Supabase. */
  synced: boolean;
};

/**
 * Which days of any month carry captures, and whether those captures have been
 * uploaded.
 *
 * "Synced" is derived from timestamps rather than the engine's dirty set: that
 * set lives in a ref and never triggers a render, so a dot keyed on it would go
 * stale the moment it mattered. A row whose `updated_at` predates the last
 * successful sync has certainly been pushed; one that doesn't, hasn't yet. The
 * failure mode is conservative — it can say "pending" a beat longer than
 * necessary, never "synced" when it isn't.
 */
export function buildDayMarks(dumps: Dump[], lastSynced: string | null): Map<string, DayMark> {
  const marks = new Map<string, DayMark>();
  for (const d of dumps) {
    if (!d.note_date) continue;
    // An unfiled draft is not a written day — lighting the dot for one would
    // make the calendar claim a half-typed sentence as the day's entry.
    if (!isFiled(d)) continue;
    const stamp = d.updated_at ?? d.created_at;
    const isSynced = !!lastSynced && stamp <= lastSynced;
    const prev = marks.get(d.note_date);
    marks.set(d.note_date, {
      written: true,
      synced: prev ? prev.synced && isSynced : isSynced,
    });
  }
  return marks;
}

// Monday-first, matching DatePicker — the only other calendar grid in the app.
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Days of `month` laid out in Monday-first weeks, with leading blanks. */
function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  // getDay() is Sunday-based; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type Props = {
  marks: Map<string, DayMark>;
  selected: string | null;
  onSelect: (date: string) => void;
};

/**
 * Block A: the month grid. Each day that has anything captured for it carries a
 * dot underneath — accent once it has reached the server, warning while it is
 * still only on this device.
 */
export function MonthCalendar({ marks, selected, onSelect }: Props) {
  const { colors } = useTheme();
  const today = getLocalDateStr();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor.year, cursor.month]);

  function shift(by: number) {
    setCursor(c => {
      const d = new Date(c.year, c.month + by, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const isCurrentMonth =
    cursor.year === new Date().getFullYear() && cursor.month === new Date().getMonth();

  return (
    <View style={{ gap: spacing[3] }}>
      {/* Month switcher */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <IconButton name="chevron-back" onPress={() => shift(-1)} accessibilityLabel="Previous month"
          size={40} iconSize={iconSize.sm} />
        <Text size="cardTitle" weight="semibold" style={{ flex: 1, textAlign: "center" }}>
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </Text>
        <IconButton name="chevron-forward" onPress={() => shift(1)} accessibilityLabel="Next month"
          size={40} iconSize={iconSize.sm} />
      </View>

      {!isCurrentMonth && (
        <Pressable
          onPress={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); }}
          style={{ alignSelf: "center" }}
        >
          <Text size="meta" style={{ color: colors.accent }}>Back to this month</Text>
        </Pressable>
      )}

      {/* The grid is capped and centred. At full card width the seven columns
          stretched to ~64px each, so the month read as a table rather than a
          calendar; the day itself is a fixed chip with the dot inside it. */}
      <View style={{ width: "100%", maxWidth: 340, alignSelf: "center", gap: spacing[2] }}>
        <View style={{ flexDirection: "row" }}>
          {WEEKDAYS.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center" }}>
              <Text size="label" tertiary weight="semibold">{w}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: spacing[1] }}>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection: "row" }}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                if (day === null) return <View key={col} style={{ flex: 1 }} />;
                const date = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const mark = marks.get(date);
                const isToday    = date === today;
                const isSelected = date === selected;
                // Dot colour is the whole point of the indicator, so it stays a
                // real signal: accent = safely on the server, warning = written
                // here and not yet pushed.
                const dotColor = mark ? (mark.synced ? colors.accent : colors.warning) : undefined;
                return (
                  <View key={col} style={{ flex: 1, alignItems: "center" }}>
                    <Pressable
                      onPress={() => onSelect(date)}
                      accessibilityRole="button"
                      accessibilityLabel={`${day} ${MONTH_NAMES[cursor.month]}${mark ? ", has an entry" : ""}`}
                      style={{
                        width: 40, alignItems: "center", justifyContent: "center",
                        paddingVertical: spacing[1], gap: 3,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.accent : isToday ? `${colors.accent}55` : "transparent",
                        backgroundColor: isSelected ? `${colors.accent}18` : "transparent",
                      }}
                    >
                      <Text
                        size="meta"
                        weight={isToday || isSelected ? "semibold" : "regular"}
                        style={{ color: isSelected ? colors.accent : colors.textPrimary }}
                      >
                        {day}
                      </Text>
                      {/* The row is always 5px tall so days without a dot don't
                          sit a few pixels higher than days with one. */}
                      <View style={{ height: 5, justifyContent: "center" }}>
                        {dotColor && (
                          <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: dotColor }} />
                        )}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Legend — two dots that look alike need saying once, quietly. */}
      <View style={{ height: 1, backgroundColor: colors.bgBorder }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], justifyContent: "flex-end" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: colors.accent }} />
          <Text size="meta" tertiary>Synced</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: colors.warning }} />
          <Text size="meta" tertiary>On this device</Text>
        </View>
      </View>
    </View>
  );
}
