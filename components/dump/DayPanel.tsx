import React from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius, shape, iconSize } from "@/lib/theme";
import { DAY_NAMES, MONTH_NAMES, getLocalDateStr } from "@/lib/utils";
import { journalFor, type Dump } from "@/lib/DumpContext";

type Props = {
  /** null until a day is picked in the calendar. */
  date: string | null;
  /** Every capture filed under `date`. */
  dumps: Dump[];
  onClear: () => void;
};

function longDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Block C: whatever was captured on the day selected in the calendar. The
 * journal entry reads as the body; sparks and any older-format captures follow
 * it, so nothing filed under a date is unreachable from here.
 */
export function DayPanel({ date, dumps, onClear }: Props) {
  const { colors } = useTheme();

  if (!date) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: spacing[8], gap: spacing[1] }}>
        <Text size="sm" secondary style={{ textAlign: "center", lineHeight: 22 }}>
          Breathe, it&apos;s no swiss picnic for me either
        </Text>
        <Text size="sm" secondary style={{ textAlign: "center", lineHeight: 22 }}>
          You are probably doing better than you think
        </Text>
      </View>
    );
  }

  const dayDumps = dumps.filter(d => d.note_date === date);
  const journal  = journalFor(dayDumps, date);
  const sparks   = dayDumps.filter(d => d.tag === "spark");
  // Anything else filed under this date: older captures tagged media/knowledge/
  // todo, plus a second journal entry from before one-per-day was the rule.
  const others   = dayDumps.filter(d => d.tag !== "spark" && d.id !== journal?.id);
  const isToday  = date === getLocalDateStr();

  return (
    <View style={{ flex: 1, gap: spacing[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <View style={{ flex: 1 }}>
          <Text size="cardTitle" weight="semibold">{longDate(date)}</Text>
          {isToday && <Text size="meta" tertiary>Today</Text>}
        </View>
        {journal?.handwritten && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, ...shape.pill, backgroundColor: colors.bgTertiary }}>
            <Ionicons name="pencil-outline" size={iconSize.xs} color={colors.textSecondary} />
            <Text size="meta" secondary>Handwritten</Text>
          </View>
        )}
        <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Clear selected day">
          <Ionicons name="close-outline" size={iconSize.md} color={colors.textTertiary} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[2] }}>
        {journal?.content?.trim() ? (
          <Text size="sm" style={{ lineHeight: 22 }}>{journal.content}</Text>
        ) : (
          <Text size="sm" tertiary>Nothing written for this day.</Text>
        )}

        {sparks.length > 0 && (
          <View style={{ gap: spacing[2] }}>
            <Text size="label" weight="semibold" secondary style={{ textTransform: "uppercase" }}>
              Brainstem
            </Text>
            {sparks.map(s => (
              <View key={s.id} style={{ flexDirection: "row", gap: spacing[2] }}>
                <View style={{ width: 5, height: 5, borderRadius: 99, marginTop: 7, backgroundColor: colors.accent }} />
                <Text size="sm" style={{ flex: 1, lineHeight: 20 }}>{s.content}</Text>
              </View>
            ))}
          </View>
        )}

        {others.length > 0 && (
          <View style={{ gap: spacing[2] }}>
            <Text size="label" weight="semibold" secondary style={{ textTransform: "uppercase" }}>
              Also captured
            </Text>
            {others.map(o => (
              <View key={o.id} style={{
                borderRadius: radius.md, borderWidth: 1, borderColor: colors.bgBorder,
                backgroundColor: colors.bgTertiary, padding: spacing[2.5], gap: 4,
              }}>
                <Text size="meta" tertiary style={{ textTransform: "uppercase" }}>{o.tag}</Text>
                <Text size="sm" style={{ lineHeight: 20 }}>{o.content || "Empty…"}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
