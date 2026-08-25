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
import { useDumpsData, useDumpsActions, useDumpsSync, journalFor } from "@/lib/DumpContext";
import { useToast } from "@/lib/ToastContext";
import { getLocalDateStr } from "@/lib/utils";
import { MonthCalendar, buildDayMarks, SparkBox, DayPanel, JournalBox } from "@/components/dump";

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
  // the same blocks stack, reordered so the calendar is adjacent to the day
  // panel it drives.
  const twoColumn = width >= 900;

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [refreshing, setRefreshing]   = useState(false);

  const today = getLocalDateStr();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);

  const marks = useMemo(() => buildDayMarks(dumps, lastSynced), [dumps, lastSynced]);

  const todaysJournal = useMemo(() => journalFor(dumps, today), [dumps, today]);
  const todaysSparks  = useMemo(
    () => dumps
      .filter(d => d.tag === "spark" && d.note_date === today)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [dumps, today]
  );

  // Captures with no date at all — mostly pre-2026-08-25 ones, plus anything
  // arriving from the PWA share target. The calendar can't show them and the
  // day panel can't either, so they get a drawer rather than being stranded.
  const undated = useMemo(
    () => dumps.filter(d => !d.note_date).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [dumps]
  );
  const [showUndated, setShowUndated] = useState(false);

  const handleDelete = useCallback((id: string) => {
    const undo = deleteDump(id);
    showToast("Deleted", { label: "Undo", onPress: undo });
  }, [deleteDump, showToast]);

  if (!loaded) {
    return (
      <GradientBackground>
        <SideSafeArea style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text size="sm" secondary>Loading…</Text>
        </SideSafeArea>
      </GradientBackground>
    );
  }

  const blockD = (
    <Block key="d">
      <JournalBox entry={todaysJournal} date={today} />
    </Block>
  );
  const blockC = (
    <Block key="c" grow={twoColumn} style={twoColumn ? { minHeight: 260 } : { minHeight: 200 }}>
      <DayPanel date={selectedDay} dumps={dumps} onClear={() => setSelectedDay(null)} />
    </Block>
  );
  const blockB = (
    <Block key="b">
      <SparkBox sparks={todaysSparks} date={today} onDelete={handleDelete} />
    </Block>
  );
  const blockA = (
    <Block key="a" grow={twoColumn}>
      <MonthCalendar marks={marks} selected={selectedDay} onSelect={setSelectedDay} />
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
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5] }}>
            <Text size="2xl" weight="bold">Dump</Text>
          </View>

          {twoColumn ? (
            <View style={{ flexDirection: "row", gap: spacing[4], alignItems: "stretch" }}>
              <View style={{ flex: 1, gap: spacing[4] }}>
                {blockD}
                {blockC}
              </View>
              <View style={{ flex: 1, gap: spacing[4] }}>
                {blockB}
                {blockA}
              </View>
            </View>
          ) : (
            // Calendar before the day panel here: on one column the panel is
            // meaningless until a day above it has been tapped.
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
