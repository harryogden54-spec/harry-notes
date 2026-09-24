import React from "react";
import { View, Modal, Pressable, Platform, ScrollView, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, IconButton } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, iconSize, layout, shape, transition } from "@/lib/theme";
import { useTasksActions } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { useSemesterTracker } from "@/lib/useSemesterTracker";
import {
  TRACKER_ITEMS, courseByKey, formatTime, sessionsFor, shortDate, weekRangeLabel,
  type CourseKey, type Session,
} from "@/lib/semester";
import { useCourseColors, useCoursesInk } from "./courseColors";
import { Tick } from "./Tick";

export type SheetTarget = { course: CourseKey; week: number; session?: Session };

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Sun 27 Sep". Not toLocaleDateString — newer ICU spells September "Sept". */
function dueLabel(date?: string): string {
  if (!date) return "no date";
  const d = new Date(date + "T00:00:00");
  return `${WEEKDAYS[d.getDay()]} ${shortDate(d)}`;
}

/**
 * One course, one week: its classes, a tick for every tracker item, and a
 * "Make a task" button beside each — the tracker's way of turning "I haven't
 * done week 4's flashcards" into something on the task list with a due date.
 * Opened from a timetable block, a tracker row, or a course's progress bar.
 */
export function CourseWeekSheet({ target, onClose }: { target: SheetTarget | null; onClose: () => void }) {
  const { colors, shadow } = useTheme();
  const { width, height } = useWindowDimensions();
  const narrow = width < 640;
  const router = useRouter();
  const { isDone, linkedTask, toggle, makeTask } = useSemesterTracker();
  const { deleteTask } = useTasksActions();
  const { showToast } = useToast();
  const courseColors = useCourseColors();
  const { accentInk, accentWash } = useCoursesInk();

  if (!target) return null;
  const { course, week, session } = target;
  const def = courseByKey(course);
  const sw = courseColors[course];
  const sessions = sessionsFor(course, week);
  const remaining = def.items.filter(k => !isDone(course, week, k) && !linkedTask(course, week, k));

  const handleMake = (item: typeof def.items[number]) => {
    const id = makeTask(course, week, item);
    showToast(`Task added: ${def.short} week ${week} ${TRACKER_ITEMS[item].taskWord}`, {
      label: "Undo",
      onPress: () => { deleteTask(id); },
    });
  };

  const handleMakeAll = () => {
    const ids = remaining.map(k => makeTask(course, week, k));
    showToast(`${ids.length} tasks added for ${def.short} week ${week}`, {
      label: "Undo",
      onPress: () => { ids.forEach(id => deleteTask(id)); },
    });
  };

  const openTask = (id: string) => {
    onClose();
    router.push(`/(tabs)/tasks?taskId=${id}` as any);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{
        flex: 1, alignItems: "center",
        // Desktop anchors near the top rather than centring, so the dialog does
        // not jump vertically as rows gain task pills or the list changes length.
        justifyContent: narrow ? "flex-end" : "flex-start",
        padding: narrow ? 0 : spacing[6], paddingTop: narrow ? 0 : 120,
      }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close"
          style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim } as any}
        />
        <View
          style={{
            width: "100%", maxWidth: narrow ? undefined : layout.panel.modal,
            maxHeight: narrow ? height * 0.88 : height - 144,
            backgroundColor: colors.bgPrimary,
            borderRadius: narrow ? 0 : 24,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderWidth: 1, borderColor: colors.bgBorder,
            overflow: "hidden",
            ...shadow("overlay"),
          }}
        >
          {/* Course colour band */}
          <View style={{ height: 4, backgroundColor: sw.color }} />

          <ScrollView contentContainerStyle={{
            paddingHorizontal: spacing[5], paddingTop: narrow ? 18 : spacing[5],
            paddingBottom: narrow ? 34 : spacing[5], gap: spacing[4],
          }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[3] }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text size="label" weight="semibold" style={{ color: sw.color, textTransform: "uppercase" }}>
                  Week {week} · {weekRangeLabel(week)}
                </Text>
                <Text size="xl" weight="bold">{def.name}</Text>
              </View>
              <IconButton name="close-outline" onPress={onClose} accessibilityLabel="Close" style={{ marginTop: -spacing[2], marginRight: -10 }} />
            </View>

            {/* Classes this week */}
            {sessions.length > 0 ? (
              <View style={{ gap: spacing[1.5] }}>
                {sessions.map(s => {
                  const focused = session && s.day === session.day && s.start === session.start;
                  return (
                    <View
                      key={`${s.day}-${s.start}`}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: spacing[3],
                        paddingHorizontal: spacing[3], paddingVertical: spacing[2.5],
                        borderRadius: radius.lg,
                        backgroundColor: focused ? sw.subtle : colors.bgSecondary,
                        borderWidth: 1, borderColor: focused ? `${sw.color}66` : colors.bgBorder,
                      }}
                    >
                      <View style={{ width: 40, alignItems: "center" }}>
                        <Text size="label" weight="semibold" tertiary style={{ textTransform: "uppercase" }}>{DAY_NAMES[s.day]}</Text>
                        <Text size="sm" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>{formatTime(s.start)}</Text>
                      </View>
                      <View style={{ width: 1, alignSelf: "stretch", backgroundColor: colors.bgBorder }} />
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text size="sm" weight="medium">{s.kind} · until {formatTime(s.end)}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="location-outline" size={iconSize.xs} color={colors.textTertiary} />
                          <Text size="meta" tertiary numberOfLines={1} style={{ flex: 1 }}>{s.location}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text size="sm" tertiary>No classes timetabled this week.</Text>
            )}

            {/* Tracker items */}
            <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder, backgroundColor: colors.bgSecondary, overflow: "hidden" }}>
              {def.items.map((key, i) => {
                const item = TRACKER_ITEMS[key];
                const done = isDone(course, week, key);
                const task = linkedTask(course, week, key);
                return (
                  <View
                    key={key}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: spacing[3],
                      paddingLeft: spacing[3], paddingRight: spacing[2], minHeight: 52,
                      borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.bgBorder,
                    }}
                  >
                    {/* 40×44 target around a 20px tick; negative margins keep the row's rhythm. */}
                    <Pressable
                      onPress={() => toggle(course, week, key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done }}
                      aria-checked={done}
                      accessibilityLabel={`${item.label}, week ${week}`}
                      style={{ width: 40, height: 44, marginHorizontal: -10, alignItems: "center", justifyContent: "center" }}
                    >
                      <Tick done={done} color={sw.color} />
                    </Pressable>
                    <Text size="sm" weight={done ? "regular" : "medium"} style={{ flex: 1, color: done ? colors.textTertiary : colors.textPrimary }}>
                      {item.label}
                    </Text>
                    {/* Painted pills sit inside a transparent Pressable padded to a
                        40px+ target; the negative margin keeps the row height. */}
                    {task ? (
                      <Pressable
                        onPress={() => openTask(task.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open task ${task.title}`}
                        style={{ paddingVertical: 8, marginVertical: -8 }}
                      >
                        {({ hovered }: any) => (
                          <View style={{
                            flexDirection: "row", alignItems: "center", gap: 5,
                            ...shape.pill, paddingHorizontal: 10, paddingVertical: 5,
                            backgroundColor: hovered ? colors.bgTertiary : "transparent",
                            borderWidth: 1, borderColor: colors.bgBorder,
                            ...transition("background-color"),
                          } as any}>
                            {task.done
                              ? <Tick done color={colors.success} size={iconSize.xs} />
                              : <Ionicons name="checkbox-outline" size={iconSize.xs} color={colors.textSecondary} />}
                            <Text size="meta" secondary>{task.done ? "Task done" : `Task · ${dueLabel(task.due_date)}`}</Text>
                          </View>
                        )}
                      </Pressable>
                    ) : !done ? (
                      <Pressable
                        onPress={() => handleMake(key)}
                        accessibilityRole="button"
                        accessibilityLabel={`Make a task: ${def.short} week ${week} ${item.taskWord}`}
                        style={{ paddingVertical: 8, marginVertical: -8 }}
                      >
                        {({ hovered, pressed }: any) => (
                          <View style={{
                            flexDirection: "row", alignItems: "center", gap: 4,
                            ...shape.pill, paddingHorizontal: 11, paddingVertical: 6,
                            backgroundColor: accentWash,
                            opacity: pressed ? 0.7 : hovered ? 0.85 : 1,
                            ...transition("opacity"),
                          } as any}>
                            <Ionicons name="add" size={iconSize.xs} color={accentInk} />
                            <Text size="meta" weight="semibold" style={{ color: accentInk }}>Make a task</Text>
                          </View>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {remaining.length > 1 && (
              <Pressable
                onPress={handleMakeAll}
                accessibilityRole="button"
                accessibilityLabel={`Make tasks for the ${remaining.length} items left`}
                style={({ hovered }: any) => ({
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing[1.5],
                  minHeight: 44, borderRadius: radius.lg,
                  backgroundColor: hovered ? colors.bgTertiary : "transparent",
                  borderWidth: 1, borderStyle: "dashed", borderColor: colors.bgBorder,
                  ...(Platform.OS === "web" ? transition("background-color") : {}),
                } as any)}
              >
                <Ionicons name="layers-outline" size={iconSize.sm} color={colors.textSecondary} />
                <Text size="sm" weight="medium" secondary>Make tasks for the {remaining.length} left</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
