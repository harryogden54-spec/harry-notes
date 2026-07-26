import React, { useState, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { View, ScrollView, Pressable, Modal, Platform } from "react-native";
// Side-notch padding only — PersistentHeader owns the top inset, MobileTabBar the bottom.
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, GradientBackground, Surface, DatePicker, TaskRow, SectionHeader } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useScrollBottomPadding } from "@/lib/TabBarHeightContext";
import { webContentStyle } from "@/lib/webLayout";
import { useTasksData, useTasksActions, type Task } from "@/lib/TasksContext";
import { getTodayStr } from "@/lib/utils";

const DAYS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

/** Returns the Monday of the ISO week that contains `date` */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Reschedule menu ─────────────────────────────────────────────────────────

function RescheduleMenu({
  taskId, taskTitle, fromDate, visible, onClose,
}: {
  taskId: string; taskTitle: string; fromDate: string;
  visible: boolean; onClose: () => void;
}) {
  const { colors } = useTheme();
  const { updateTask } = useTasksActions();
  const [showPicker, setShowPicker] = useState(false);

  const prevDay = toDateStr(addDays(new Date(fromDate + "T00:00:00"), -1));
  const nextDay = toDateStr(addDays(new Date(fromDate + "T00:00:00"), 1));

  function reschedule(date: string) {
    updateTask(taskId, { due_date: date });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
      >
        <Pressable
          onPress={e => e.stopPropagation?.()}
          style={{
            backgroundColor: colors.bgSecondary, borderRadius: radius.xl,
            borderWidth: 1, borderColor: colors.bgBorder,
            padding: spacing[4], width: 280, gap: spacing[3],
          }}
        >
          <Text size="sm" weight="semibold" numberOfLines={2} style={{ color: colors.textPrimary }}>{taskTitle}</Text>
          <Text size="xs" secondary>Move to…</Text>
          <View style={{ gap: spacing[1.5] }}>
            {[
              { label: "Previous day", date: prevDay },
              { label: "Next day",     date: nextDay },
            ].map(opt => (
              <Pressable
                key={opt.date}
                onPress={() => reschedule(opt.date)}
                style={{
                  paddingHorizontal: spacing[3], paddingVertical: spacing[2],
                  borderRadius: radius.md, borderWidth: 1, borderColor: colors.bgBorder,
                  backgroundColor: colors.bgTertiary,
                }}
              >
                <Text size="sm" style={{ color: colors.textPrimary }}>{opt.label}</Text>
                <Text size="xs" secondary>{opt.date}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowPicker(v => !v)}
              style={{
                paddingHorizontal: spacing[3], paddingVertical: spacing[2],
                borderRadius: radius.md, borderWidth: 1, borderColor: colors.bgBorder,
              }}
            >
              <Text size="sm" style={{ color: colors.accent }}>Pick a date…</Text>
            </Pressable>
          </View>
          {showPicker && (
            <DatePicker value={fromDate} onChange={(d) => { if (d) reschedule(d); }} />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Task chip (shared by both views) ────────────────────────────────────────

function TaskChip({ task, fromDate }: { task: Task; fromDate: string }) {
  const { colors } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const today = getTodayStr();
  const isOverdue = !task.done && task.due_date && task.due_date < today;

  return (
    <>
      <Pressable
        onLongPress={() => !task.done && setMenuOpen(true)}
        // @ts-ignore
        onContextMenu={Platform.OS === "web" ? (e: any) => { e.preventDefault(); if (!task.done) setMenuOpen(true); } : undefined}
        style={{
          paddingHorizontal: spacing[1.5], paddingVertical: 3,
          borderRadius: radius.sm,
          backgroundColor: task.done ? colors.bgTertiary : isOverdue ? `${colors.danger}18` : `${colors.accent}14`,
          borderWidth: 1,
          borderColor: task.done ? colors.bgBorder : isOverdue ? `${colors.danger}40` : `${colors.accent}30`,
          marginBottom: 2,
        }}
      >
        <Text
          size="xs"
          numberOfLines={1}
          style={{
            color: task.done ? colors.textTertiary : isOverdue ? colors.danger : colors.textPrimary,
            textDecorationLine: task.done ? "line-through" : "none",
          }}
        >
          {task.title}
        </Text>
      </Pressable>
      <RescheduleMenu
        taskId={task.id}
        taskTitle={task.title}
        fromDate={fromDate}
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({
  weekStart, tasksByDate, today, onDaySelect, selectedDate,
}: {
  weekStart: Date;
  tasksByDate: Record<string, Task[]>;
  today: string;
  onDaySelect: (d: string) => void;
  selectedDate: string | null;
}) {
  const { colors } = useTheme();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <Surface style={{ padding: spacing[3] }}>
      <View style={{ flexDirection: "row", gap: spacing[1] }}>
        {days.map(d => {
          const ds = toDateStr(d);
          const dayTasks = tasksByDate[ds] ?? [];
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          const hasOverdue = dayTasks.some(t => !t.done && ds < today);
          const dayLabel = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];

          return (
            <Pressable
              key={ds}
              onPress={() => onDaySelect(ds)}
              style={{ flex: 1, minWidth: 0 }}
            >
              {/* Day header */}
              <View style={{
                alignItems: "center", paddingVertical: spacing[1.5],
                marginBottom: spacing[1],
                borderRadius: radius.md,
                backgroundColor: isSelected ? colors.accent : isToday ? `${colors.accent}20` : "transparent",
              }}>
                <Text size="xs" style={{
                  fontFamily: fontFamily.medium,
                  color: isSelected ? colors.textInverse : colors.textTertiary,
                  fontSize: 10,
                }}>{dayLabel}</Text>
                <Text size="sm" style={{
                  fontFamily: isToday ? fontFamily.bold : fontFamily.regular,
                  color: isSelected ? colors.textInverse : isToday ? colors.accent : colors.textPrimary,
                }}>{d.getDate()}</Text>
                {dayTasks.length > 0 && (
                  <View style={{
                    width: 4, height: 4, borderRadius: 99, marginTop: 2,
                    backgroundColor: isSelected ? "rgba(255,255,255,0.7)" : hasOverdue ? colors.danger : colors.accent,
                  }} />
                )}
              </View>
              {/* Task chips */}
              <View style={{ gap: 2 }}>
                {dayTasks.slice(0, 4).map(t => (
                  <TaskChip key={t.id} task={t} fromDate={ds} />
                ))}
                {dayTasks.length > 4 && (
                  <Text size="xs" style={{ color: colors.textTertiary, textAlign: "center" }}>+{dayTasks.length - 4}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Surface>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

function CalendarScreen() {
  const { colors } = useTheme();
  const scrollBottom = useScrollBottomPadding();
  const { tasks } = useTasksData();
  const today = getTodayStr();

  type ViewMode = "month" | "week";
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  const { year, month } = viewDate;

  function prevPeriod() {
    if (viewMode === "month") {
      setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 });
    } else {
      setWeekStart(ws => addDays(ws, -7));
    }
  }

  function nextPeriod() {
    if (viewMode === "month") {
      setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 });
    } else {
      setWeekStart(ws => addDays(ws, 7));
    }
  }

  const daysInMonth  = getDaysInMonth(year, month);
  const firstWeekDay = getFirstDayOfWeek(year, month);

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

  const cells: (number | null)[] = [
    ...Array(firstWeekDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Nav header label
  const weekEnd = addDays(weekStart, 6);
  const navLabel = viewMode === "month"
    ? `${MONTHS[month]} ${year}`
    : weekStart.getMonth() === weekEnd.getMonth()
      ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`
      : `${MONTHS[weekStart.getMonth()].slice(0, 3)} – ${MONTHS[weekEnd.getMonth()].slice(0, 3)} ${weekEnd.getFullYear()}`;

  return (
    <GradientBackground>
      <SafeAreaView edges={["left", "right"]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[{ padding: spacing[4], paddingBottom: scrollBottom }, webContentStyle]}
        >
          {/* Header */}
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5], flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text size="2xl" weight="bold">Calendar</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              {/* Month / Week toggle */}
              <View style={{ flexDirection: "row", borderRadius: radius.md, borderWidth: 1, borderColor: colors.bgBorder, overflow: "hidden" }}>
                {(["month", "week"] as ViewMode[]).map(m => (
                  <Pressable
                    key={m}
                    onPress={() => setViewMode(m)}
                    style={{
                      paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
                      backgroundColor: viewMode === m ? colors.accent : "transparent",
                    }}
                  >
                    <Text size="xs" weight="medium" style={{ color: viewMode === m ? colors.textInverse : colors.textSecondary, textTransform: "capitalize" }}>{m}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => {
                  const now = new Date();
                  setViewDate({ year: now.getFullYear(), month: now.getMonth() });
                  setWeekStart(getWeekStart(now));
                  setSelectedDate(today);
                }}
                style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder }}
              >
                <Text size="xs" weight="medium" secondary>Today</Text>
              </Pressable>
            </View>
          </View>

          {/* Nav + grid */}
          <Surface style={{ marginBottom: spacing[4], padding: spacing[4] }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[4] }}>
              <Pressable onPress={prevPeriod} hitSlop={12} style={{ padding: spacing[1] }}>
                <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
              </Pressable>
              <Text size="base" weight="semibold">{navLabel}</Text>
              <Pressable onPress={nextPeriod} hitSlop={12} style={{ padding: spacing[1] }}>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {viewMode === "month" ? (
              <>
                {/* Day-of-week headers */}
                <View style={{ flexDirection: "row", marginBottom: spacing[2] }}>
                  {DAYS.map(d => (
                    <View key={d} style={{ flex: 1, alignItems: "center" }}>
                      <Text size="xs" style={{ color: colors.textTertiary, fontFamily: fontFamily.medium }}>{d}</Text>
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
                      const hasOverdue = tasksByDate[ds]?.some(t => !t.done && ds < today);

                      return (
                        <Pressable
                          key={col}
                          onPress={() => setSelectedDate(prev => prev === ds ? null : ds)}
                          style={{
                            flex: 1, alignItems: "center", paddingVertical: spacing[1.5],
                            borderRadius: radius.md,
                            backgroundColor: isSelected ? colors.accent : isToday ? `${colors.accent}20` : "transparent",
                          }}
                        >
                          <Text size="sm" style={{
                            fontFamily: isToday ? fontFamily.bold : fontFamily.regular,
                            color: isSelected ? colors.textInverse : isToday ? colors.accent : colors.textPrimary,
                          }}>{day}</Text>
                          {hasTasks && (
                            <View style={{
                              width: 5, height: 5, borderRadius: 99,
                              backgroundColor: isSelected ? "rgba(255,255,255,0.7)" : hasOverdue ? colors.danger : colors.accent,
                              marginTop: 2,
                            }} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </>
            ) : (
              <WeekView
                weekStart={weekStart}
                tasksByDate={tasksByDate}
                today={today}
                onDaySelect={d => setSelectedDate(prev => prev === d ? null : d)}
                selectedDate={selectedDate}
              />
            )}
          </Surface>

          {/* Selected day task list — priority grouped */}
          {selectedDate && (
            <View style={{ gap: spacing[3] }}>
              <Text size="xs" weight="semibold" style={{
                textTransform: "uppercase", letterSpacing: 1.2,
                color: colors.textSecondary, fontSize: 11,
              }}>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </Text>
              {selectedTasks.length === 0 ? (
                <Surface style={{ padding: spacing[4], alignItems: "center" }}>
                  <Text size="sm" secondary>No tasks on this day.</Text>
                </Surface>
              ) : (() => {
                const PRIORITY_ORDER = ["urgent", "high", "medium", "low", null] as const;
                const PRIORITY_LABELS: Record<string, string> = {
                  urgent: "Urgent", high: "High", medium: "Medium", low: "Low",
                };
                const grouped = PRIORITY_ORDER
                  .map(p => ({
                    priority: p,
                    tasks: selectedTasks.filter(t => (t.priority ?? null) === p),
                  }))
                  .filter(g => g.tasks.length > 0);

                return (
                  <View style={{ gap: spacing[3] }}>
                    {grouped.map(({ priority, tasks: groupTasks }) => (
                      <View key={priority ?? "none"}>
                        <SectionHeader
                          label={priority ? PRIORITY_LABELS[priority] : "No priority"}
                          count={groupTasks.length}
                        />
                        <Surface style={{ overflow: "hidden", padding: 0 }}>
                          {groupTasks.map(task => (
                            <TaskRow
                              key={task.id}
                              task={task}
                              onPress={() => {}}
                            />
                          ))}
                        </Surface>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

export default function CalendarScreenBounded() {
  return <ErrorBoundary><CalendarScreen /></ErrorBoundary>;
}

