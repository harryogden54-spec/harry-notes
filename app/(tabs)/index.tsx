import React, { useState, useCallback, useRef } from "react";
import {
  View, ScrollView, SafeAreaView, Pressable,
  Platform, KeyboardAvoidingView, TextInput, Modal,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox, SearchBar, EmptyState, GlassCard } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { useTasks, type Task, type Priority } from "@/lib/TasksContext";
import { useLists, type NoteList } from "@/lib/ListsContext";
import { useNotes, type Note } from "@/lib/NotesContext";
import { useStickyNotes, STICKY_COLOURS, type StickyNote } from "@/lib/StickyNotesContext";
import { webContentStyle } from "@/lib/webLayout";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "#F26464", high: "#F5A623", medium: "#E8C84A", low: "#5B6AD0",
};

function getTodayStr()    { return new Date().toISOString().slice(0, 10); }
function getTomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

function toStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDueDate(date: string, today: string, tomorrow: string, dangerColor: string, accentColor: string) {
  if (date < today)      return { label: "Overdue",  color: dangerColor };
  if (date === today)    return { label: "Today",    color: accentColor };
  if (date === tomorrow) return { label: "Tomorrow", color: "#5B6AD0" };
  return {
    label: new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    color: "#9A9A9A",
  };
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^---+$/gm, "")
    .trim();
}

// ─── M3 section header ────────────────────────────────────────────────────────

