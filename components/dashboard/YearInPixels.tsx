import React, { useMemo, useState } from "react";
import {
  View, ScrollView, Pressable, Modal, SafeAreaView, Platform,
} from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui/Text";
import { spacing, fontFamily } from "@/lib/theme";
import { useTasks } from "@/lib/TasksContext";
import { useNotes } from "@/lib/NotesContext";
import { useLists } from "@/lib/ListsContext";
import { getLocalDateStr } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL = 11;    // px per cell
const GAP  = 2;     // px gap between cells
const STEP = CELL + GAP;
const WEEKS = 52;

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS = ["M","T","W","T","F","S","S"]; // Mon–Sun rows

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return getLocalDateStr(d);
}

function scoreToColor(score: number, accentHex: string): string {
  if (score <= 0)   return "transparent";
  if (score < 1)    return `${accentHex}40`; // ~25%
  if (score < 2.5)  return `${accentHex}80`; // ~50%
  if (score < 5)    return `${accentHex}C0`; // ~75%
  return accentHex;                            // full
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayData {
  dateStr: string;
  score: number;
  completedTasks: string[];
  createdNotes: string[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function YearInPixels() {
  const { colors } = useTheme();
  const { tasks } = useTasks();
  const { notes } = useNotes();
  const { lists } = useLists();
  const [selected, setSelected] = useState<DayData | null>(null);

  // Build the date range: start on the Monday that is ~52 weeks before today.
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Go back 52 weeks (364 days), then align to Monday (0=Mon in ISO week)
    const start = new Date(today);
    start.setDate(today.getDate() - WEEKS * 7);
    const iso = (start.getDay() + 6) % 7; // 0=Mon … 6=Sun
    start.setDate(start.getDate() - iso);

    // Build score + item maps keyed by YYYY-MM-DD
    const scoreMap: Record<string, number> = {};
    const completedMap: Record<string, string[]> = {};
    const noteMap: Record<string, string[]> = {};

    tasks.forEach(t => {
      if (t.done && t.completed_at) {
        const d = t.completed_at.slice(0, 10);
        scoreMap[d] = (scoreMap[d] ?? 0) + 1;
        completedMap[d] = [...(completedMap[d] ?? []), t.title];
      }
    });
    notes.filter(n => n.type !== "postit").forEach(n => {
      const d = n.created_at.slice(0, 10);
      scoreMap[d] = (scoreMap[d] ?? 0) + 0.5;
      noteMap[d] = [...(noteMap[d] ?? []), n.title || "Untitled"];
    });
    lists.forEach(l => {
      const d = (l.updated_at ?? l.created_at).slice(0, 10);
      scoreMap[d] = (scoreMap[d] ?? 0) + 0.3;
    });

    // Build week columns
    const weeksArr: DayData[][] = [];
    const cursor = new Date(start);
    const todayStr = toDateStr(today);

    while (cursor <= today) {
      const week: DayData[] = [];
      for (let dow = 0; dow < 7; dow++) {
        const ds = toDateStr(cursor);
        week.push({
          dateStr: ds,
          score: scoreMap[ds] ?? 0,
          completedTasks: completedMap[ds] ?? [],
          createdNotes: noteMap[ds] ?? [],
        });
        cursor.setDate(cursor.getDate() + 1);
        if (cursor > today && dow < 6) {
          // Pad remaining days in the last partial week as empty future days
          for (let rest = dow + 1; rest < 7; rest++) {
            week.push({ dateStr: "", score: -1, completedTasks: [], createdNotes: [] });
          }
          break;
        }
      }
      weeksArr.push(week);
    }

    // Compute month label positions (column index where month changes)
    const labels: { month: string; col: number }[] = [];
    let lastMonth = -1;
    weeksArr.forEach((week, col) => {
      const d = week[0]?.dateStr;
      if (!d) return;
      const m = parseInt(d.slice(5, 7)) - 1;
      if (m !== lastMonth) {
        labels.push({ month: MONTH_ABBR[m], col });
        lastMonth = m;
      }
    });

    return { weeks: weeksArr, monthLabels: labels, todayStr };
  }, [tasks, notes, lists]);

  const totalCols = weeks.length;
  const gridWidth = totalCols * STEP;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: spacing[3] }}
      >
        <View>
          {/* Month labels */}
          <View style={{ flexDirection: "row", height: 14, marginBottom: 4 }}>
            {monthLabels.map(({ month, col }) => (
              <View
                key={`${month}-${col}`}
                style={{ position: "absolute", left: col * STEP + 14 }}
              >
                <Text style={{ fontSize: 9, fontFamily: fontFamily.medium, color: colors.textTertiary }}>
                  {month}
                </Text>
              </View>
            ))}
          </View>

          {/* Grid: day-of-week labels + cells */}
          <View style={{ flexDirection: "row" }}>
            {/* Day labels (M/W/F only to avoid crowding) */}
            <View style={{ marginRight: 4 }}>
              {DAY_LABELS.map((lbl, i) => (
                <View key={i} style={{ height: CELL, marginBottom: GAP, justifyContent: "center" }}>
                  <Text style={{ fontSize: 8, color: i % 2 === 0 ? colors.textTertiary : "transparent", fontFamily: fontFamily.medium, lineHeight: CELL }}>
                    {lbl}
                  </Text>
                </View>
              ))}
            </View>

            {/* Week columns */}
            <View style={{ flexDirection: "row", gap: GAP }}>
              {weeks.map((week, col) => (
                <View key={col} style={{ gap: GAP }}>
                  {week.map((day, row) => {
                    if (day.score === -1 || !day.dateStr) {
                      // Future / padding cell
                      return (
                        <View
                          key={row}
                          style={{
                            width: CELL, height: CELL, borderRadius: 2,
                            backgroundColor: colors.bgTertiary, opacity: 0.3,
                          }}
                        />
                      );
                    }
                    const bg = day.score > 0
                      ? scoreToColor(day.score, colors.accent)
                      : colors.bgTertiary;
                    return (
                      <Pressable
                        key={row}
                        onPress={() => setSelected(prev => prev?.dateStr === day.dateStr ? null : day)}
                        style={{
                          width: CELL, height: CELL, borderRadius: 2,
                          backgroundColor: bg,
                          opacity: day.score <= 0 ? 0.45 : 1,
                        }}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Day detail popover */}
      {selected && (
        <DayPopover
          day={selected}
          accentColor={colors.accent}
          bgColor={colors.bgSecondary}
          borderColor={colors.bgBorder}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  );
}

// ─── Day popover ──────────────────────────────────────────────────────────────

function DayPopover({ day, accentColor, bgColor, borderColor, onClose }: {
  day: DayData;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const label = new Date(day.dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
  const hasItems = day.completedTasks.length > 0 || day.createdNotes.length > 0;

  return (
    <View
      style={{
        marginTop: spacing[2],
        backgroundColor: bgColor,
        borderRadius: 12, borderWidth: 1, borderColor,
        padding: spacing[3], gap: spacing[1.5],
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 12, fontFamily: "medium", color: colors.textSecondary }}>{label}</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>✕</Text>
        </Pressable>
      </View>
      {!hasItems && (
        <Text style={{ fontSize: 12, color: colors.textTertiary }}>No activity recorded.</Text>
      )}
      {day.completedTasks.length > 0 && (
        <View>
          <Text style={{ fontSize: 10, color: accentColor, fontFamily: "semibold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
            Tasks completed · {day.completedTasks.length}
          </Text>
          {day.completedTasks.slice(0, 5).map((t, i) => (
            <Text key={i} style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>• {t}</Text>
          ))}
          {day.completedTasks.length > 5 && (
            <Text style={{ fontSize: 11, color: colors.textTertiary }}>+{day.completedTasks.length - 5} more</Text>
          )}
        </View>
      )}
      {day.createdNotes.length > 0 && (
        <View>
          <Text style={{ fontSize: 10, color: accentColor, fontFamily: "semibold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
            Notes created · {day.createdNotes.length}
          </Text>
          {day.createdNotes.slice(0, 3).map((n, i) => (
            <Text key={i} style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>• {n}</Text>
          ))}
        </View>
      )}
    </View>
  );
}
