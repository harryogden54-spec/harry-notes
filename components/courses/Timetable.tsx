import React, { useEffect, useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, iconSize, transition } from "@/lib/theme";
import { getLocalDateStr } from "@/lib/utils";
import {
  GRID_START_HOUR, GRID_END_HOUR, courseByKey, formatTime, minutesOf,
  sessionDate, sessionsForWeek, type Session,
} from "@/lib/semester";
import { useCourseColors } from "./courseColors";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const AXIS_W = 30;

/**
 * Mon–Fri grid for one semester week. Every class is a block you can press —
 * that opens the course's week (ticks + "Make a task"). A class whose tracker
 * row is complete is drawn with a check, so the grid also answers "have I
 * caught up on this?".
 */
export function Timetable({ week, compact, onPressSession, isCourseWeekDone }: {
  week: number;
  /** Phone width: short names, no locations — a column is ~60px there. */
  compact: boolean;
  onPressSession: (session: Session) => void;
  isCourseWeekDone: (session: Session) => boolean;
}) {
  const { colors } = useTheme();
  const courseColors = useCourseColors();
  const hourH = compact ? 40 : 48;
  const pxPerMin = hourH / 60;
  const hours = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i);
  const gridH = (GRID_END_HOUR - GRID_START_HOUR) * hourH;
  const sessions = sessionsForWeek(week);

  // Re-render each minute so the now-line moves and a finished class greys out.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const todayStr = getLocalDateStr(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMin - GRID_START_HOUR * 60) * pxPerMin;

  return (
    <View>
      {/* Day headers */}
      <View style={{ flexDirection: "row", paddingLeft: AXIS_W, marginBottom: spacing[1.5] }}>
        {DAYS.map((d, i) => {
          const date = sessionDate(week, i + 1);
          const isToday = date === todayStr;
          return (
            <View key={d} style={{ flex: 1, alignItems: "center" }}>
              <View style={{
                flexDirection: compact ? "column" : "row", alignItems: "center", gap: compact ? 0 : 5,
                paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: 99,
                backgroundColor: isToday ? colors.accent : "transparent",
              }}>
                <Text size="2xs" weight="semibold" style={{ letterSpacing: 0.6, textTransform: "uppercase", color: isToday ? colors.textInverse : colors.textTertiary }}>
                  {d}
                </Text>
                <Text size="xs" weight="semibold" style={{ color: isToday ? colors.textInverse : colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                  {Number(date.slice(8))}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", height: gridH + 8, paddingTop: 4 }}>
        {/* Hour axis */}
        <View style={{ width: AXIS_W }}>
          {hours.map(h => (
            <Text
              key={h} size="2xs" tertiary
              style={{ position: "absolute", top: (h - GRID_START_HOUR) * hourH - 7, right: 6, fontVariant: ["tabular-nums"] }}
            >
              {h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}
            </Text>
          ))}
        </View>

        {/* Columns */}
        <View style={{ flex: 1, flexDirection: "row" }}>
          {/* Hour rules, drawn once across all columns */}
          {hours.map(h => (
            <View
              key={h}
              style={{
                position: "absolute", left: 0, right: 0, top: (h - GRID_START_HOUR) * hourH,
                height: 1, backgroundColor: colors.bgBorder, opacity: 0.6, pointerEvents: "none",
              }}
            />
          ))}

          {DAYS.map((d, i) => {
            const day = i + 1;
            const date = sessionDate(week, day);
            const isToday = date === todayStr;
            return (
              <View
                key={d}
                style={{
                  flex: 1, height: gridH, marginHorizontal: 1.5,
                  borderRadius: radius.sm,
                  backgroundColor: isToday ? `${colors.accent}0D` : "transparent",
                }}
              >
                {sessions.filter(s => s.day === day).map(s => {
                  const course = courseByKey(s.course);
                  const sw = courseColors[s.course];
                  const top = (minutesOf(s.start) - GRID_START_HOUR * 60) * pxPerMin;
                  const h = (minutesOf(s.end) - minutesOf(s.start)) * pxPerMin;
                  const past = date < todayStr || (isToday && minutesOf(s.end) <= nowMin);
                  const done = isCourseWeekDone(s);
                  const short = h < 44;
                  return (
                    <Pressable
                      key={`${s.course}-${s.start}`}
                      onPress={() => onPressSession(s)}
                      accessibilityRole="button"
                      accessibilityLabel={`${course.name} ${s.kind}, ${DAYS[i]} ${formatTime(s.start)} to ${formatTime(s.end)}, ${s.location}`}
                      style={({ hovered, pressed }: any) => ({
                        position: "absolute", top: top + 1, left: 0, right: 0, height: h - 2,
                        borderRadius: radius.md,
                        backgroundColor: sw.subtle,
                        borderLeftWidth: 3, borderLeftColor: sw.color,
                        paddingHorizontal: compact ? 4 : spacing[2], paddingVertical: short ? 2 : spacing[1],
                        overflow: "hidden",
                        opacity: past && !hovered ? 0.6 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                        ...(hovered ? { boxShadow: `0 0 0 1px ${sw.color}` } : {}),
                        ...(Platform.OS === "web" ? transition("opacity, transform, box-shadow") : {}),
                      } as any)}
                    >
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 3 }}>
                        <Text
                          size={compact ? "2xs" : "xs"} weight="semibold" numberOfLines={short || compact ? 1 : 2}
                          style={{ flex: 1, color: sw.color, lineHeight: compact ? 12 : 15 }}
                        >
                          {compact ? course.abbr : course.name}
                        </Text>
                        {done && <Ionicons name="checkmark-circle" size={compact ? 10 : iconSize.xs} color={sw.color} />}
                      </View>
                      {!short && (
                        <Text size="2xs" numberOfLines={1} style={{ color: colors.textSecondary, marginTop: 1 }}>
                          {compact ? `${formatTime(s.start)}` : `${s.kind} · ${formatTime(s.start)}–${formatTime(s.end)}`}
                        </Text>
                      )}
                      {!compact && h >= 80 && (
                        <Text size="2xs" numberOfLines={2} tertiary style={{ marginTop: 1 }}>{s.location}</Text>
                      )}
                      {compact && h >= 70 && (
                        <Text size="2xs" numberOfLines={1} tertiary>{s.kind === "Seminar" ? "Sem" : "Lec"}</Text>
                      )}
                    </Pressable>
                  );
                })}

                {/* Now line */}
                {isToday && nowTop >= 0 && nowTop <= gridH && (
                  <View style={{ position: "absolute", left: -2, right: 0, top: nowTop - 1, height: 2, backgroundColor: colors.danger, borderRadius: 1, pointerEvents: "none" }}>
                    <View style={{ position: "absolute", left: -3, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger }} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
