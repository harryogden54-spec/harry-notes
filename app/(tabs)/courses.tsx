import React, { useState, useCallback, useEffect, useMemo } from "react";
import { View, Pressable, ScrollView, RefreshControl, useWindowDimensions } from "react-native";
// Side-notch padding only — PersistentHeader owns the top inset, MobileTabBar the bottom.
import { SideSafeArea } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useTheme } from "@/lib/useTheme";
import { Text, GradientBackground, Skeleton } from "@/components/ui";
import { spacing, radius, iconSize, transition } from "@/lib/theme";
import { useScrollBottomPadding } from "@/lib/TabBarHeightContext";
import { storage } from "@/lib/storage";
import { webWideContentStyle } from "@/lib/webLayout";
import { useCoursesData, useCoursesSync } from "@/lib/CoursesContext";
import { useSemesterTracker, pct } from "@/lib/useSemesterTracker";
import {
  SEMESTER_COURSES, LAST_WEEK, defaultWeek, weekOf, weekRangeLabel, isTeachingWeek,
  type CourseKey, type Session,
} from "@/lib/semester";
import {
  ProgressHero, WeekStrip, Timetable, CourseTrackerCard, CourseWeekSheet, OtherTables,
  type SheetTarget,
} from "@/components/courses";

const TRACKER_COLLAPSED_KEY = "courses_tracker_collapsed";

