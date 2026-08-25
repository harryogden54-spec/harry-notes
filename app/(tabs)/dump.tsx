import React, { useState, useCallback, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, ScrollView, Pressable, RefreshControl, useWindowDimensions,
} from "react-native";
// Side-notch padding only — PersistentHeader owns the top inset, MobileTabBar the bottom.
import { SideSafeArea } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { Text, GradientBackground, Surface } from "@/components/ui";
import { spacing, radius, iconSize } from "@/lib/theme";
import { useScrollBottomPadding } from "@/lib/TabBarHeightContext";
import { useDumpsData, useDumpsActions, useDumpsSync, journalFor, isFiled } from "@/lib/DumpContext";
import { useToast } from "@/lib/ToastContext";
import { getLocalDateStr, DAY_NAMES, MONTH_NAMES } from "@/lib/utils";
import { MonthCalendar, buildDayMarks, SparkBox, BrowseBox, AddDumpBox } from "@/components/dump";

/** One of the four blocks. A plain frame so the blocks read as one grid. */
function Block({ children, style, grow }: {
  children: React.ReactNode;
  style?: any;
  /** Fill the remaining height of its column (desktop two-column layout). */
  grow?: boolean;
}) {
  return (
    <Surface
      variant="elevated"
      style={[{ padding: spacing[4], borderRadius: radius.xl }, grow ? { flex: 1 } : null, style]}
    >
      {children}
    </Surface>
  );
}

