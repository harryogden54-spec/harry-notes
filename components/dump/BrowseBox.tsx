import React, { useMemo, useState } from "react";
import { View, Pressable, ScrollView, TextInput as RNTextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Select } from "@/components/ui";
import { spacing, radius, shape, fontFamily, iconSize } from "@/lib/theme";
import { DAY_NAMES, MONTH_NAMES, getLocalDateStr } from "@/lib/utils";
import { isFiled, journalFor, type Dump, type DumpTag } from "@/lib/DumpContext";
import { GoalsBox } from "./GoalsBox";

/** Display names for the stored tags — `spark` is "Brainstem" to the user. */
const TAG_LABEL: Record<DumpTag, string> = {
  journal:   "Journal",
  spark:     "Brainstem",
  media:     "Media",
  knowledge: "Knowledge",
  todo:      "To-do",
  goal:      "Goals",
};
const TAG_ORDER: DumpTag[] = ["journal", "spark", "media", "knowledge", "todo", "goal"];

/** Label for a tag, falling back to the raw value. normalizeDump deliberately
 *  preserves tags it does not know, so this lookup can miss. */
function tagLabel(tag: DumpTag): string {
  return TAG_LABEL[tag] ?? String(tag);
}

type Range = "any" | "7d" | "month" | "year";
const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "any",   label: "Any time" },
  { value: "7d",    label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "year",  label: "This year" },
];

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return getLocalDateStr(d);
}

/** Earliest date a range admits, or null for "any". */
function rangeFloor(range: Range, today: string): string | null {
  if (range === "any")   return null;
  if (range === "7d")    return shiftDate(today, -6);
  if (range === "month") return `${today.slice(0, 7)}-01`;
  return `${today.slice(0, 4)}-01-01`;
}

function longDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function shortDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  return `${DAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

type Props = {
  dumps: Dump[];
  /** Day picked on the calendar — the date filter and the day view share it. */
  selectedDay: string | null;
  onSelectDay: (date: string | null) => void;
};

/**
 * Block C: one box that both searches every capture and shows a single day.
 *
 * They are the same question asked with different filters, so they are the
 * same control: tapping a day on the calendar just sets the date filter. That
 * is what finally gives the calendar somewhere to point — before this it
 * drove a panel that could only ever show one day and sat empty otherwise.
 */
export function BrowseBox({ dumps, selectedDay, onSelectDay }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [tags, setTags]   = useState<DumpTag[]>([]);
  const [range, setRange] = useState<Range>("any");

  const today = getLocalDateStr();
  const q = query.trim().toLowerCase();

  function toggleTag(tag: DumpTag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  const results = useMemo(() => {
    const floor = rangeFloor(range, today);
    return dumps
      .filter(isFiled)
      .filter(d => (tags.length === 0 || tags.includes(d.tag)))
      .filter(d => !selectedDay || (d.note_date === selectedDay && d.tag !== "goal"))
      .filter(d => {
        if (!floor) return true;
        // An undated capture has no day to compare, so a bounded range
        // excludes it rather than silently treating it as recent.
        return !!d.note_date && d.note_date >= floor;
      })
      .filter(d => !q || d.content.toLowerCase().includes(q))
      .sort((a, b) => (b.note_date ?? "").localeCompare(a.note_date ?? "")
        || b.created_at.localeCompare(a.created_at));
  }, [dumps, tags, range, selectedDay, q, today]);

  const filtering = !!q || tags.length > 0 || range !== "any" || !!selectedDay;
  // A chosen day reads better as the day itself than as a list of cards.
  const dayView = !!selectedDay && !q;

  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={{
        ...shape.pill,
        paddingVertical: spacing[1],
        backgroundColor: active ? colors.accent : colors.bgTertiary,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.bgBorder,
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text size="meta" weight={active ? "semibold" : "medium"}
        style={{ color: active ? colors.textInverse : colors.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, gap: spacing[3] }}>
      {/* Header + search */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2.5] }}>
        <Text size="cardTitle" weight="semibold">Browse</Text>
        <View style={{
          flex: 1, flexDirection: "row", alignItems: "center", gap: spacing[2],
          backgroundColor: colors.bgTertiary,
          borderRadius: radius.lg,
          borderWidth: 1, borderColor: q ? colors.accent : colors.bgBorder,
          paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
        }}>
          <Ionicons name="search" size={iconSize.sm} color={colors.textTertiary} />
          <RNTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search every dump…"
            placeholderTextColor={colors.textTertiary}
            style={[
              { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular, color: colors.textPrimary, paddingVertical: 2 },
              { outlineStyle: "none" } as any,
            ]}
          />
          {!!q && (
            <Pressable style={{ margin: -8, padding: 8 } as any} onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-outline" size={iconSize.sm} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category + date filters */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], flexWrap: "wrap", zIndex: 10 }}>
        <Chip label="All" active={tags.length === 0} onPress={() => setTags([])} />
        {TAG_ORDER.map(t => (
          <Chip key={t} label={TAG_LABEL[t]} active={tags.includes(t)} onPress={() => toggleTag(t)} />
        ))}
        <View style={{ flex: 1, minWidth: spacing[2] }} />
        {selectedDay ? (
          <Pressable
            onPress={() => onSelectDay(null)}
            style={{
              flexDirection: "row", alignItems: "center", gap: spacing[1.5],
              ...shape.pill, paddingVertical: spacing[1],
              backgroundColor: `${colors.accent}18`,
              borderWidth: 1, borderColor: colors.accent,
            }}
            accessibilityLabel="Clear selected day"
          >
            <Text size="meta" weight="semibold" style={{ color: colors.accent }}>{shortDate(selectedDay)}</Text>
            <Ionicons name="close-outline" size={iconSize.xs} color={colors.accent} />
          </Pressable>
        ) : (
          <Select
            value={range}
            options={RANGE_OPTIONS}
            onChange={setRange}
            placeholder="Any time"
            width={124}
            panelMinWidth={140}
          />
        )}
      </View>

      <View style={{ height: 1, backgroundColor: colors.bgBorder }} />

      {!filtering ? (
        <GoalsBox dumps={dumps} />
      ) : dayView ? (
        <DayView dumps={results} date={selectedDay!} />
      ) : (
        <ResultList results={results} query={q} />
      )}
    </View>
  );
}

/** A single day, read as a day rather than as a list of matches. */
function DayView({ dumps, date }: { dumps: Dump[]; date: string }) {
  const { colors } = useTheme();
  const journal = journalFor(dumps, date);
  const sparks  = dumps.filter(d => d.tag === "spark");
  const others  = dumps.filter(d => d.tag !== "spark" && d.id !== journal?.id);
  const isToday = date === getLocalDateStr();

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <Text size="cardTitle" weight="semibold" style={{ flex: 1 }}>
          {isToday ? "Today" : longDate(date)}
        </Text>
        {journal?.handwritten && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, ...shape.pill, backgroundColor: colors.bgTertiary }}>
            <Ionicons name="pencil-outline" size={iconSize.xs} color={colors.textSecondary} />
            <Text size="meta" secondary>Handwritten</Text>
          </View>
        )}
        {!!journal?.content?.trim() && (
          <Text size="meta" tertiary>{wordCount(journal.content)} words</Text>
        )}
      </View>

      {journal?.content?.trim() ? (
        <Text size="sm" style={{ lineHeight: 22 }}>{journal.content}</Text>
      ) : (
        <Text size="sm" tertiary>Nothing written for this day.</Text>
      )}

      {sparks.length > 0 && (
        <View style={{ gap: spacing[2] }}>
          <Text size="label" weight="semibold" secondary style={{ textTransform: "uppercase" }}>Brainstem</Text>
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
          <Text size="label" weight="semibold" secondary style={{ textTransform: "uppercase" }}>Also captured</Text>
          {others.map(o => (
            <View key={o.id} style={{
              borderRadius: radius.md, borderWidth: 1, borderColor: colors.bgBorder,
              backgroundColor: colors.bgTertiary, padding: spacing[2.5], gap: 4,
            }}>
              <Text size="meta" tertiary style={{ textTransform: "uppercase" }}>{tagLabel(o.tag)}</Text>
              <Text size="sm" style={{ lineHeight: 20 }}>{o.content || "Empty…"}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ResultList({ results, query }: { results: Dump[]; query: string }) {
  const { colors } = useTheme();

  if (results.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing[6] }}>
        <Text size="sm" tertiary>Nothing matches that.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, gap: spacing[2] }}>
      <Text size="label" weight="semibold" secondary style={{ textTransform: "uppercase" }}>
        {results.length} result{results.length === 1 ? "" : "s"}
      </Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing[2], paddingBottom: spacing[2] }}>
        {results.map(d => (
          <View key={d.id} style={{
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.lg,
            borderWidth: 1, borderColor: colors.bgBorder,
            padding: spacing[2.5], gap: 4,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <View style={{ ...shape.pill, paddingVertical: 1, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder }}>
                <Text size="meta" secondary>{tagLabel(d.tag)}</Text>
              </View>
              <Text size="meta" tertiary style={{ flex: 1 }}>
                {d.note_date ? shortDate(d.note_date) : "No date"}
              </Text>
              {d.handwritten && <Ionicons name="pencil-outline" size={iconSize.xs} color={colors.textTertiary} />}
            </View>
            <Text size="sm" style={{ lineHeight: 20 }} numberOfLines={3}>
              {snippet(d.content, query)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Window the body around the first match so a long journal entry does not
 * show three lines that don't contain the search term.
 */
function snippet(content: string, query: string): string {
  if (!query) return content;
  const i = content.toLowerCase().indexOf(query);
  if (i <= 80) return content;
  return `…${content.slice(i - 60)}`;
}
