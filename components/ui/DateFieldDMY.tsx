import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { Select, type SelectOption } from "./Select";
import { useTheme } from "@/lib/useTheme";
import { spacing } from "@/lib/theme";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Years offered around the current one — dumps are journalled, not scheduled. */
const YEARS_BACK = 5;
const YEARS_FORWARD = 1;

/** Days in a month, honouring leap years. `month` is 0-indexed. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

type Parts = { y?: number; m?: number; d?: number };

function parse(value: string | undefined): Parts {
  if (!value) return {};
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return {};
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function format({ y, m, d }: Parts): string | undefined {
  if (y === undefined || m === undefined || d === undefined) return undefined;
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type Props = {
  /** "YYYY-MM-DD", or undefined for no date. */
  value?: string;
  onChange: (value: string | undefined) => void;
};

/**
 * Day / month / year dropdowns with an explicit no-date state.
 *
 * Replaces the month-grid DatePicker where a calendar is more ceremony than the
 * field deserves. No time component; the stored value is the same
 * "YYYY-MM-DD" string the calendar produced, so nothing downstream changes —
 * the only new state is absence.
 *
 * Partial selections are held locally and only emitted once all three parts are
 * set, so picking a month first can't produce a half-formed date.
 */
export function DateFieldDMY({ value, onChange }: Props) {
  const { colors } = useTheme();
  const [parts, setParts] = useState<Parts>(() => parse(value));
  // One open panel at a time — three overlapping option lists in a small card
  // is unreadable.
  const [openField, setOpenField] = useState<"d" | "m" | "y" | null>(null);

  // Follow external changes (e.g. the field being reset by its parent) without
  // clobbering an in-progress partial selection.
  useEffect(() => {
    if (value !== format(parts)) setParts(parse(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit(next: Parts) {
    setParts(next);
    const formatted = format(next);
    // Only a complete date (or an explicit clear) is worth reporting upward.
    if (formatted !== undefined) onChange(formatted);
  }

  /** Month/year changes must not leave an out-of-range day (31 → April). */
  function clampDay(next: Parts): Parts {
    if (next.d === undefined || next.y === undefined || next.m === undefined) return next;
    const max = daysInMonth(next.y, next.m);
    return next.d > max ? { ...next, d: max } : next;
  }

  const thisYear = new Date().getFullYear();
  const yearOptions: SelectOption<number>[] = Array.from(
    { length: YEARS_BACK + YEARS_FORWARD + 1 },
    (_, i) => {
      const y = thisYear + YEARS_FORWARD - i;
      return { value: y, label: String(y) };
    }
  );
  const monthOptions: SelectOption<number>[] = MONTHS.map((label, i) => ({ value: i, label }));
  // Before a month/year is chosen, offer the widest possible range (31) rather
  // than silently assuming the current month.
  const dayCount = parts.y !== undefined && parts.m !== undefined
    ? daysInMonth(parts.y, parts.m)
    : 31;
  const dayOptions: SelectOption<number>[] = Array.from(
    { length: dayCount },
    (_, i) => ({ value: i + 1, label: String(i + 1) })
  );

  const hasValue = format(parts) !== undefined;

  return (
    <View style={{ gap: spacing[1.5] }}>
      <View style={{ flexDirection: "row", gap: spacing[1.5] }}>
        <Select
          value={parts.d}
          options={dayOptions}
          onChange={d => commit({ ...parts, d })}
          placeholder="Day"
          width={78}
          open={openField === "d"}
          onOpenChange={o => setOpenField(o ? "d" : null)}
        />
        <Select
          value={parts.m}
          options={monthOptions}
          onChange={m => commit(clampDay({ ...parts, m }))}
          placeholder="Month"
          flex={1}
          open={openField === "m"}
          onOpenChange={o => setOpenField(o ? "m" : null)}
        />
        <Select
          value={parts.y}
          options={yearOptions}
          onChange={y => commit(clampDay({ ...parts, y }))}
          placeholder="Year"
          width={88}
          open={openField === "y"}
          onOpenChange={o => setOpenField(o ? "y" : null)}
        />
      </View>
      {(hasValue || parts.d !== undefined || parts.m !== undefined || parts.y !== undefined) && (
        <Pressable
          onPress={() => { setParts({}); onChange(undefined); }}
          hitSlop={6}
          style={{ alignSelf: "flex-start" }}
        >
          <Text size="xs" style={{ color: colors.textTertiary }}>No date</Text>
        </Pressable>
      )}
    </View>
  );
}
