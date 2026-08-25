import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Pressable, Modal, TextInput as RNTextInput, Platform, useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox, Select } from "@/components/ui";
import { spacing, radius, shape, fontFamily, iconSize } from "@/lib/theme";
import { DAY_NAMES, MONTH_NAMES, getLocalDateStr } from "@/lib/utils";
import { useDumpsActions, type Dump } from "@/lib/DumpContext";

const SAVE_DEBOUNCE_MS = 600;
/** How far back the day dropdown offers to backfill. */
const RECENT_DAYS = 14;

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return getLocalDateStr(d);
}

/** "Tue 25 Aug" */
function shortDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  return `${DAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

function savedAt(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m} ${suffix}`;
}

type Props = {
  /** The day being composed for. */
  date: string;
  onDateChange: (date: string) => void;
  /** The filed entry for `date`, if the day already has one. */
  filed: Dump | undefined;
  /** The unfiled draft for `date`, if one is in progress. */
  draft: Dump | undefined;
  /** Show this day in Browse ("Read it"). */
  onReadDay: (date: string) => void;
};

/**
 * Block D: the compose box.
 *
 * The box is a place to *put* something, never a mirror of what is already
 * filed — once a day has an entry it collapses to a receipt, so the screen
 * does not open onto a wall of yesterday's prose.
 *
 * Saving is deliberately two-stage. The 600ms autosave still runs, so closing
 * the tab mid-sentence loses nothing, but it writes a DRAFT: invisible to the
 * calendar, to Browse and to the day's entry, and still shown here. Save is
 * what files it. That gives the text disappearing from the box a cause the
 * user pressed rather than a timer, which is the whole reason the receipt is
 * legible.
 */