function SectionHeader({ label, count, subtitle, action }: {
  label: string;
  count?: number;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[3] }}>
      <Text style={{
        fontSize: 11, letterSpacing: 1.2,
        color: colors.textSecondary, fontWeight: "600",
        textTransform: "uppercase", flex: 1,
      }}>
        {label}{count !== undefined ? ` · ${count}` : ""}
      </Text>
      {subtitle && <Text size="xs" secondary>{subtitle}</Text>}
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text size="xs" style={{ color: colors.accent }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({ tasksByDate, selected, onSelect, today }: {
  tasksByDate: Record<string, Task[]>;
  selected: string;
  onSelect: (d: string) => void;
  today: string;
}) {
  const { colors } = useTheme();
  const now = new Date(today + "T00:00:00");
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const firstDay    = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <GlassCard style={{ marginBottom: spacing[5], padding: spacing[4] }}>
      {/* Month nav */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[3] }}>
        <Pressable onPress={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })} hitSlop={12} style={{ padding: spacing[1] }}>
          <Text style={{ color: colors.textSecondary, fontSize: 20 }}>‹</Text>
        </Pressable>
        <Pressable onPress={() => { const n = new Date(); setView({ y: n.getFullYear(), m: n.getMonth() }); }} hitSlop={8}>
          <Text size="sm" weight="semibold">{MONTHS[view.m]} {view.y}</Text>
        </Pressable>
        <Pressable onPress={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 })} hitSlop={12} style={{ padding: spacing[1] }}>
          <Text style={{ color: colors.textSecondary, fontSize: 20 }}>›</Text>
        </Pressable>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: "row", marginBottom: spacing[1] }}>
        {DAYS.map(d => (
          <View key={d} style={{ flex: 1, alignItems: "center", paddingVertical: spacing[0.5] }}>
            <Text size="xs" tertiary weight="semibold" style={{ letterSpacing: 0.5 }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: "row" }}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={{ flex: 1, height: 38 }} />;
            const str       = toStr(view.y, view.m, day);
            const isToday   = str === today;
            const isSel     = str === selected;
            const dayTasks  = tasksByDate[str] ?? [];
            const openTasks = dayTasks.filter(t => !t.done);
            const hasOpen   = openTasks.length > 0;
            const isPast    = str < today;
            const isOverdue = isPast && hasOpen;
            const topP      = openTasks.find(t => t.priority === "urgent")?.priority
              ?? openTasks.find(t => t.priority === "high")?.priority
              ?? openTasks.find(t => t.priority === "medium")?.priority
              ?? openTasks.find(t => t.priority === "low")?.priority;
            const dotColor  = isOverdue ? colors.danger : (topP ? PRIORITY_COLOR[topP] : colors.accent);

            return (
              <Pressable
                key={col}
                onPress={() => onSelect(str)}
                style={{
                  flex: 1, height: 38, alignItems: "center", justifyContent: "center",
                  borderRadius: radius.md,
                  backgroundColor: isSel ? colors.accent : isToday ? `${colors.accent}22` : "transparent",
                }}
              >
                <Text
                  size="sm"
                  weight={isToday ? "bold" : undefined}
                  style={{ color: isSel ? "#fff" : isToday ? colors.accent : isPast ? colors.textTertiary : colors.textPrimary }}
                >
                  {day}
                </Text>
                {hasOpen && (
                  <View style={{
                    width: 6, height: 6, borderRadius: 99,
                    backgroundColor: isSel ? "#ffffff88" : dotColor,
                    marginTop: 1,
                  }} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </GlassCard>
  );
}

// ─── List shelf card ──────────────────────────────────────────────────────────

function ListShelfCard({ list, onPress }: { list: NoteList; onPress: () => void }) {
  const { colors } = useTheme();
  const color    = list.color ?? colors.accent;
  const items    = list.items ?? [];
  const total    = items.filter(i => i.type === "checkbox").length;
  const done     = items.filter(i => i.type === "checkbox" && i.done).length;
  const progress = total > 0 ? done / total : null;

  return (
    <Pressable onPress={onPress} style={{ marginRight: spacing[3] }}>
      <GlassCard style={{
        width: 130,
        borderTopWidth: 3,
        borderTopColor: color,
        padding: spacing[3],
        gap: spacing[2],
      }}>
        <View style={{ height: 5, width: 40, borderRadius: 99, backgroundColor: color }} />
        <Text size="sm" weight="semibold" numberOfLines={1}>{list.name}</Text>
        <Text size="xs" secondary>
          {items.length === 0 ? "Empty" : `${items.length} item${items.length !== 1 ? "s" : ""}`}
        </Text>
        {progress !== null && (
          <View style={{ height: 3, backgroundColor: colors.bgTertiary, borderRadius: 99 }}>
            <View style={{ height: 3, width: `${Math.round(progress * 100)}%` as any, backgroundColor: color, borderRadius: 99 }} />
          </View>
        )}
      </GlassCard>
    </Pressable>
  );
}

// ─── Pinned list card ─────────────────────────────────────────────────────────

function PinnedListCard({ list, onPress }: { list: NoteList; onPress: () => void }) {
  const { colors } = useTheme();
  const { toggleItem } = useLists();
  const color = list.color ?? colors.accent;
  const items = list.items ?? [];
  const activeItems = items.filter(i => !i.done).slice(0, 5);
  const doneCount   = items.filter(i => i.done).length;

  return (
    <GlassCard style={{ marginBottom: spacing[5], borderTopWidth: 3, borderTopColor: color }}>
      <View style={{ padding: spacing[4], paddingBottom: activeItems.length > 0 ? spacing[2] : spacing[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: activeItems.length > 0 ? spacing[3] : 0 }}>
          <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: color }} />
          <Text size="sm" weight="semibold" style={{ flex: 1 }}>{list.name}</Text>
          <Pressable onPress={onPress} hitSlop={8}>
            <Text size="xs" style={{ color: colors.accent }}>See all</Text>
          </Pressable>
        </View>
        {activeItems.map(item => (
          <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[1.5] }}>
            {item.type === "checkbox" ? (
              <Checkbox checked={item.done} onToggle={() => toggleItem(list.id, item.id)} size={15} />
            ) : (
              <View style={{ width: 4, height: 4, borderRadius: 99, backgroundColor: colors.textTertiary, marginHorizontal: 4 }} />
            )}
            <Text size="sm" numberOfLines={1} style={{ flex: 1 }}>{item.content}</Text>
          </View>
        ))}
        {doneCount > 0 && (
          <Text size="xs" secondary style={{ marginTop: spacing[1] }}>{doneCount} completed</Text>
        )}
        {items.length === 0 && (
          <Text size="sm" secondary>Empty list</Text>
        )}
      </View>
    </GlassCard>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onPress }: { task: Task; onPress: () => void }) {
  const { colors } = useTheme();
  const { toggleTask } = useTasks();
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();
  const priorityColor = task.priority ? PRIORITY_COLOR[task.priority] : undefined;
  const due           = task.due_date ? formatDueDate(task.due_date, today, tomorrow, colors.danger, colors.accent) : null;
  const isOverdue     = !task.done && !!task.due_date && task.due_date < today;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing[3],
        paddingVertical: spacing[3], paddingHorizontal: spacing[3],
        borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
      }}
    >
      <Checkbox checked={task.done} onToggle={() => toggleTask(task.id)} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          size="sm"
          weight="medium"
          numberOfLines={1}
          style={{
            color: task.done ? colors.textTertiary : isOverdue ? colors.danger : colors.textPrimary,
            textDecorationLine: task.done ? "line-through" : "none",
          }}
        >
          {task.title}
        </Text>
        {(task.tags ?? []).length > 0 && (
          <View style={{ flexDirection: "row", gap: spacing[1] }}>
            {(task.tags ?? []).slice(0, 3).map(tag => (
              <Text key={tag} size="xs" style={{ color: colors.textTertiary }}>#{tag}</Text>
            ))}
          </View>
        )}
      </View>
      {isOverdue && (
        <View style={{
          width: 6, height: 6, borderRadius: 99,
          backgroundColor: colors.danger,
        }} />
      )}
      {due && (
        <View style={{
          backgroundColor: `${due.color}18`,
          borderRadius: radius.sm,
          paddingHorizontal: spacing[2],
          paddingVertical: 3,
          borderWidth: 1,
          borderColor: `${due.color}40`,
        }}>
          <Text size="xs" weight="medium" style={{ color: due.color }}>{due.label}</Text>
        </View>
      )}
      {priorityColor && (
        <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: priorityColor }} />
      )}
    </Pressable>
  );
}