function DumpScreen() {
  const { colors } = useTheme();
  const { dumps, loaded } = useDumpsData();
  const { deleteDump } = useDumpsActions();
  const { syncNow, lastSynced } = useDumpsSync();
  const { showToast } = useToast();
  const scrollBottom = useScrollBottomPadding();
  const { width } = useWindowDimensions();

  // Two columns once there is room for both to hold real content; below that
  // the same blocks stack, reordered so the calendar is adjacent to the
  // Browse box it drives.
  const twoColumn = width >= 900;

  const today = getLocalDateStr();

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [composeDate, setComposeDate] = useState<string>(today);
  const [refreshing, setRefreshing]   = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);

  const marks = useMemo(() => buildDayMarks(dumps, lastSynced), [dumps, lastSynced]);

  const composeFiled = useMemo(() => journalFor(dumps, composeDate), [dumps, composeDate]);
  const composeDraft = useMemo(
    () => dumps.find(d => d.tag === "journal" && d.note_date === composeDate && !isFiled(d)),
    [dumps, composeDate]
  );

  const todaysSparks = useMemo(
    () => dumps
      .filter(d => d.tag === "spark" && d.note_date === today)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [dumps, today]
  );

  const daysThisMonth = useMemo(() => {
    const prefix = today.slice(0, 7);
    const days = new Set<string>();
    for (const d of dumps) {
      if (d.note_date?.startsWith(prefix) && isFiled(d)) days.add(d.note_date);
    }
    return days.size;
  }, [dumps, today]);

  // Captures with no date at all — mostly pre-2026-08-25 ones, plus anything
  // arriving from the PWA share target. Browse's date ranges deliberately
  // exclude them, so they keep a drawer rather than being stranded.
  const undated = useMemo(
    () => dumps.filter(d => !d.note_date && isFiled(d)).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [dumps]
  );
  const [showUndated, setShowUndated] = useState(false);

  const handleDelete = useCallback((id: string) => {
    const undo = deleteDump(id);
    showToast("Deleted", { label: "Undo", onPress: undo });
  }, [deleteDump, showToast]);

  const readDay = useCallback((date: string) => setSelectedDay(date), []);

  const pickDay = useCallback((date: string) => {
    setSelectedDay(date);
    // Picking a day is also how you say "I want to write about that day".
    setComposeDate(date);
  }, []);

  if (!loaded) {
    return (
      <GradientBackground>
        <SideSafeArea style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text size="sm" secondary>Loading…</Text>
        </SideSafeArea>
      </GradientBackground>
    );
  }

  const todayDate = new Date();
  const subtitle = `${DAY_NAMES[todayDate.getDay()]} ${todayDate.getDate()} ${MONTH_NAMES[todayDate.getMonth()]}`
    + (daysThisMonth > 0 ? ` · ${daysThisMonth} day${daysThisMonth === 1 ? "" : "s"} written this month` : "");

  // zIndex: the compose box and Browse both hold a Select whose panel must
  // paint over the block below it.
  const blockD = (
    <Block key="d" style={{ zIndex: 3 }}>
      <AddDumpBox
        date={composeDate}
        onDateChange={setComposeDate}
        filed={composeFiled}
        draft={composeDraft}
        onReadDay={readDay}
      />
    </Block>
  );
  const blockC = (
    <Block key="c" grow={twoColumn} style={twoColumn ? { minHeight: 300, zIndex: 2 } : { minHeight: 280, zIndex: 2 }}>
      <BrowseBox dumps={dumps} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
    </Block>
  );
  const blockB = (
    <Block key="b" style={{ zIndex: 1 }}>
      <SparkBox sparks={todaysSparks} date={today} onDelete={handleDelete} />
    </Block>
  );
  const blockA = (
    <Block key="a" grow={twoColumn}>
      <MonthCalendar marks={marks} selected={selectedDay} onSelect={pickDay} />
    </Block>
  );

  return (
    <GradientBackground>
      <SideSafeArea style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: scrollBottom }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
          }
        >
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5], gap: 2 }}>
            <Text size="2xl" weight="bold">Dump</Text>
            <Text size="meta" tertiary>{subtitle}</Text>
          </View>

          {twoColumn ? (
            <View style={{ flexDirection: "row", gap: spacing[4], alignItems: "stretch" }}>
              <View style={{ flex: 1.06, gap: spacing[4] }}>
                {blockD}
                {blockC}
              </View>
              <View style={{ flex: 1, gap: spacing[4] }}>
                {blockB}
                {blockA}
              </View>
            </View>
          ) : (
            // Calendar before Browse here: on one column the Browse box is
            // most useful directly under the day grid that drives it.
            <View style={{ gap: spacing[4] }}>
              {blockD}
              {blockB}
              {blockA}
              {blockC}
            </View>
          )}

          {undated.length > 0 && (
            <View style={{ marginTop: spacing[5], gap: spacing[3] }}>
              <Pressable
                onPress={() => setShowUndated(v => !v)}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], alignSelf: "flex-start" }}
              >
                <Ionicons
                  name={showUndated ? "chevron-down" : "chevron-forward"}
                  size={iconSize.xs}
                  color={colors.textTertiary}
                />
                <Text size="label" weight="semibold" secondary style={{ textTransform: "uppercase" }}>
                  Undated captures · {undated.length}
                </Text>
              </Pressable>

              {showUndated && (
                <View style={{ gap: spacing[2] }}>
                  {undated.map(d => (
                    <Surface key={d.id} style={{ padding: spacing[3], gap: spacing[1], borderRadius: radius.lg }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                        <Text size="meta" tertiary style={{ textTransform: "uppercase", flex: 1 }}>{d.tag}</Text>
                        {d.filed && <Ionicons name="checkmark-circle" size={iconSize.xs} color={colors.accent} />}
                        <Pressable onPress={() => handleDelete(d.id)} hitSlop={8} accessibilityLabel="Delete capture">
                          <Ionicons name="close-outline" size={iconSize.sm} color={colors.textTertiary} />
                        </Pressable>
                      </View>
                      <Text size="sm" style={{ lineHeight: 20, color: d.content ? colors.textPrimary : colors.textTertiary }}>
                        {d.content || "Empty…"}
                      </Text>
                    </Surface>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SideSafeArea>
    </GradientBackground>
  );
}

export default function DumpScreenBounded() {
  return <ErrorBoundary><DumpScreen /></ErrorBoundary>;
}
