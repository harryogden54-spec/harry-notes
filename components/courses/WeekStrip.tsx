import React, { useEffect, useRef } from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, transition } from "@/lib/theme";
import { WEEKS, weekMonday, shortDate } from "@/lib/semester";
import { useCoursesInk } from "./courseColors";

/**
 * Week picker, 0–11. Each chip carries a hairline progress bar for that week,
 * so the strip doubles as an at-a-glance history of the semester. The current
 * week gets a dot; the selected one is inked. Chips share the width when it
 * fits all twelve (desktop) and fall back to a fixed 52px scroller (phone).
 */
export function WeekStrip({ selected, current, onSelect, progressOf }: {
  selected: number;
  current: number | null;
  onSelect: (week: number) => void;
  /** 0…1 completion of a week. */
  progressOf: (week: number) => number;
}) {
  const { colors } = useTheme();
  const { accentInk } = useCoursesInk();
  const scrollRef = useRef<ScrollView>(null);

  // Bring the selected week into view on a narrow screen, where the strip scrolls.
  useEffect(() => {
    const x = Math.max(0, WEEKS.indexOf(selected) * 58 - 96);
    scrollRef.current?.scrollTo({ x, animated: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, gap: spacing[1.5], paddingVertical: spacing[0.5] }}
    >
      {WEEKS.map(week => {
        const isSel = week === selected;
        const isNow = week === current;
        const p = progressOf(week);
        const past = current !== null && week < current;
        return (
          <Pressable
            key={week}
            onPress={() => onSelect(week)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSel }}
            accessibilityLabel={`Week ${week}, ${Math.round(p * 100)}% done${isNow ? ", this week" : ""}`}
            style={({ hovered }: any) => ({
              flexGrow: 1, flexBasis: 52, minWidth: 52, height: 70,
              borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: 3,
              backgroundColor: isSel ? colors.textPrimary : hovered ? colors.bgTertiary : colors.bgSecondary,
              borderWidth: 1, borderColor: isSel ? colors.textPrimary : colors.bgBorder,
              ...(Platform.OS === "web" ? transition("background-color, border-color") : {}),
            } as any)}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Text size="2xs" weight="semibold" style={{ color: isSel ? colors.bgPrimary : colors.textTertiary, letterSpacing: 0.6 }}>
                WK
              </Text>
              {isNow && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSel ? colors.bgPrimary : accentInk }} />}
            </View>
            <Text size="base" weight="bold" style={{ color: isSel ? colors.bgPrimary : past || isNow ? colors.textPrimary : colors.textSecondary, fontVariant: ["tabular-nums"], lineHeight: 18 }}>
              {week}
            </Text>
            <Text size="2xs" style={{ color: isSel ? colors.bgPrimary : colors.textTertiary, opacity: isSel ? 0.75 : 1 }}>
              {shortDate(weekMonday(week))}
            </Text>
            <View style={{ width: 30, height: 3, borderRadius: 2, marginTop: 1, backgroundColor: isSel ? `${colors.bgPrimary}40` : colors.bgTertiary, overflow: "hidden" }}>
              <View style={{ width: `${Math.round(p * 100)}%`, height: 3, borderRadius: 2, backgroundColor: isSel ? colors.bgPrimary : accentInk }} />
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