export function AddDumpBox({ date, onDateChange, filed, draft, onReadDay }: Props) {
  const { colors, shadow } = useTheme();
  const { addDump, updateDump, deleteDump } = useDumpsActions();
  const { width, height } = useWindowDimensions();

  const today     = getLocalDateStr();
  const yesterday = shiftDate(today, -1);

  const [text, setText]         = useState(draft?.content ?? "");
  const [expanded, setExpanded] = useState(false);
  // "Add more" on a filed day reopens the field; what gets typed is appended
  // to the day's entry on Save rather than becoming a second one.
  const [addingMore, setAddingMore] = useState(false);

  const idRef    = useRef<string | undefined>(draft?.id);
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // Adopt a newer copy of the draft (another device, or the row arriving from
  // the first sync) only when nothing is waiting to be written here — without
  // the guard an in-flight remote merge would yank the caret mid-sentence.
  useEffect(() => {
    idRef.current = draft?.id;
    if (dirtyRef.current) return;
    setText(draft?.content ?? "");
  }, [draft?.id, draft?.content]);

  // A different day is a different row: drop whatever was on screen.
  useEffect(() => {
    dirtyRef.current = false;
    setAddingMore(false);
    setText(draft?.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function flush(value: string) {
    dirtyRef.current = false;
    if (idRef.current) {
      updateDump(idRef.current, { content: value });
    } else if (value.trim()) {
      idRef.current = addDump({ tag: "journal", note_date: date, content: value, draft: true });
    }
  }

  function handleChange(value: string) {
    setText(value);
    dirtyRef.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(value), SAVE_DEBOUNCE_MS);
  }

  // Unmounting mid-debounce (tab switch, screen teardown) must not lose the
  // tail of what was typed. The cleanup reads the latest text from a ref and
  // the effect has no deps on purpose: listing `text` would re-run the cleanup
  // on every keystroke, which is the debounce written backwards.
  const textRef = useRef(text);
  useEffect(() => { textRef.current = text; }, [text]);
  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      if (dirtyRef.current) flush(textRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** File what is in the box. */
  function save() {
    const value = text.trim();
    if (!value) return;
    if (timer.current) clearTimeout(timer.current);
    dirtyRef.current = false;

    if (filed) {
      // Appending to the day's entry keeps one journal row per day, which is
      // the invariant the calendar dot and Browse both rely on.
      updateDump(filed.id, { content: `${filed.content}\n\n${value}`.trim() });
      if (idRef.current) deleteDump(idRef.current);
    } else if (idRef.current) {
      updateDump(idRef.current, { content: value, draft: undefined });
    } else {
      addDump({ tag: "journal", note_date: date, content: value });
    }

    idRef.current = undefined;
    setText("");
    setAddingMore(false);
    setExpanded(false);
  }

  function toggleHandwritten() {
    const target = filed ?? draft;
    const next = !target?.handwritten;
    if (target) {
      updateDump(target.id, { handwritten: next || undefined });
    } else {
      // Ticking before writing anything is a real intent — create the draft so
      // the flag survives, and the text lands in it on the next keystroke.
      idRef.current = addDump({ tag: "journal", note_date: date, content: text, draft: true });
      updateDump(idRef.current, { handwritten: next || undefined });
    }
  }

  const handwritten = !!(filed ?? draft)?.handwritten;
  // The receipt only stands in for the field when the day is genuinely done:
  // a draft in progress always wins, or the text would vanish as you typed.
  const showReceipt = !!filed && !addingMore && !text.trim();

  const dayOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let i = 0; i < RECENT_DAYS; i++) {
      const d = shiftDate(today, -i);
      opts.push({ value: d, label: i === 0 ? "Today" : i === 1 ? "Yesterday" : shortDate(d) });
    }
    // A day reached from the calendar can be older than the window; keep it
    // listed so the trigger never shows a value the panel cannot offer.
    if (!opts.some(o => o.value === date)) {
      opts.push({ value: date, label: shortDate(date) });
    }
    return opts;
  }, [today, date]);

  const DayShortcut = ({ label, target }: { label: string; target: string }) => {
    const active = date === target;
    return (
      <Pressable
        onPress={() => onDateChange(target)}
        style={{
          paddingHorizontal: spacing[3], paddingVertical: spacing[1],
          borderRadius: 999,
          backgroundColor: active ? colors.accent : "transparent",
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
  };

  // One press target for box and label. The Checkbox is deliberately inert:
  // nested pressables on react-native-web let the inner one handle the click,
  // so a live checkbox inside a live row toggles once or twice depending on
  // exactly where the pointer landed.
  const HandwrittenToggle = (
    <Pressable
      onPress={toggleHandwritten}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: handwritten }}
      accessibilityLabel="Written by hand"
    >
      <View pointerEvents="none">
        <Checkbox size={16} checked={handwritten} onToggle={toggleHandwritten} />
      </View>
      <Text size="meta" secondary>Written by hand</Text>
    </Pressable>
  );

  const field = (big: boolean) => (
    <RNTextInput
      value={text}
      onChangeText={handleChange}
      multiline
      textAlignVertical="top"
      placeholder={filed ? "Anything else?" : "How was it, then?"}
      placeholderTextColor={colors.textTertiary}
      style={[
        {
          flex: big ? 1 : undefined,
          minHeight: big ? undefined : 110,
          color: colors.textPrimary,
          fontSize: big ? 16 : 15,
          lineHeight: big ? 26 : 22,
          fontFamily: fontFamily.regular,
        },
        { outlineStyle: "none" } as any,
      ]}
    />
  );

  const SaveButton = (
    <Pressable
      onPress={save}
      disabled={!text.trim()}
      style={{
        paddingHorizontal: spacing[4], paddingVertical: spacing[1.5],
        borderRadius: 999,
        backgroundColor: text.trim() ? colors.accent : colors.bgTertiary,
        borderWidth: text.trim() ? 0 : 1,
        borderColor: colors.bgBorder,
      }}
      accessibilityRole="button"
      accessibilityLabel="Save dump"
    >
      <Text size="meta" weight="semibold"
        style={{ color: text.trim() ? colors.textInverse : colors.textTertiary }}>
        Save
      </Text>
    </Pressable>
  );

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <Text size="cardTitle" weight="semibold" style={{ flex: 1 }}>Add a dump</Text>
        <Pressable
          onPress={() => setExpanded(true)}
          hitSlop={10}
          accessibilityLabel="Expand"
          // @ts-ignore web-only tooltip
          title={Platform.OS === "web" ? "Expand" : undefined}
        >
          <Ionicons name="expand-outline" size={iconSize.sm} color={colors.textTertiary} />
        </Pressable>
      </View>

      {/* Day control: two shortcuts for the days you actually write about,
          and a dropdown for backfilling anything older. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], zIndex: 20 }}>
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 3, padding: 3,
          backgroundColor: colors.bgTertiary,
          borderRadius: 999, borderWidth: 1, borderColor: colors.bgBorder,
        }}>
          <DayShortcut label="Today" target={today} />
          <DayShortcut label="Yesterday" target={yesterday} />
        </View>
        <Select
          value={date}
          options={dayOptions}
          onChange={onDateChange}
          placeholder="Pick a day"
          width={132}
          panelMinWidth={160}
        />
      </View>

      {showReceipt ? (
        <View style={{
          backgroundColor: colors.bgTertiary,
          borderRadius: radius.lg,
          borderWidth: 1, borderColor: colors.bgBorder,
          padding: spacing[3],
          flexDirection: "row", alignItems: "center", gap: spacing[3],
        }}>
          <View style={{
            width: 30, height: 30, borderRadius: 999,
            backgroundColor: `${colors.success}1F`,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="checkmark" size={iconSize.md} color={colors.success} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text size="sm" weight="medium">
              {date === today ? "Dumped for today" : `Dumped for ${shortDate(date)}`}
            </Text>
            {/* "saved" is redundant next to the tick, and spelling it out
                wrapped this row onto two lines in the narrower column. */}
            <Text size="meta" tertiary numberOfLines={1}>
              {wordCount(filed!.content)} word{wordCount(filed!.content) === 1 ? "" : "s"}
              {savedAt(filed!.updated_at) ? ` · ${savedAt(filed!.updated_at)}` : ""}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <Pressable
              onPress={() => onReadDay(date)}
              style={{
                ...shape.pill,
                paddingVertical: spacing[1.5],
                backgroundColor: colors.bgSecondary,
                borderWidth: 1, borderColor: colors.bgBorder,
              }}
              accessibilityLabel="Read this day"
            >
              <Text size="meta" weight="medium" secondary>Read it</Text>
            </Pressable>
            <Pressable
              onPress={() => setAddingMore(true)}
              style={{ ...shape.pill, paddingVertical: spacing[1.5], backgroundColor: colors.accent }}
              accessibilityLabel="Add more to this day"
            >
              <Text size="meta" weight="semibold" style={{ color: colors.textInverse }}>Add more</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={{
            backgroundColor: colors.bgTertiary,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: text.trim() ? colors.accent : colors.bgBorder,
            padding: spacing[3],
          }}>
            {field(false)}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
            {HandwrittenToggle}
            <View style={{ flex: 1 }} />
            {/* Keyed off the draft row rather than idRef: a ref never triggers
                a render, so the indicator would lag a keystroke behind. */}
            {!!draft && !!text.trim() && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="checkmark" size={iconSize.xs} color={colors.textTertiary} />
                <Text size="meta" tertiary>Draft kept</Text>
              </View>
            )}
            {SaveButton}
          </View>
        </>
      )}

      {showReceipt && HandwrittenToggle}

      {/* animationType="none" is deliberate. react-native-web's ModalAnimation
          only clears its `animatedOut` style — which carries
          `pointerEvents: 'none'` — when the CSS animation fires `animationend`.
          Under `prefers-reduced-motion: reduce` the browser never runs it, so a
          fade/slide modal can strand an inert, invisible copy of itself in the
          DOM. With no animation the library calls its own end callback
          directly. */}
      <Modal visible={expanded} transparent animationType="none" onRequestClose={() => setExpanded(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", padding: spacing[6] }}
          onPress={() => setExpanded(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: Math.min(width * 0.88, 900),
              height: Math.min(height * 0.86, 760),
              backgroundColor: colors.bgSecondary,
              borderRadius: radius["2xl"],
              borderWidth: 1, borderColor: colors.bgBorder,
              padding: spacing[5],
              gap: spacing[3],
              ...shadow("overlay"),
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <Text size="lg" weight="bold" style={{ flex: 1 }}>
                Add a dump · {date === today ? "today" : shortDate(date)}
              </Text>
              <Pressable onPress={() => setExpanded(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="contract-outline" size={iconSize.md} color={colors.textTertiary} />
              </Pressable>
            </View>

            <View style={{ flex: 1 }}>{field(true)}</View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
              {HandwrittenToggle}
              <View style={{ flex: 1 }} />
              <Text size="meta" tertiary>
                {wordCount(text)} word{wordCount(text) === 1 ? "" : "s"}
              </Text>
              {SaveButton}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
