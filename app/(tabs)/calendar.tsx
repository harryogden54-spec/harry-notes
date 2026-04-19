import React, { useState, useMemo } from "react";
import { View, ScrollView, SafeAreaView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, GradientBackground, Surface } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";
import { useTasks } from "@/lib/TasksContext";
import { getTodayStr } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Returns the weekday index (0=Mon … 6=Sun) of the 1st of the month */
function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay(); // 0=Sun
  return day === 0 ? 6 : day - 1;               // convert to Mon=0
}

export default function CalendarScreen() {
  const { colors } = useTheme();
  const { tasks } = useTasks();
  const today = getTodayStr();

  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const { year, month } = viewDate;

  const prevMonth = () =>
    setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 });
  const nextMonth = () =>
    setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 });

  const daysInMonth  = getDaysInMonth(year, month);
  const firstWeekDay = getFirstDayOfWeek(year, month);

  // Map YYYY-MM-DD → tasks on that day
  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    for (const t of tasks) {
      if (!t.archived && t.due_date) {
        if (!map[t.due_date]) map[t.due_date] = [];
        map[t.due_date].push(t);
      }
    }
    return map;
  }, [tasks]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] ?? []) : [];

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;

  // Build grid cells (null = empty leading cell)
  const cells: (number | null)[] = [
    ...Array(firstWeekDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete final row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[{ padding: spacing[4], paddingBottom: spacing[16] }, webContentStyle]}
        >
          {/* Header */}
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5], flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text size="2xl" weight="bold">Calendar</Text>
            <Pressable
              onPress={() => { const now = new Date(); setViewDate({ year: now.getFullYear(), month: now.getMonth() }); setSelectedDate(today); }}
              style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder }}
            >
              <Text size="xs" weight="medium" secondary>Today</Text>
            </Pressable>
          </View>

          {/* Month nav */}
          <Surface style={{ marginBottom: spacing[4], padding: spacing[4] }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[4] }}>
              <Pressable onPress={prevMonth} hitSlop={12} style={{ padding: spacing[1] }}>
                <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
              </Pressable>
              <Text size="base" weight="semibold">
                {MONTHS[month]} {year}
              </Text>
              <Pressable onPress={nextMonth} hitSlop={12} style={{ padding: spacing[1] }}>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Day-of-week headers */}
            <View style={{ flexDirection: "row", marginBottom: spacing[2] }}>
              {DAYS.map(d => (
                <View key={d} style={{ flex: 1, alignItems: "center" }}>
                  <Text size="xs" style={{ color: colors.textTertiary, fontFamily: fontFamily.medium }}>
                    {d}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <View key={row} style={{ flexDirection: "row", marginBottom: spacing[1] }}>
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (day === null) return <View key={col} style={{ flex: 1 }} />;
                  const ds = dateStr(day);
                  const isToday = ds === today;
                  const isSelected = ds === selectedDate;
                  const hasTasks = !!tasksByDate[ds]?.length;
                  const taskCount = tasksByDate[ds]?.length ?? 0;
                  const hasOverdue = tasksByDate[ds]?.some(t => !t.done && ds < today);

                  return (
                    <Pressable
                      key={col}
                      onPress={() => setSelectedDate(prev => prev === ds ? null : ds)}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: spacing[1.5],
                        borderRadius: radius.md,
                        backgroundColor: isSelected
                          ? colors.accent
                          : isToday
                          ? `${colors.accent}20`
                          : "transparent",
                      }}
                    >
                      <Text
                        size="sm"
                        style={{
                          fontFamily: isToday ? fontFamily.bold : fontFamily.regular,
                          color: isSelected
                            ? "#fff"
                            : isToday
                            ? colors.accent
                            : colors.textPrimary,
                        }}
                      >
                        {day}
                      </Text>
                      {hasTasks && (
                        <View style={{
                          width: 5, height: 5, borderRadius: 99,
                          backgroundColor: isSelected
                            ? "rgba(255,255,255,0.7)"
                            : hasOverdue
                            ? "#F26464"
                            : colors.accent,
                          marginTop: 2,
                        }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Surface>

          {/* Selected day task list */}
          {selectedDate && (
            <View>
              <Text size="xs" weight="semibold" style={{
                textTransform: "uppercase", letterSpacing: 1.2,
                color: colors.textSecondary, fontSize: 11,
                marginBottom: spacing[2],
              }}>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </Text>
              {selectedTasks.length === 0 ? (
                <Surface style={{ padding: spacing[4], alignItems: "center" }}>
                  <Text size="sm" secondary>No tasks on this day.</Text>
                </Surface>
              ) : (
                <Surface style={{ padding: 0, overflow: "hidden" }}>
                  {selectedTasks.map((task, i) => (
                    <View
                      key={task.id}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: spacing[3],
                        paddingHorizontal: spacing[4], paddingVertical: spacing[3],
                        borderBottomWidth: i < selectedTasks.length - 1 ? 1 : 0,
                        borderBottomColor: colors.bgBorder,
                      }}
                    >
                      <View style={{
                        width: 8, height: 8, borderRadius: 99,
                        backgroundColor: task.done ? colors.textTertiary : colors.accent,
                      }} />
                      <Text
                        size="sm"
                        style={{
                          flex: 1,
                          color: task.done ? colors.textTertiary : colors.textPrimary,
                          textDecorationLine: task.done ? "line-through" : "none",
                        }}
                      >
                        {task.title}
                      </Text>
                      {task.done && (
                        <Text size="xs" secondary>Done</Text>
                      )}
                    </View>
                  ))}
                </Surface>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