function CoursesScreen() {
  const { colors, shadow } = useTheme();
  const scrollBottom = useScrollBottomPadding();
  const { loaded } = useCoursesData();
  const { syncNow } = useCoursesSync();
  const { isDone, weekProgress } = useSemesterTracker();
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  const narrow = width < 640;

  const currentWeek = weekOf();
  const [week, setWeek] = useState(() => defaultWeek());
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Tracker cards: condensed state is a local view preference. With nothing
  // stored, phones start condensed — four 12-row tables is a long scroll.
  const [collapsed, setCollapsed] = useState<CourseKey[] | null>(null);
  useEffect(() => {
    storage.get<CourseKey[]>(TRACKER_COLLAPSED_KEY).then(v => {
      setCollapsed(Array.isArray(v) ? v : width < 768 ? SEMESTER_COURSES.map(c => c.key) : []);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleCollapsed = useCallback((key: CourseKey) => {
    setCollapsed(prev => {
      const cur = prev ?? [];
      const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
      storage.set(TRACKER_COLLAPSED_KEY, next);
      return next;
    });
  }, []);
  const allCollapsed = (collapsed ?? []).length === SEMESTER_COURSES.length;
  const toggleAll = useCallback(() => {
    const next = allCollapsed ? [] : SEMESTER_COURSES.map(c => c.key);
    setCollapsed(next);
    storage.set(TRACKER_COLLAPSED_KEY, next);
  }, [allCollapsed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);

  const onPressSession = useCallback((s: Session) => setSheet({ course: s.course, week, session: s }), [week]);
  const lectureDone = useCallback((s: Session) => isDone(s.course, week, "lecture"), [isDone, week]);
  const weekPct = useCallback((w: number) => pct(weekProgress(w)), [weekProgress]);

  const trackerWeek = currentWeek ?? defaultWeek();

  const subtitle = useMemo(() => {
    if (currentWeek === null) return `Semester 1 · weeks 0–${LAST_WEEK}`;
    return `Semester 1 · week ${currentWeek} of ${LAST_WEEK} · ${weekRangeLabel(currentWeek)}`;
  }, [currentWeek]);

  if (!loaded) {
    return (
      <GradientBackground>
        <SideSafeArea style={{ flex: 1 }}>
          <View style={{ padding: spacing[4], gap: spacing[3] }}>
            <Skeleton height={72} borderRadius={18} />
            <Skeleton height={220} borderRadius={20} />
            <Skeleton height={320} borderRadius={20} />
          </View>
        </SideSafeArea>
      </GradientBackground>
    );
  }

  const hero = <ProgressHero week={week} onOpenCourse={course => setSheet({ course, week })} />;

  const timetable = (
    <View style={{
      borderRadius: 20, borderWidth: 1, borderColor: `${colors.bgBorder}88`,
      backgroundColor: colors.bgSecondary, padding: narrow ? spacing[3] : spacing[4],
      ...shadow("sm"),
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[3], gap: spacing[2] }}>
        <View style={{ flex: 1 }}>
          <Text size="label" weight="semibold" tertiary style={{ textTransform: "uppercase" }}>Timetable</Text>
          <Text size="cardTitle" weight="semibold">Week {week} · {weekRangeLabel(week)}</Text>
        </View>
        {currentWeek !== null && week !== currentWeek && (
          <Pressable
            onPress={() => setWeek(currentWeek)}
            accessibilityRole="button"
            style={({ hovered }: any) => ({
              paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: 99,
              borderWidth: 1, borderColor: colors.bgBorder,
              backgroundColor: hovered ? colors.bgTertiary : "transparent",
              ...transition("background-color"),
            } as any)}
          >
            <Text size="xs" weight="medium" secondary>This week</Text>
          </Pressable>
        )}
      </View>
      {isTeachingWeek(week) ? (
        <Timetable week={week} compact={narrow} onPressSession={onPressSession} isCourseWeekDone={lectureDone} />
      ) : (
        <View style={{ paddingVertical: spacing[8], alignItems: "center", gap: spacing[2] }}>
          <Ionicons name="sunny-outline" size={iconSize.lg} color={colors.textTertiary} />
          <Text size="sm" secondary>Welcome week — no classes timetabled.</Text>
          <Text size="meta" tertiary>The tracker still counts it; tap a course above to tick or make tasks.</Text>
        </View>
      )}
    </View>
  );

  return (
    <GradientBackground>
      <SideSafeArea style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: scrollBottom, ...webWideContentStyle }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
          }
        >
          {/* Header */}
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[4] }}>
            <Text size="title" weight="bold">Courses</Text>
            <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>{subtitle}</Text>
          </View>

          <View style={{ marginBottom: spacing[4], marginHorizontal: -spacing[4], paddingHorizontal: spacing[4] }}>
            <WeekStrip selected={week} current={currentWeek} onSelect={setWeek} progressOf={weekPct} />
          </View>

          {wide ? (
            <View style={{ flexDirection: "row", gap: spacing[4], alignItems: "flex-start", marginBottom: spacing[6] }}>
              <View style={{ width: 380 }}>{hero}</View>
              <View style={{ flex: 1 }}>{timetable}</View>
            </View>
          ) : (
            <View style={{ gap: spacing[4], marginBottom: spacing[6] }}>
              {hero}
              {timetable}
            </View>
          )}

          {/* Tracker */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[3] }}>
            <Text size="label" weight="semibold" tertiary style={{ flex: 1, textTransform: "uppercase" }}>Tracker</Text>
            <Pressable
              onPress={toggleAll}
              accessibilityRole="button"
              style={({ hovered }: any) => ({
                flexDirection: "row", alignItems: "center", gap: spacing[1],
                paddingHorizontal: spacing[2], paddingVertical: spacing[2], margin: -spacing[2], borderRadius: radius.md,
                backgroundColor: hovered ? colors.bgTertiary : "transparent",
              })}
            >
              <Ionicons name={allCollapsed ? "chevron-down" : "chevron-up"} size={iconSize.xs} color={colors.textTertiary} />
              <Text size="xs" tertiary>{allCollapsed ? "Expand all" : "Condense all"}</Text>
            </Pressable>
          </View>
          {/* Wrap only on the wide row layout — a wrapping column shrinks its
              children to their content width instead of stretching them. */}
          <View style={{ flexDirection: wide ? "row" : "column", flexWrap: wide ? "wrap" : "nowrap", gap: spacing[3], marginBottom: spacing[8] }}>
            {SEMESTER_COURSES.map(c => (
              <View key={c.key} style={wide ? { width: "49%", flexGrow: 1, flexBasis: "45%" } as any : undefined}>
                <CourseTrackerCard
                  course={c}
                  currentWeek={trackerWeek}
                  selectedWeek={week}
                  collapsed={(collapsed ?? []).includes(c.key)}
                  onToggleCollapse={() => toggleCollapsed(c.key)}
                  onOpenWeek={w => setSheet({ course: c.key, week: w })}
                />
              </View>
            ))}
          </View>

          <OtherTables />
        </ScrollView>

        <CourseWeekSheet target={sheet} onClose={() => setSheet(null)} />
      </SideSafeArea>
    </GradientBackground>
  );
}

export default function CoursesScreenBounded() {
  return <ErrorBoundary><CoursesScreen /></ErrorBoundary>;
}