// ─── Sticky note card ─────────────────────────────────────────────────────────

function StickyCard({ note, onPress }: { note: StickyNote; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ marginRight: spacing[3] }}>
      <GlassCard style={{
        width: 150,
        borderLeftWidth: 3,
        borderLeftColor: note.colour,
        padding: spacing[3],
        minHeight: 80,
      }}>
        <Text
          size="xs"
          numberOfLines={4}
          style={{ color: note.content ? colors.textPrimary : colors.textTertiary, lineHeight: 18 }}
        >
          {note.content || "Empty note"}
        </Text>
      </GlassCard>
    </Pressable>
  );
}

// ─── Sticky note edit modal ───────────────────────────────────────────────────

function StickyNoteModal({ note, visible, onClose }: {
  note: StickyNote | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { updateNote, deleteNote } = useStickyNotes();
  const [content, setContent] = useState(note?.content ?? "");

  React.useEffect(() => { setContent(note?.content ?? ""); }, [note]);

  if (!note) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing[6] }}
        onPress={onClose}
      >
        <Pressable onPress={e => e.stopPropagation?.()}>
          <GlassCard style={{ borderLeftWidth: 4, borderLeftColor: note.colour }}>
            <View style={{ gap: spacing[3] }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: note.colour }} />
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text size="xs" style={{ color: colors.textTertiary }}>✕</Text>
                </Pressable>
              </View>
              <TextInput
                value={content}
                onChangeText={setContent}
                onBlur={() => updateNote(note.id, content)}
                placeholder="Note content…"
                placeholderTextColor={colors.textTertiary}
                multiline
                autoFocus
                style={[
                  { color: colors.textPrimary, fontSize: 14, lineHeight: 22, minHeight: 100, textAlignVertical: "top" },
                  // @ts-ignore
                  { outlineStyle: "none" },
                ]}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing[2] }}>
                <Pressable
                  onPress={() => { deleteNote(note.id); onClose(); }}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: `${colors.danger}44` }}
                >
                  <Text size="xs" style={{ color: colors.danger }}>Delete</Text>
                </Pressable>
                <Pressable
                  onPress={() => { updateNote(note.id, content); onClose(); }}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, backgroundColor: colors.accent }}
                >
                  <Text size="xs" weight="medium" style={{ color: "#fff" }}>Save</Text>
                </Pressable>
              </View>
            </View>
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Quick-add task bottom sheet ──────────────────────────────────────────────

