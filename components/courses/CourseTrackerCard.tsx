import React from "react";
import { View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, iconSize, transition } from "@/lib/theme";
import { useSemesterTracker, pct } from "@/lib/useSemesterTracker";
import { TRACKER_ITEMS, WEEKS, weekMonday, shortDate, type SemesterCourse } from "@/lib/semester";
import { useCourseColors } from "./courseColors";
import { Tick } from "./Tick";

/**
 * One course's semester: a row per week (0–11), a tickbox column per tracker
 * item — the shape of the old progress tables, with the columns fixed by the
 * course. The header's bar is "done to date" (weeks up to this one), which is
 * the number that says whether you are behind; the whole-semester figure would
 * sit near zero for months and say nothing.
 */
export function CourseTrackerCard({ course, currentWeek, selectedWeek, collapsed, onToggleCollapse, onOpenWeek }: {
  course: SemesterCourse;
  currentWeek: number;
  selectedWeek: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenWeek: (week: number) => void;
}) {
  const { colors, shadow } = useTheme();
  const { isDone, linkedTask, toggle, toDateProgress } = useSemesterTracker();
  const sw = useCourseColors()[course.key];
  const toDate = toDateProgress(currentWeek, course.key);
  const p = pct(toDate);

  return (
    <View style={{
      borderRadius: 18, borderWidth: 1, borderColor: `${colors.bgBorder}88`,
      backgroundColor: colors.bgSecondary, overflow: "hidden",
      ...shadow("sm"),
    }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingLeft: spacing[3], paddingRight: spacing[4], paddingTop: spacing[1.5] }}>
        <Pressable
          onPress={onToggleCollapse}
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
          accessibilityLabel={collapsed ? `Expand ${course.name}` : `Collapse ${course.name}`}
          style={{ flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing[2.5] }}
        >
          <Ionicons
            name="chevron-forward" size={iconSize.sm} color={colors.textTertiary}
            style={{ transform: [{ rotate: collapsed ? "0deg" : "90deg" }], ...(Platform.OS === "web" ? transition("transform") : {}) } as any}
          />
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sw.color }} />
          <Text size="cardTitle" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{course.name}</Text>
        </Pressable>
        <Text size="meta" secondary>{toDate.done} / {toDate.total}</Text>
      </View>

      {/* To-date progress bar — press to open this week's sheet. Indented to
          start under the course name, past the chevron and dot. */}
      <Pressable
        onPress={() => onOpenWeek(selectedWeek)}
        accessibilityRole="button"
        accessibilityLabel={`${course.name}: ${Math.round(p * 100)}% done to date. Open week ${selectedWeek}`}
        style={({ hovered }: any) => ({
          flexDirection: "row", alignItems: "center", gap: spacing[2.5], minHeight: 36,
          paddingLeft: 36, paddingRight: spacing[4], paddingBottom: spacing[2],
          opacity: hovered ? 0.85 : 1,
        })}
      >
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: sw.subtle, overflow: "hidden" }}>
          <View style={{
            width: `${Math.round(p * 100)}%`, height: 6, borderRadius: 3, backgroundColor: sw.color,
            ...(Platform.OS === "web" ? transition("width", 400) : {}),
          } as any} />
        </View>
        <Text size="meta" weight="semibold" style={{ color: sw.color, minWidth: 34, textAlign: "right" }}>
          {Math.round(p * 100)}%
        </Text>
      </Pressable>

      {!collapsed && (
        <View style={{ borderTopWidth: 1, borderTopColor: `${colors.bgBorder}88` }}>
          {/* Column headers */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[2], paddingTop: spacing[2], paddingBottom: spacing[1] }}>
            <View style={{ width: 76, paddingLeft: spacing[2] }}>
              <Text size="label" weight="semibold" tertiary style={{ textTransform: "uppercase" }}>Week</Text>
            </View>
            {course.items.map(k => (
              <View key={k} style={{ flex: 1, alignItems: "center" }}>
                <Text size="label" weight="semibold" tertiary numberOfLines={1} style={{ textTransform: "uppercase" }}>
                  {TRACKER_ITEMS[k].short}
                </Text>
              </View>
            ))}
          </View>

          {WEEKS.map(week => {
            const isCurrent = week === currentWeek;
            const isSelected = week === selectedWeek;
            const future = week > currentWeek;
            return (
              <View
                key={week}
                style={{
                  flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[2], minHeight: 42,
                  borderTopWidth: 1, borderTopColor: `${colors.bgBorder}66`,
                  backgroundColor: isCurrent ? sw.subtle : isSelected ? colors.bgTertiary : "transparent",
                }}
              >
                <Pressable
                  onPress={() => onOpenWeek(week)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${course.short} week ${week}`}
                  style={({ hovered }: any) => ({
                    width: 76, paddingLeft: spacing[2], paddingVertical: 5, borderRadius: radius.md,
                    backgroundColor: hovered ? `${colors.textPrimary}0A` : "transparent",
                  })}
                >
                  <Text size="sm" weight={isCurrent ? "bold" : "semibold"} style={{ lineHeight: 17, color: future ? colors.textTertiary : colors.textPrimary, fontVariant: ["tabular-nums"] }}>
                    Wk {week}
                  </Text>
                  <Text size="2xs" tertiary>{shortDate(weekMonday(week))}</Text>
                </Pressable>
                {course.items.map(k => {
                  const task = linkedTask(course.key, week, k);
                  const openTask = !!task && !task.done;
                  const done = isDone(course.key, week, k);
                  return (
                    // The whole cell is the target, not just the 20px circle.
                    <Pressable
                      key={k}
                      onPress={() => toggle(course.key, week, k)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done }}
                      aria-checked={done}
                      accessibilityLabel={`${course.short} week ${week} ${TRACKER_ITEMS[k].label}${openTask ? ", task open" : ""}`}
                      style={{ flex: 1, height: 42, alignItems: "center", justifyContent: "center", opacity: future ? 0.55 : 1 }}
                    >
                      <Tick done={done} color={sw.color} idleColor={future ? colors.bgBorder : undefined} />
                      {/* An open task exists for this cell */}
                      {openTask && (
                        <View style={{ position: "absolute", bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent, pointerEvents: "none" } as any} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
