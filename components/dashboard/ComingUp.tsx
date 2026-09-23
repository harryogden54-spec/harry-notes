import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, iconSize, transition } from "@/lib/theme";
import { getLocalDateStr, getTomorrowStr } from "@/lib/utils";
import { courseByKey, formatTime, upcomingSessions } from "@/lib/semester";
import { useCourseColors } from "@/components/courses/courseColors";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The next few classes, under the dashboard's Today list — a slice of the
 * Courses timetable so "where do I need to be" is answered without leaving
 * Home. A class in progress stays listed (with "Now") until it ends.
 */
export function ComingUp({ limit = 3 }: { limit?: number }) {
  const { colors } = useTheme();
  const router = useRouter();
  const courseColors = useCourseColors();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const items = upcomingSessions(now, limit);
  if (items.length === 0) return null;

  const today = getLocalDateStr(now);
  const tomorrow = getTomorrowStr();

  return (
    <View style={{ gap: spacing[1.5] }}>
      {items.map(o => {
        const course = courseByKey(o.course);
        const sw = courseColors[o.course];
        const live = o.startsAt <= now;
        const when = live ? "Now"
          : o.date === today ? "Today"
          : o.date === tomorrow ? "Tomorrow"
          : WEEKDAY[o.startsAt.getDay()];
        return (
          <Pressable
            key={`${o.date}-${o.start}-${o.course}`}
            onPress={() => router.push("/(tabs)/courses" as any)}
            accessibilityRole="button"
            accessibilityLabel={`${when} ${formatTime(o.start)}, ${course.name} ${o.kind}, ${o.location}`}
            style={({ hovered }: any) => ({
              flexDirection: "row", alignItems: "center", gap: spacing[3],
              paddingVertical: spacing[2], paddingHorizontal: spacing[2], marginHorizontal: -spacing[2],
              borderRadius: radius.lg,
              backgroundColor: hovered ? colors.bgTertiary : "transparent",
              ...transition("background-color"),
            } as any)}
          >
            <View style={{ width: 86 }}>
              <Text size="label" weight="semibold" style={{ textTransform: "uppercase", color: live ? colors.danger : colors.textTertiary }}>
                {when}
              </Text>
              <Text size="sm" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>{formatTime(o.start)}</Text>
            </View>
            <View style={{ width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: sw.color }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" weight="medium" numberOfLines={1}>{course.name} · {o.kind}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="location-outline" size={iconSize.xs} color={colors.textTertiary} />
                <Text size="meta" tertiary numberOfLines={1} style={{ flex: 1 }}>{o.location}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
