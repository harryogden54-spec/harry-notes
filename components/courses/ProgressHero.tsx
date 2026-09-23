import React from "react";
import { View, Pressable, Platform } from "react-native";
import { Text } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, transition } from "@/lib/theme";
import { useSemesterTracker, pct } from "@/lib/useSemesterTracker";
import { SEMESTER_COURSES, FIRST_WEEK, type CourseKey } from "@/lib/semester";
import { useCourseColors } from "./courseColors";
import { ActivityRings, MiniRing } from "./ActivityRings";

/**
 * The top of the Courses screen: two concentric rings — the selected week
 * (outer, accent) and everything from week 0 up to it (inner, amber) — with a
 * per-course ring for the week beside them. A course's ring opens that course's
 * week sheet, which is where "Make a task" lives.
 */
export function ProgressHero({ week, onOpenCourse }: { week: number; onOpenCourse: (course: CourseKey) => void }) {
  const { colors, shadow } = useTheme();
  const { weekProgress, toDateProgress } = useSemesterTracker();
  const courseColors = useCourseColors();

  const wk = weekProgress(week);
  const toDate = toDateProgress(week);
  // Two hues that stay apart under every theme + accent: ink was tried for
  // "to date" and vanished beside Navy, whose light-scheme value is near-black.
  // Amber is used by no accent and no course, so it can never collide.
  const weekColor = colors.accent;
  const toDateColor = colors.warning;

  const legend = (label: string, sub: string, value: number, done: number, total: number, color: string) => (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[2.5] }}>
      <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: color, marginVertical: 3 }} />
      <View style={{ gap: 0 }}>
        <Text size="label" weight="semibold" tertiary style={{ textTransform: "uppercase" }}>{label}</Text>
        <Text size="2xl" weight="bold" style={{ fontVariant: ["tabular-nums"] }}>{Math.round(value * 100)}%</Text>
        <Text size="meta" tertiary>{done} of {total} · {sub}</Text>
      </View>
    </View>
  );

  return (
    <View style={{
      borderRadius: 20, borderWidth: 1, borderColor: `${colors.bgBorder}88`,
      backgroundColor: colors.bgSecondary, padding: spacing[4], gap: spacing[4],
      ...shadow("sm"),
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[5] }}>
        <ActivityRings
          size={128}
          rings={[
            { value: pct(wk), color: weekColor, label: `Week ${week}` },
            { value: pct(toDate), color: toDateColor, label: "To date" },
          ]}
        />
        <View style={{ flex: 1, gap: spacing[3] }}>
          {legend(`Week ${week}`, "ticked", pct(wk), wk.done, wk.total, weekColor)}
          {legend("To date", week === FIRST_WEEK ? "week 0" : `weeks 0–${week}`, pct(toDate), toDate.done, toDate.total, toDateColor)}
        </View>
      </View>

      {/* Per course, this week */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        {SEMESTER_COURSES.map(c => {
          const p = weekProgress(week, c.key);
          const sw = courseColors[c.key];
          return (
            <Pressable
              key={c.key}
              onPress={() => onOpenCourse(c.key)}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, week ${week}: ${p.done} of ${p.total}. Open`}
              style={({ hovered, pressed }: any) => ({
                flexGrow: 1, flexBasis: "46%",
                flexDirection: "row", alignItems: "center", gap: spacing[2.5],
                paddingHorizontal: spacing[2.5], paddingVertical: spacing[2],
                borderRadius: radius.lg,
                backgroundColor: hovered ? colors.bgTertiary : `${colors.bgTertiary}88`,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...(Platform.OS === "web" ? transition("background-color, transform") : {}),
              } as any)}
            >
              <MiniRing value={pct(p)} color={sw.color} size={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" weight="semibold" numberOfLines={1}>{c.short}</Text>
                <Text size="meta" tertiary>{p.done}/{p.total} this week</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