function QuickAddSheet({ visible, onClose, onAdd }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, dueDate?: string) => void;
}) {
  const { colors } = useTheme();
  const [title, setTitle]         = useState("");
  const [quickDate, setQuickDate] = useState<"today" | "tomorrow" | "none">("none");
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();

  function submit() {
    const t = title.trim();
    if (!t) return;
    const due = quickDate === "today" ? today : quickDate === "tomorrow" ? tomorrow : undefined;
    onAdd(t, due);
    setTitle("");
    setQuickDate("none");
    onClose();
  }

  if (!visible) return null;

  return (
    <View style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      backgroundColor: colors.bgSecondary,
      borderTopWidth: 1, borderTopColor: colors.bgBorder,
      borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"],
      padding: spacing[5],
      gap: spacing[4],
    }}>
      <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: colors.bgBorder, alignSelf: "center", marginBottom: spacing[1] }} />
      <Text size="base" weight="semibold">Quick add task</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        placeholder="Task title…"
        placeholderTextColor={colors.textTertiary}
        autoFocus
        returnKeyType="done"
        style={[
          {
            color: colors.textPrimary, fontSize: 15,
            paddingVertical: spacing[3], paddingHorizontal: spacing[3],
            backgroundColor: colors.bgTertiary, borderRadius: radius.lg,
            borderWidth: 1, borderColor: colors.bgBorder,
          },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />
      {/* Date chips */}
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        {(["none", "today", "tomorrow"] as const).map(opt => {
          const label = opt === "none" ? "No date" : opt === "today" ? "Today" : "Tomorrow";
          const active = quickDate === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => setQuickDate(opt)}
              style={{
                paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
                borderRadius: radius.xl, borderWidth: 1,
                borderColor: active ? colors.accent : colors.bgBorder,
                backgroundColor: active ? `${colors.accent}18` : "transparent",
              }}
            >
              <Text size="xs" weight={active ? "semibold" : undefined} style={{ color: active ? colors.accent : colors.textSecondary }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={submit}
        style={{
          backgroundColor: title.trim() ? colors.accent : colors.bgTertiary,
          borderRadius: radius.lg, paddingVertical: spacing[3],
          alignItems: "center",
        }}
      >
        <Text size="sm" weight="semibold" style={{ color: title.trim() ? "#fff" : colors.textTertiary }}>
          Add task
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Quick-add note bottom sheet ──────────────────────────────────────────────

function QuickAddNoteSheet({ visible, onClose, onAdd }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (content: string, colour: string) => void;
}) {
  const { colors } = useTheme();
  const [content, setContent] = useState("");
  const [colour, setColour]   = useState<string>(STICKY_COLOURS[0]);

  function submit() {
    const c = content.trim();
    if (!c) return;
    onAdd(c, colour);
    setContent("");
    setColour(STICKY_COLOURS[0]);
    onClose();
  }

  if (!visible) return null;

  return (
    <View style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      backgroundColor: colors.bgSecondary,
      borderTopWidth: 1, borderTopColor: colors.bgBorder,
      borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"],
      padding: spacing[5],
      gap: spacing[4],
    }}>
      <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: colors.bgBorder, alignSelf: "center", marginBottom: spacing[1] }} />
      <Text size="base" weight="semibold">Quick note</Text>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Note content…"
        placeholderTextColor={colors.textTertiary}
        multiline
        autoFocus
        style={[
          {
            color: colors.textPrimary, fontSize: 14,
            paddingVertical: spacing[3], paddingHorizontal: spacing[3],
            backgroundColor: colors.bgTertiary, borderRadius: radius.lg,
            borderWidth: 1, borderColor: colour,
            minHeight: 88, textAlignVertical: "top", lineHeight: 22,
          },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />
      {/* Colour picker */}
      <View style={{ flexDirection: "row", gap: spacing[3], alignItems: "center" }}>
        <Text size="xs" secondary>Colour</Text>
        {STICKY_COLOURS.map(c => (
          <Pressable
            key={c}
            onPress={() => setColour(c)}
            style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: c,
              borderWidth: colour === c ? 2 : 0,
              borderColor: "#fff",
              transform: [{ scale: colour === c ? 1.2 : 1 }],
            }}
          />
        ))}
      </View>
      <Pressable
        onPress={submit}
        style={{
          backgroundColor: content.trim() ? colors.accent : colors.bgTertiary,
          borderRadius: radius.lg, paddingVertical: spacing[3],
          alignItems: "center",
        }}
      >
        <Text size="sm" weight="semibold" style={{ color: content.trim() ? "#fff" : colors.textTertiary }}>
          Add note
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Search results ───────────────────────────────────────────────────────────

function SearchResults({ tasks, lists, notes, query, onTaskPress }: {
  tasks: Task[];
  lists: NoteList[];
  notes: Note[];
  query: string;
  onTaskPress: (id: string) => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const q = query.toLowerCase();
  const matchTasks = tasks.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.description?.toLowerCase().includes(q) ||
    (t.tags ?? []).some(tag => tag.includes(q))
  );
  const matchLists = lists.filter(l =>
    l.name.toLowerCase().includes(q) ||
    (l.items ?? []).some(i => i.content.toLowerCase().includes(q))
  );
  const matchNotes = notes.filter(n =>
    n.title.toLowerCase().includes(q) ||
    n.body.toLowerCase().includes(q)
  );

  if (matchTasks.length === 0 && matchLists.length === 0 && matchNotes.length === 0) {
    return (
      <EmptyState type="search" title="No results" subtitle={`Nothing found for "${query}".`} />
    );
  }

  return (
    <View>
      {matchTasks.length > 0 && (
        <View style={{ marginBottom: spacing[5] }}>
          <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.textSecondary, fontWeight: "600", textTransform: "uppercase", marginBottom: spacing[2] }}>
            Tasks · {matchTasks.length}
          </Text>
          <GlassCard style={{ overflow: "hidden" }}>
            {matchTasks.map((t, i) => (
              <View key={t.id} style={i === matchTasks.length - 1 ? { borderBottomWidth: 0 } : undefined}>
                <TaskRow task={t} onPress={() => onTaskPress(t.id)} />
              </View>
            ))}
          </GlassCard>
        </View>
      )}
      {matchNotes.length > 0 && (
        <View style={{ marginBottom: spacing[5] }}>
          <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.textSecondary, fontWeight: "600", textTransform: "uppercase", marginBottom: spacing[2] }}>
            Notes · {matchNotes.length}
          </Text>
          {matchNotes.map(n => {
            const preview = stripMarkdown(n.body.split("\n").find(l => l.trim()) ?? "");
            return (
              <Pressable key={n.id} onPress={() => router.push(`/(tabs)/notes?openId=${n.id}` as any)}>
                <GlassCard style={{ padding: spacing[3], marginBottom: spacing[2] }}>
                  <Text size="sm" weight="semibold" numberOfLines={1}>{n.title || "Untitled"}</Text>
                  {preview ? <Text size="xs" secondary numberOfLines={1} style={{ marginTop: 2 }}>{preview}</Text> : null}
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      )}
      {matchLists.length > 0 && (
        <View>
          <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.textSecondary, fontWeight: "600", textTransform: "uppercase", marginBottom: spacing[2] }}>
            Lists · {matchLists.length}
          </Text>
          {matchLists.map(l => {
            const color = l.color ?? colors.accent;
            const items = l.items ?? [];
            return (
              <GlassCard key={l.id} style={{ padding: spacing[3], marginBottom: spacing[2], borderLeftWidth: 3, borderLeftColor: color }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                  <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: color }} />
                  <Text size="sm" weight="semibold">{l.name}</Text>
                  <Text size="xs" secondary style={{ marginLeft: "auto" as any }}>{items.length} items</Text>
                </View>
              </GlassCard>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Dashboard screen ─────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { colors }             = useTheme();
  const { tasks, addTask }     = useTasks();
  const { lists }              = useLists();
  const { notes }              = useNotes();
  const { notes: stickyNotes, addNote: addStickyNote } = useStickyNotes();
  const router                 = useRouter();
  const [search, setSearch]    = useState("");
  const [showTaskSheet, setShowTaskSheet]   = useState(false);
  const [showNoteSheet, setShowNoteSheet]   = useState(false);
  const [editingNote, setEditingNote]       = useState<StickyNote | null>(null);
  const today                  = getTodayStr();
  const tomorrow               = getTomorrowStr();
  const now                    = new Date();
  const [calSelected, setCalSelected] = useState(today);

  const openTasks = tasks
    .filter(t => !t.done)
    .sort((a, b) => {
      const aDate = a.due_date ?? "9999-99-99";
      const bDate = b.due_date ?? "9999-99-99";
      return aDate.localeCompare(bDate);
    });

  const tasksByDate: Record<string, Task[]> = {};
  for (const task of tasks) {
    if (task.due_date) {
      if (!tasksByDate[task.due_date]) tasksByDate[task.due_date] = [];
      tasksByDate[task.due_date].push(task);
    }
  }

  const overdueCount = tasks.filter(t => !t.done && !!t.due_date && t.due_date < today).length;
  const todayCount   = tasks.filter(t => !t.done && t.due_date === today).length;
  const pinnedList   = lists.find(l => l.pinned);

  const handleGoToLists = useCallback(() => router.push("/(tabs)/lists"), [router]);
  const handleGoToTasks = useCallback(() => router.push("/(tabs)/tasks"), [router]);

  const handleQuickAddTask = useCallback((title: string, dueDate?: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addTask(title, dueDate);
  }, [addTask]);

  const handleQuickAddNote = useCallback((content: string, colour: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addStickyNote(content, colour);
  }, [addStickyNote]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {/* Background blobs */}
      <View style={{ position: "absolute", top: 80, left: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: colors.accent, opacity: 0.05 }} pointerEvents="none" />
      <View style={{ position: "absolute", top: 320, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: colors.accent, opacity: 0.04 }} pointerEvents="none" />

      {/* Sheet backdrop */}
      {(showTaskSheet || showNoteSheet) && (
        <Pressable
          onPress={() => { setShowTaskSheet(false); setShowNoteSheet(false); }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 10 }}
        />
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ padding: spacing[4], paddingBottom: spacing[24] }, webContentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ───────────────────────────────────────────────────── */}
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5], flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text size="2xl" weight="bold">{greeting()}</Text>
              <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
                {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </Text>
              {(overdueCount > 0 || todayCount > 0) && (
                <View style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[2] }}>
                  {overdueCount > 0 && (
                    <View style={{ backgroundColor: `${colors.danger}18`, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 3, borderWidth: 1, borderColor: `${colors.danger}40` }}>
                      <Text size="xs" weight="medium" style={{ color: colors.danger }}>{overdueCount} overdue</Text>
                    </View>
                  )}
                  {todayCount > 0 && (
                    <View style={{ backgroundColor: `${colors.accent}18`, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 3, borderWidth: 1, borderColor: `${colors.accent}40` }}>
                      <Text size="xs" weight="medium" style={{ color: colors.accent }}>{todayCount} today</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <Pressable onPress={() => router.push("/settings")} hitSlop={12} style={{ padding: spacing[1], marginTop: spacing[1] }}>
              <Text style={{ fontSize: 20, color: colors.textSecondary, lineHeight: 24 }}>⚙</Text>
            </Pressable>
          </View>

          {/* ── Search ───────────────────────────────────────────────────── */}
          <SearchBar value={search} onChange={setSearch} placeholder="Search tasks, lists, notes…" />

          {search.trim() ? (
            <View style={{ marginTop: spacing[3] }}>
              <SearchResults
                tasks={tasks} lists={lists} notes={notes}
                query={search.trim()}
                onTaskPress={id => router.push(`/(tabs)/tasks?taskId=${id}` as any)}
              />
            </View>
          ) : (
            <>
              {/* ── Tasks ────────────────────────────────────────────────── */}
              <View style={{ marginTop: spacing[4], marginBottom: spacing[5] }}>
                <SectionHeader label="Tasks" count={openTasks.length} action={{ label: "See all", onPress: handleGoToTasks }} />
                {openTasks.length === 0 ? (
                  <EmptyState type="tasks" title="All clear" subtitle="No open tasks — enjoy the moment." />
                ) : (
                  <GlassCard style={{ overflow: "hidden" }}>
                    {openTasks.slice(0, 8).map((task, i) => (
                      <View
                        key={task.id}
                        style={i === Math.min(openTasks.length, 8) - 1 ? { borderBottomWidth: 0 } : undefined}
                      >
                        <TaskRow task={task} onPress={() => router.push(`/(tabs)/tasks?taskId=${task.id}` as any)} />
                      </View>
                    ))}
                    {openTasks.length > 8 && (
                      <Pressable onPress={handleGoToTasks} style={{ padding: spacing[3], alignItems: "center", borderTopWidth: 1, borderTopColor: colors.bgBorder }}>
                        <Text size="xs" style={{ color: colors.accent }}>{openTasks.length - 8} more tasks</Text>
                      </Pressable>
                    )}
                  </GlassCard>
                )}
              </View>

              {/* ── Quick Notes (Sticky) ─────────────────────────────────── */}
              {stickyNotes.length > 0 && (
                <View style={{ marginBottom: spacing[5] }}>
                  <SectionHeader label="Quick Notes" count={stickyNotes.length} action={{ label: "See all", onPress: () => router.push("/(tabs)/notes") }} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: spacing[1] }}
                  >
                    {stickyNotes.map(n => (
                      <StickyCard key={n.id} note={n} onPress={() => setEditingNote(n)} />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* ── Calendar ─────────────────────────────────────────────── */}
              <View style={{ marginBottom: spacing[2] }}>
                <SectionHeader label="Calendar" />
                <MiniCalendar tasksByDate={tasksByDate} selected={calSelected} onSelect={setCalSelected} today={today} />
                {(() => {
                  const dayTasks = (tasksByDate[calSelected] ?? []).filter(t => !t.done);
                  if (dayTasks.length === 0) return null;
                  return (
                    <View style={{ marginBottom: spacing[4] }}>
                      <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.textSecondary, fontWeight: "600", textTransform: "uppercase", marginBottom: spacing[2] }}>
                        {calSelected === today ? "Today" : calSelected === tomorrow ? "Tomorrow" : new Date(calSelected + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {dayTasks.length}
                      </Text>
                      <GlassCard style={{ overflow: "hidden" }}>
                        {dayTasks.map((task, i) => (
                          <View key={task.id} style={i === dayTasks.length - 1 ? { borderBottomWidth: 0 } : undefined}>
                            <TaskRow task={task} onPress={() => router.push(`/(tabs)/tasks?taskId=${task.id}` as any)} />
                          </View>
                        ))}
                      </GlassCard>
                    </View>
                  );
                })()}
              </View>

              {/* ── Pinned list ──────────────────────────────────────────── */}
              {pinnedList && (
                <View style={{ marginBottom: spacing[2] }}>
                  <SectionHeader label="Pinned list" action={{ label: "All lists", onPress: handleGoToLists }} />
                  <PinnedListCard list={pinnedList} onPress={handleGoToLists} />
                </View>
              )}

              {/* ── Lists shelf ──────────────────────────────────────────── */}
              {lists.length > 0 && (
                <View style={{ marginBottom: spacing[5] }}>
                  <SectionHeader label="Lists" action={{ label: "See all", onPress: handleGoToLists }} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[1] }}>
                    {lists.map(l => (
                      <ListShelfCard key={l.id} list={l} onPress={handleGoToLists} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Dual FABs ────────────────────────────────────────────────────────── */}
      <View
        style={{ position: "absolute", bottom: spacing[8], right: spacing[5], alignItems: "flex-end", gap: spacing[2] }}
        pointerEvents="box-none"
      >
        {/* Note FAB */}
        <Pressable
          onPress={() => { setShowNoteSheet(true); setShowTaskSheet(false); }}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.bgSecondary,
            borderWidth: 1, borderColor: colors.bgBorder,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 18, lineHeight: 24 }}>✎</Text>
        </Pressable>
        {/* Task FAB */}
        <Pressable
          onPress={() => { setShowTaskSheet(true); setShowNoteSheet(false); }}
          style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: colors.accent,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 24, lineHeight: 28, marginTop: -2 }}>+</Text>
        </Pressable>
      </View>

      {/* ── Quick-add sheets (rendered above scroll, below backdrop) ─────────── */}
      {(showTaskSheet || showNoteSheet) && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20 }} pointerEvents="box-none">
          {showTaskSheet && (
            <QuickAddSheet
              visible={showTaskSheet}
              onClose={() => setShowTaskSheet(false)}
              onAdd={handleQuickAddTask}
            />
          )}
          {showNoteSheet && (
            <QuickAddNoteSheet
              visible={showNoteSheet}
              onClose={() => setShowNoteSheet(false)}
              onAdd={handleQuickAddNote}
            />
          )}
        </View>
      )}

      {/* ── Sticky note edit modal ────────────────────────────────────────────── */}
      <StickyNoteModal
        note={editingNote}
        visible={!!editingNote}
        onClose={() => setEditingNote(null)}
      />
    </SafeAreaView>
  );
}
