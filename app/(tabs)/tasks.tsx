import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, ScrollView, SafeAreaView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, RefreshControl, Modal,
  type ScrollView as RNScrollView, useWindowDimensions,
} from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Swipeable } from "react-native-gesture-handler";
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";

import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox, Divider, DatePicker, SearchBar, EmptyState, GlassCard, Surface, GradientBackground } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";
import { useTasks, type Task, type Priority, type TaskCategory, type UniCourse, UNI_COURSES } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";
import { getTodayStr, getTomorrowStr, getNextWeekStr, parseNaturalDate } from "@/lib/utils";
import { storage } from "@/lib/storage";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#EF4444" },
  high:   { label: "High",   color: "#F97316" },
  medium: { label: "Medium", color: "#EAB308" },
  low:    { label: "Low",    color: "#6B7280" },
};
const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low"];

function formatDate(date: string) {
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();
  if (date === today)    return "Today";
  if (date === tomorrow) return "Tomorrow";
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function isOverdue(t: Task)   { return !t.done && !!t.due_date && t.due_date < getTodayStr(); }
function isToday(t: Task)     { return !t.done && t.due_date === getTodayStr(); }
function isScheduled(t: Task) { return !t.done && !!t.due_date && t.due_date > getTodayStr(); }
function isSomeday(t: Task)   { return !t.done && !t.due_date; }

function sortByPriority(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const ai = a.priority ? PRIORITY_ORDER.indexOf(a.priority) : 99;
    const bi = b.priority ? PRIORITY_ORDER.indexOf(b.priority) : 99;
    return ai - bi;
  });
}

type SortBy = "priority" | "due_date" | "title" | "created";

function applySort(tasks: Task[], by: SortBy): Task[] {
  if (by === "priority") return sortByPriority(tasks);
  if (by === "due_date") return [...tasks].sort((a, b) => (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : 1);
  if (by === "title")    return [...tasks].sort((a, b) => a.title.localeCompare(b.title));
  return [...tasks];
}

function matchesSearch(task: Task, q: string) {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    task.title.toLowerCase().includes(lower) ||
    (task.description?.toLowerCase().includes(lower) ?? false)
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, color, onRemove, active, onPress }: {
  label: string; color?: string; onRemove?: () => void; active?: boolean; onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 4,
        backgroundColor: active
          ? (color ? `${color}25` : `${colors.accent}25`)
          : (color ? `${color}12` : colors.bgTertiary),
        borderWidth: 1,
        borderColor: active
          ? (color ?? colors.accent)
          : (color ? `${color}40` : colors.bgBorder),
        borderRadius: 99,
        paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
      }}
    >
      <Text size="xs" style={{ color: active ? (color ?? colors.accent) : (color ?? colors.textSecondary) }}>{label}</Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={6}>
          <Text size="xs" style={{ color: color ?? colors.textTertiary }}>×</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

// ─── Meta row ─────────────────────────────────────────────────────────────────

function MetaRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[2.5], minHeight: 22 }}>
      <Text size="xs" style={{ color: colors.textTertiary, width: 14, marginTop: 2 }}>{icon}</Text>
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing[1] }}>
        {children}
      </View>
    </View>
  );
}

// ─── Priority Selector ────────────────────────────────────────────────────────

function PrioritySelector({ value, onChange }: { value?: Priority; onChange: (p?: Priority) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing[1.5], flexWrap: "wrap" }}>
      {(Object.entries(PRIORITY_CONFIG) as [Priority, { label: string; color: string }][]).map(([key, cfg]) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(active ? undefined : key)}
            style={{
              flexDirection: "row", alignItems: "center", gap: spacing[1],
              paddingHorizontal: spacing[2], paddingVertical: spacing[1],
              borderRadius: radius.sm, borderWidth: 1,
              borderColor: active ? cfg.color : colors.bgBorder,
              backgroundColor: active ? `${cfg.color}18` : "transparent",
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: cfg.color }} />
            <Text size="xs" style={{ color: active ? cfg.color : colors.textSecondary }}>{cfg.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Due Date Selector ────────────────────────────────────────────────────────

function DueDateSelector({ value, onChange }: { value?: string; onChange: (d?: string) => void }) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();
  const nextWeek = getNextWeekStr();
  const dueDateColor = value && value < today ? colors.danger : value === today ? colors.warning : colors.accent;
  const presets = [
    { label: "Today",     date: today },
    { label: "Tomorrow",  date: tomorrow },
    { label: "Next week", date: nextWeek },
  ];
  return (
    <View style={{ gap: spacing[1.5] }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5], alignItems: "center" }}>
        {value ? (
          <>
            <Chip label={formatDate(value)} color={dueDateColor} onRemove={() => { onChange(undefined); setShowPicker(false); }} />
            <Pressable onPress={() => setShowPicker(v => !v)}>
              <Text size="xs" style={{ color: colors.textTertiary }}>Change</Text>
            </Pressable>
          </>
        ) : (
          <>
            {presets.map(p => (
              <Pressable key={p.date} onPress={() => onChange(p.date)}
                style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}>
                <Text size="xs" style={{ color: colors.textSecondary }}>{p.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setShowPicker(v => !v)}>
              <Text size="xs" style={{ color: colors.textTertiary }}>Pick date…</Text>
            </Pressable>
          </>
        )}
      </View>
      {showPicker && <DatePicker value={value} onChange={(d) => { onChange(d); setShowPicker(false); }} />}
    </View>
  );
}

// ─── Category Selector ────────────────────────────────────────────────────────

function CategorySelector({ category, uniCourse, onChange }: {
  category?: TaskCategory;
  uniCourse?: UniCourse;
  onChange: (category?: TaskCategory, uniCourse?: UniCourse) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: "row", gap: spacing[1.5] }}>
        <Pressable
          onPress={() => onChange(category === "personal" ? undefined : "personal", undefined)}
          style={{
            paddingHorizontal: spacing[2], paddingVertical: spacing[1],
            borderRadius: radius.sm, borderWidth: 1,
            borderColor: category === "personal" ? colors.accent : colors.bgBorder,
            backgroundColor: category === "personal" ? `${colors.accent}18` : "transparent",
          }}
        >
          <Text size="xs" style={{ color: category === "personal" ? colors.accent : colors.textSecondary }}>Personal</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange(category === "uni" ? undefined : "uni", uniCourse ?? "Misc")}
          style={{
            paddingHorizontal: spacing[2], paddingVertical: spacing[1],
            borderRadius: radius.sm, borderWidth: 1,
            borderColor: category === "uni" ? "#B48EAD" : colors.bgBorder,
            backgroundColor: category === "uni" ? "#B48EAD18" : "transparent",
          }}
        >
          <Text size="xs" style={{ color: category === "uni" ? "#B48EAD" : colors.textSecondary }}>Uni</Text>
        </Pressable>
      </View>
      {category === "uni" && (
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
          {UNI_COURSES.map(course => (
            <Pressable
              key={course}
              onPress={() => onChange("uni", course)}
              style={{
                paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
                borderRadius: 99, borderWidth: 1,
                borderColor: uniCourse === course ? "#B48EAD" : colors.bgBorder,
                backgroundColor: uniCourse === course ? "#B48EAD18" : "transparent",
              }}
            >
              <Text size="xs" style={{ color: uniCourse === course ? "#B48EAD" : colors.textSecondary }}>
                {course}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Subtasks ─────────────────────────────────────────────────────────────────

function SubtasksList({ subtasks, onChange }: { subtasks: Task["subtasks"]; onChange: (s: NonNullable<Task["subtasks"]>) => void }) {
  const { colors } = useTheme();
  const [input, setInput] = useState("");
  const list = subtasks ?? [];

  function addSubtask() {
    const title = input.trim();
    if (!title) return;
    onChange([...list, { id: `${Date.now()}`, title, done: false }]);
    setInput("");
  }

  return (
    <View style={{ gap: spacing[1.5] }}>
      {list.map(sub => (
        <View key={sub.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
          <Checkbox checked={sub.done} onToggle={() => onChange(list.map(s => s.id === sub.id ? { ...s, done: !s.done } : s))} size={15} />
          <Text size="sm" style={{ flex: 1, color: sub.done ? colors.textTertiary : colors.textSecondary, textDecorationLine: sub.done ? "line-through" : "none" }}>
            {sub.title}
          </Text>
          <Pressable onPress={() => onChange(list.filter(s => s.id !== sub.id))} hitSlop={8}>
            <Text size="xs" style={{ color: colors.textTertiary }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: spacing[2],
        marginTop: spacing[1],
        backgroundColor: colors.bgTertiary,
        borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.bgBorder,
        paddingHorizontal: spacing[2.5], paddingVertical: spacing[1.5],
      }}>
        <View style={{ width: 15, height: 15, borderRadius: 4, borderWidth: 1.5, borderColor: colors.bgBorder }} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Add subtask…"
          placeholderTextColor={colors.textTertiary}
          onSubmitEditing={addSubtask}
          style={[
            { flex: 1, color: colors.textPrimary, fontSize: 13, paddingVertical: 0 },
            // @ts-ignore
            { outlineStyle: "none" },
          ]}
        />
        {input.length > 0 && (
          <Pressable onPress={addSubtask} hitSlop={8}>
            <Text size="xs" style={{ color: colors.accent }} weight="medium">Add</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category, uniCourse }: { category?: TaskCategory; uniCourse?: UniCourse }) {
  if (!category) return null;
  const isUni  = category === "uni";
  const color  = isUni ? "#B48EAD" : "#88C0D0";
  const label  = isUni ? (uniCourse ?? "Uni") : "Personal";
  return (
    <View style={{
      paddingHorizontal: spacing[1.5], paddingVertical: 2,
      borderRadius: 99, backgroundColor: `${color}18`,
      borderWidth: 1, borderColor: `${color}40`,
    }}>
      <Text size="xs" style={{ color }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─── Task Item ────────────────────────────────────────────────────────────────

function TaskItem({
  task, isExpanded, onToggleExpand,
  selectMode, selected, onSelect,
  onReorderUp, onReorderDown,
  onDelete, onDragStart, isDragging,
  highlighted, onMeasureY, onLongPress,
}: {
  task: Task; isExpanded: boolean; onToggleExpand: () => void;
  selectMode: boolean; selected: boolean; onSelect: () => void;
  onReorderUp: () => void; onReorderDown: () => void;
  onLongPress?: () => void;
  onDelete: () => void;
  onDragStart?: () => void;
  isDragging?: boolean;
  highlighted?: boolean;
  onMeasureY?: (y: number) => void;
}) {
  const { colors } = useTheme();
  const { updateTask } = useTasks();
  const [hovered, setHovered] = useState(false);
  const today = getTodayStr();
  const { width } = useWindowDimensions();
  const desktopMode = Platform.OS === "web" && width > 1024;

  const priorityColor = task.priority ? PRIORITY_CONFIG[task.priority]?.color : undefined;
  const overdue       = !task.done && !!task.due_date && task.due_date < today;
  const dueDateColor  = overdue ? colors.danger : task.due_date === today ? colors.warning : colors.textTertiary;
  const subtasks      = task.subtasks ?? [];
  const doneSubtasks  = subtasks.filter(s => s.done).length;

  function renderLeftActions() {
    if (Platform.OS === "web" || task.done) return null;
    return (
      <View style={{ justifyContent: "center", alignItems: "flex-end", paddingHorizontal: spacing[4], backgroundColor: `${colors.accent}22`, borderRadius: radius.lg, marginBottom: spacing[1.5], marginRight: spacing[1] }}>
        <Text size="xs" weight="semibold" style={{ color: colors.accent }}>✓ Done</Text>
      </View>
    );
  }

  function renderRightActions() {
    if (Platform.OS === "web") return null;
    return (
      <View style={{ justifyContent: "center", alignItems: "flex-start", paddingHorizontal: spacing[4], backgroundColor: `${colors.danger}22`, borderRadius: radius.lg, marginBottom: spacing[1.5], marginLeft: spacing[1] }}>
        <Text size="xs" weight="semibold" style={{ color: colors.danger }}>✕ Delete</Text>
      </View>
    );
  }

  return (
    <View onLayout={e => onMeasureY?.(e.nativeEvent.layout.y)}>
    <Swipeable
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(dir) => {
        if (dir === "left" && !task.done) {
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          updateTask(task.id, { done: true });
        } else if (dir === "right") {
          onDelete();
        }
      }}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
    >
      <Surface
        // @ts-ignore
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        variant="elevated"
        style={{
          borderColor: highlighted ? colors.accent : selected ? colors.accent : isExpanded ? (priorityColor ?? colors.accent) : undefined,
          borderWidth: highlighted ? 2 : 1,
          borderLeftWidth: priorityColor && !highlighted ? 3 : highlighted ? 2 : 1,
          borderLeftColor: highlighted ? colors.accent : priorityColor ?? undefined,
          marginBottom: spacing[1.5],
          opacity: selected ? 0.85 : 1,
        }}
      >
        {/* Header row — tightened padding */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2.5], paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
          {selectMode ? (
            <Checkbox checked={selected} onToggle={onSelect} size={16} />
          ) : (
            <Checkbox checked={task.done} onToggle={() => updateTask(task.id, { done: !task.done })} />
          )}
          <Pressable
            onPress={selectMode ? onSelect : onToggleExpand}
            onLongPress={!selectMode ? onLongPress : undefined}
            delayLongPress={400}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing[2.5] }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text size="sm" weight="medium" style={{
                color: task.done ? colors.textTertiary : colors.textPrimary,
                textDecorationLine: task.done ? "line-through" : "none",
              }}>{task.title}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5], alignItems: "center" }}>
                {task.due_date && <Text size="xs" style={{ color: dueDateColor }}>{formatDate(task.due_date)}</Text>}
                {subtasks.length > 0 && <Text size="xs" style={{ color: colors.textTertiary }}>{doneSubtasks}/{subtasks.length}</Text>}
                {task.category && <CategoryBadge category={task.category} uniCourse={task.uniCourse} />}
              </View>
            </View>
            {task.priority && <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: priorityColor }} />}
            {hovered && !selectMode && !isExpanded && (
              <View style={{ flexDirection: "row", gap: 2 }}>
                <Pressable onPress={(e) => { e.stopPropagation?.(); onReorderUp(); }} hitSlop={6}
                  style={{ padding: 3, borderRadius: 4, backgroundColor: colors.bgTertiary }}>
                  <Text size="xs" style={{ color: colors.textTertiary }}>↑</Text>
                </Pressable>
                <Pressable onPress={(e) => { e.stopPropagation?.(); onReorderDown(); }} hitSlop={6}
                  style={{ padding: 3, borderRadius: 4, backgroundColor: colors.bgTertiary }}>
                  <Text size="xs" style={{ color: colors.textTertiary }}>↓</Text>
                </Pressable>
              </View>
            )}
            {!selectMode && <Text size="xs" style={{ color: colors.textTertiary }}>{isExpanded ? "▴" : "▾"}</Text>}
          </Pressable>
          {!selectMode && !isExpanded && Platform.OS !== "web" && onDragStart && (
            <Pressable onLongPress={onDragStart} hitSlop={8} style={{ paddingLeft: spacing[1] }}>
              <Text style={{ color: colors.textTertiary, fontSize: 16, lineHeight: 22 }}>⠿</Text>
            </Pressable>
          )}
        </View>

        {isExpanded && !selectMode && !desktopMode && (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <Divider />
            <View style={{ padding: spacing[3], gap: spacing[2.5] }}>
              <TextInput
                value={task.title}
                onChangeText={title => updateTask(task.id, { title })}
                multiline
                style={[
                  { color: colors.textPrimary, fontSize: 14, fontFamily: fontFamily.semibold, lineHeight: 20 },
                  // @ts-ignore
                  { outlineStyle: "none" },
                ]}
              />
              <TextInput
                value={task.description ?? ""}
                onChangeText={description => updateTask(task.id, { description })}
                placeholder="Add notes…"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={2}
                style={[
                  { color: colors.textSecondary, fontSize: 13, lineHeight: 18, minHeight: 36, textAlignVertical: "top" },
                  // @ts-ignore
                  { outlineStyle: "none" },
                ]}
              />
              <Divider />
              <MetaRow icon="⬤">
                <PrioritySelector value={task.priority} onChange={priority => updateTask(task.id, { priority })} />
              </MetaRow>
              <MetaRow icon="◷">
                <DueDateSelector value={task.due_date} onChange={due_date => updateTask(task.id, { due_date })} />
              </MetaRow>
              <MetaRow icon="◈">
                <CategorySelector
                  category={task.category}
                  uniCourse={task.uniCourse}
                  onChange={(category, uniCourse) => updateTask(task.id, { category, uniCourse })}
                />
              </MetaRow>
              <Divider />
              <View style={{ gap: spacing[2] }}>
                <Text size="sm" weight="semibold" style={{ color: colors.textSecondary }}>
                  Subtasks{subtasks.length > 0 ? ` · ${doneSubtasks}/${subtasks.length}` : ""}
                </Text>
                <SubtasksList subtasks={subtasks} onChange={s => updateTask(task.id, { subtasks: s })} />
              </View>
              <Divider />
              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                <Pressable onPress={onDelete}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: `${colors.danger}44`, backgroundColor: `${colors.danger}10` }}>
                  <Text size="xs" style={{ color: colors.danger }}>Delete task</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}
      </Surface>
    </Swipeable>
    </View>
  );
}

// ─── Task Detail Panel ────────────────────────────────────────────────────────

function TaskDetailPanel({ task, onClose }: { task: Task; onClose?: () => void }) {
  const { colors } = useTheme();
  const { updateTask, deleteTask, toggleTask } = useTasks();
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter(s => s.done).length;

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    const undo = deleteTask(task.id);
    onClose?.();
    showToast("Task deleted", { label: "Undo", onPress: undo });
  }

  return (
    <ScrollView
      style={[{ flex: 1 }, Platform.OS === "web" && { scrollbarWidth: "none" } as any]}
      contentContainerStyle={{ padding: spacing[5], gap: spacing[4], paddingBottom: spacing[16] }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header: Complete + Close */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], justifyContent: "space-between" }}>
        <Pressable
          onPress={() => { toggleTask(task.id); onClose?.(); }}
          style={{
            flexDirection: "row", alignItems: "center", gap: spacing[2],
            paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
            borderRadius: radius.lg, borderWidth: 1,
            borderColor: task.done ? colors.success : colors.accent,
            backgroundColor: task.done ? `${colors.success}18` : `${colors.accent}18`,
          }}
        >
          <Ionicons
            name={task.done ? "checkmark-circle" : "checkmark-circle-outline"}
            size={18}
            color={task.done ? colors.success : colors.accent}
          />
          <Text size="xs" weight="semibold" style={{ color: task.done ? colors.success : colors.accent }}>
            {task.done ? "Completed" : "Mark done"}
          </Text>
        </Pressable>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={12}
            style={{ width: 26, height: 26, borderRadius: 99, backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center" }}>
            <Text size="sm" style={{ color: colors.textTertiary }}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Editable title */}
      <TextInput
        value={task.title}
        onChangeText={title => updateTask(task.id, { title })}
        multiline
        placeholder="Task title"
        placeholderTextColor={colors.textTertiary}
        style={[
          { color: task.done ? colors.textTertiary : colors.textPrimary, fontSize: 20, fontFamily: fontFamily.bold, lineHeight: 28,
            textDecorationLine: task.done ? "line-through" : "none" },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />

      {/* Description */}
      <TextInput
        value={task.description ?? ""}
        onChangeText={description => updateTask(task.id, { description })}
        placeholder="Add notes…"
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={4}
        style={[
          { color: colors.textSecondary, fontSize: 14, lineHeight: 21, minHeight: 72, textAlignVertical: "top",
            backgroundColor: colors.bgTertiary, borderRadius: radius.lg, padding: spacing[3], borderWidth: 1, borderColor: colors.bgBorder },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />

      <Divider />

      {/* Metadata */}
      <MetaRow icon="⬤">
        <PrioritySelector value={task.priority} onChange={priority => updateTask(task.id, { priority })} />
      </MetaRow>
      <MetaRow icon="◷">
        <DueDateSelector value={task.due_date} onChange={due_date => updateTask(task.id, { due_date })} />
      </MetaRow>
      <MetaRow icon="◈">
        <CategorySelector
          category={task.category}
          uniCourse={task.uniCourse}
          onChange={(category, uniCourse) => updateTask(task.id, { category, uniCourse })}
        />
      </MetaRow>

      <Divider />

      {/* Subtasks — more visual weight */}
      <View style={{ gap: spacing[2] }}>
        <Text size="sm" weight="semibold" style={{ color: colors.textSecondary, letterSpacing: 0.3 }}>
          Subtasks{subtasks.length > 0 ? ` · ${doneSubtasks}/${subtasks.length}` : ""}
        </Text>
        <SubtasksList subtasks={subtasks} onChange={s => updateTask(task.id, { subtasks: s })} />
      </View>

      <Divider />

      {/* Delete */}
      {confirmDelete ? (
        <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "center" }}>
          <Text size="xs" style={{ color: colors.danger, flex: 1 }}>Are you sure?</Text>
          <Pressable onPress={handleDelete}
            style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, backgroundColor: colors.danger }}>
            <Text size="xs" weight="semibold" style={{ color: "#fff" }}>Delete</Text>
          </Pressable>
          <Pressable onPress={() => setConfirmDelete(false)}
            style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}>
            <Text size="xs" style={{ color: colors.textSecondary }}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={handleDelete}
          style={{ alignSelf: "flex-start", paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: `${colors.danger}44`, backgroundColor: `${colors.danger}10` }}>
          <Text size="xs" style={{ color: colors.danger }}>Delete task</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

// ─── Add Task Row ─────────────────────────────────────────────────────────────

function AddTaskRow({ onAdd, inputRef }: {
  onAdd: (t: string, date?: string, category?: TaskCategory, uniCourse?: UniCourse) => void;
  inputRef: React.RefObject<TextInput | null>;
}) {
  const { colors } = useTheme();
  const [value, setValue]               = useState("");
  const [focused, setFocused]           = useState(false);
  const [quickDate, setQuickDate]       = useState<string | undefined>();
  const [quickCat, setQuickCat]         = useState<TaskCategory | undefined>();
  const [quickCourse, setQuickCourse]   = useState<UniCourse>("Misc");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const showOptions = focused || value.length > 0 || !!quickDate || !!quickCat;
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();
  const nextWeek = getNextWeekStr();

  const dueDateColor = quickDate && quickDate < today ? colors.danger : quickDate === today ? colors.warning : colors.accent;

  // NLP date detection from title (only when no date manually chosen)
  const { date: nlpDate, cleanText: nlpClean } = !quickDate ? parseNaturalDate(value) : { date: null, cleanText: value };

  function submit() {
    const t = value.trim();
    if (!t) return;
    const finalTitle = !quickDate && nlpDate ? (nlpClean.trim() || t) : t;
    const finalDate  = quickDate ?? (nlpDate ?? undefined);
    onAdd(finalTitle, finalDate, quickCat, quickCat === "uni" ? quickCourse : undefined);
    setValue("");
    setQuickDate(undefined);
    setQuickCat(undefined);
    setShowDatePicker(false);
  }

  const DATE_PRESETS = [
    { label: "Today",     date: today },
    { label: "Tomorrow",  date: tomorrow },
    { label: "Next week", date: nextWeek },
  ];

  return (
    <Surface
      variant="elevated"
      style={{ borderColor: focused ? colors.accent : undefined, marginBottom: spacing[4] }}
    >
      <View style={{ paddingVertical: spacing[2] + 2, paddingHorizontal: spacing[3], gap: spacing[2] }}>
        {/* Main input row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
          <Text style={{ color: colors.accent, fontSize: 18, lineHeight: 22, marginTop: -1 }}>+</Text>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={setValue}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={submit}
            placeholder="New task… (press N)"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="done"
            style={[
              { flex: 1, color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
              // @ts-ignore
              { outlineStyle: "none" },
            ]}
          />
          {value.length > 0 && (
            <Pressable onPress={submit}
              style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm, backgroundColor: colors.accent }}>
              <Text size="xs" weight="medium" style={{ color: "#fff" }}>Add</Text>
            </Pressable>
          )}
        </View>

        {/* NLP date hint */}
        {nlpDate && !quickDate && value.trim().length > 0 && (
          <Pressable
            onPress={() => { setQuickDate(nlpDate); setValue(nlpClean.trim() || value); }}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], paddingHorizontal: spacing[1], paddingTop: spacing[1] }}
          >
            <Text size="xs" style={{ color: colors.accent }}>📅 {formatDate(nlpDate)}</Text>
            <Text size="xs" style={{ color: colors.textTertiary }}>detected — tap to set as due date</Text>
          </Pressable>
        )}

        {/* Quick-options panel */}
        {showOptions && (
          <Animated.View entering={FadeIn.duration(150)}>
            <Divider />
            <View style={{ gap: spacing[2], paddingTop: spacing[2] }}>
              {/* Date row */}
              <View style={{ gap: spacing[1.5] }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], flexWrap: "wrap" }}>
                  <Text size="xs" style={{ color: colors.textTertiary, width: 32 }}>Date</Text>
                  {quickDate && !DATE_PRESETS.find(p => p.date === quickDate) ? (
                    <>
                      <Chip
                        label={formatDate(quickDate)}
                        color={dueDateColor}
                        onRemove={() => { setQuickDate(undefined); setShowDatePicker(false); }}
                      />
                      <Pressable onPress={() => setShowDatePicker(v => !v)}>
                        <Text size="xs" style={{ color: colors.textTertiary }}>Change</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      {DATE_PRESETS.map(p => (
                        <Pressable
                          key={p.date}
                          onPress={() => { setQuickDate(d => d === p.date ? undefined : p.date); setShowDatePicker(false); }}
                          style={{
                            paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
                            borderRadius: 99, borderWidth: 1,
                            borderColor: quickDate === p.date ? dueDateColor : colors.bgBorder,
                            backgroundColor: quickDate === p.date ? `${dueDateColor}18` : "transparent",
                          }}
                        >
                          <Text size="xs" style={{ color: quickDate === p.date ? dueDateColor : colors.textSecondary }}>
                            {p.label}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable onPress={() => setShowDatePicker(v => !v)}>
                        <Text size="xs" style={{ color: showDatePicker ? colors.accent : colors.textTertiary }}>
                          Pick date…
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
                {showDatePicker && (
                  <DatePicker
                    value={quickDate}
                    onChange={d => { setQuickDate(d ?? undefined); setShowDatePicker(false); }}
                  />
                )}
              </View>

              {/* Category row */}
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[1.5], flexWrap: "wrap" }}>
                <Text size="xs" style={{ color: colors.textTertiary, width: 32, marginTop: 3 }}>Cat.</Text>
                <View style={{ flex: 1, gap: spacing[1.5] }}>
                  <View style={{ flexDirection: "row", gap: spacing[1.5] }}>
                    {([["personal", "Personal", "#88C0D0"], ["uni", "Uni", "#B48EAD"]] as [TaskCategory, string, string][]).map(([cat, label, color]) => (
                      <Pressable
                        key={cat}
                        onPress={() => setQuickCat(c => c === cat ? undefined : cat)}
                        style={{
                          paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
                          borderRadius: 99, borderWidth: 1,
                          borderColor: quickCat === cat ? color : colors.bgBorder,
                          backgroundColor: quickCat === cat ? `${color}18` : "transparent",
                        }}
                      >
                        <Text size="xs" style={{ color: quickCat === cat ? color : colors.textSecondary }}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {quickCat === "uni" && (
                    <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
                      {UNI_COURSES.map(course => (
                        <Pressable
                          key={course}
                          onPress={() => setQuickCourse(course)}
                          style={{
                            paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
                            borderRadius: 99, borderWidth: 1,
                            borderColor: quickCourse === course ? "#B48EAD" : colors.bgBorder,
                            backgroundColor: quickCourse === course ? "#B48EAD18" : "transparent",
                          }}
                        >
                          <Text size="xs" style={{ color: quickCourse === course ? "#B48EAD" : colors.textSecondary }}>{course}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </Surface>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ label, tasks, expandedId, onToggleExpand, emptyMessage, selectMode, selectedIds, onSelect, onDelete, onReorderUp, onReorderDown, onReorder, highlightId, onTaskMeasureY, sortBy = "priority", onLongPress, persistCollapse }: {
  label: string; tasks: Task[]; expandedId: string | null;
  onToggleExpand: (id: string) => void; emptyMessage?: string;
  selectMode: boolean; selectedIds: Set<string>;
  onSelect: (id: string) => void; onDelete: (id: string) => void;
  onReorderUp: (id: string) => void; onReorderDown: (id: string) => void;
  onReorder: (newOrder: Task[]) => void;
  highlightId?: string | null;
  onTaskMeasureY?: (id: string, y: number) => void;
  sortBy?: SortBy;
  onLongPress?: (id: string) => void;
  persistCollapse?: string;
}) {
  const { colors } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  // Load persisted collapse state
  useEffect(() => {
    if (!persistCollapse) return;
    storage.get<boolean>(persistCollapse).then(val => {
      if (val !== null && val !== undefined) setCollapsed(val);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (persistCollapse) storage.set(persistCollapse, next);
  }

  if (tasks.length === 0 && !emptyMessage) return null;

  const sorted = applySort(tasks, sortBy);

  const isOverdueSection    = label.toLowerCase().startsWith("overdue");
  const isCompletedSection  = label.toLowerCase().startsWith("completed");

  const labelColor = isOverdueSection
    ? colors.danger
    : isCompletedSection
    ? colors.textTertiary
    : colors.textSecondary;

  const labelSize = isOverdueSection ? 12 : 11;

  const renderItem = ({ item: t, drag, isActive }: RenderItemParams<Task>) => (
    <ScaleDecorator>
      <TaskItem
        task={t}
        isExpanded={expandedId === t.id}
        onToggleExpand={() => onToggleExpand(t.id)}
        selectMode={selectMode}
        selected={selectedIds.has(t.id)}
        onSelect={() => onSelect(t.id)}
        onReorderUp={() => onReorderUp(t.id)}
        onReorderDown={() => onReorderDown(t.id)}
        onDelete={() => onDelete(t.id)}
        onDragStart={drag}
        isDragging={isActive}
        highlighted={highlightId === t.id}
        onMeasureY={y => onTaskMeasureY?.(t.id, y)}
        onLongPress={() => onLongPress?.(t.id)}
      />
    </ScaleDecorator>
  );

  return (
    <View style={{ marginBottom: spacing[6] }}>
      <Pressable
        onPress={toggleCollapsed}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: collapsed ? 0 : spacing[3] }}
      >
        <Text style={{
          fontSize: labelSize, letterSpacing: 1,
          color: labelColor,
          fontFamily: fontFamily.semibold,
          textTransform: "uppercase",
        }}>
          {label}
        </Text>
        {tasks.length > 0 && (
          <View style={{
            backgroundColor: isOverdueSection ? `${colors.danger}20` : colors.bgTertiary,
            borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1,
          }}>
            <Text size="xs" style={{ color: isOverdueSection ? colors.danger : colors.textTertiary }}>{tasks.length}</Text>
          </View>
        )}
        <Text size="xs" style={{ color: colors.textTertiary, marginLeft: "auto" }}>{collapsed ? "▾" : "▴"}</Text>
      </Pressable>
      {!collapsed && (
        tasks.length === 0 && emptyMessage ? (
          <Surface>
            <View style={{ padding: spacing[5], alignItems: "center" }}>
              <Text size="sm" secondary>{emptyMessage}</Text>
            </View>
          </Surface>
        ) : (
          <DraggableFlatList
            data={sorted}
            keyExtractor={t => t.id}
            renderItem={renderItem}
            onDragEnd={({ data }) => onReorder(data)}
            scrollEnabled={false}
            activationDistance={Platform.OS === "web" ? 999 : 20}
            removeClippedSubviews={Platform.OS !== "web"}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        )
      )}
    </View>
  );
}

// ─── Empty detail state ───────────────────────────────────────────────────────

function EmptyDetailPane({ open }: { open: Task[] }) {
  const { colors } = useTheme();
  const counts = PRIORITY_ORDER.map(p => ({ p, count: open.filter(t => t.priority === p).length })).filter(x => x.count > 0);
  const noPriority = open.filter(t => !t.priority).length;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], padding: spacing[6] }}>
      <Ionicons name="checkbox-outline" size={40} color={colors.textTertiary} />
      <View style={{ alignItems: "center", gap: spacing[1] }}>
        <Text size="sm" secondary>Select a task to view details</Text>
        {open.length > 0 && (
          <Text size="xs" style={{ color: colors.textTertiary }}>{open.length} open task{open.length !== 1 ? "s" : ""}</Text>
        )}
      </View>
      {(counts.length > 0 || noPriority > 0) && (
        <View style={{ gap: spacing[1.5], alignItems: "flex-start" }}>
          {counts.map(({ p, count }) => (
            <View key={p} style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: PRIORITY_CONFIG[p].color }} />
              <Text size="xs" secondary>{count} {PRIORITY_CONFIG[p].label}</Text>
            </View>
          ))}
          {noPriority > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: colors.bgBorder }} />
              <Text size="xs" secondary>{noPriority} No priority</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const { colors } = useTheme();
  const { tasks, addTask, loaded, syncStatus, syncNow, deleteTask, archiveTask, unarchiveTask, toggleTask, reorderTask, setSectionOrder, updateTask } = useTasks();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ create?: string; taskId?: string; filter?: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 1024;

  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [search, setSearch]                 = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | null>(null);
  const [focusMode, setFocusMode]           = useState(false);
  const [selectMode, setSelectMode]         = useState(false);
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId]       = useState<string | null>(null);
  const [sortBy, setSortBy]                 = useState<SortBy>("priority");
  const [grouped, setGrouped]               = useState(true);
  const [showArchive, setShowArchive]       = useState(false);
  const addInputRef    = useRef<TextInput | null>(null);
  const scrollViewRef  = useRef<RNScrollView>(null);
  const taskYPositions = useRef<Record<string, number>>({});

  const handleTaskMeasureY = useCallback((id: string, y: number) => {
    taskYPositions.current[id] = y;
  }, []);

  useEffect(() => {
    if (params.filter === "overdue" || params.filter === "today") {
      setFocusMode(true);
    }
    if (params.create === "1") {
      setTimeout(() => addInputRef.current?.focus(), 300);
    }
    if (params.taskId) {
      setExpandedId(params.taskId);
      setHighlightId(params.taskId);
      if (isDesktop) setSelectedTaskId(params.taskId);
      setTimeout(() => {
        const y = taskYPositions.current[params.taskId!];
        if (y !== undefined) {
          scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
        }
        setTimeout(() => setHighlightId(null), 2000);
      }, 350);
    }
  }, [params.create, params.taskId, isDesktop]);

  // Keyboard shortcuts (web)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); addInputRef.current?.focus(); }
      if (e.key === "Escape") { setExpandedId(null); setSelectedTaskId(null); setSelectMode(false); setSelectedIds(new Set()); }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); setFocusMode(v => !v); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleAdd = useCallback((title: string, due_date?: string, category?: TaskCategory, uniCourse?: UniCourse) => {
    const id = addTask(title, due_date);
    if (category) updateTask(id, { category, uniCourse: category === "uni" ? uniCourse : undefined });
    setExpandedId(id);
    if (isDesktop) setSelectedTaskId(id);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [addTask, updateTask, isDesktop]);

  const handleToggleExpand = useCallback((id: string) => {
    if (isDesktop) {
      setSelectedTaskId(prev => prev === id ? null : id);
    } else {
      setExpandedId(prev => prev === id ? null : id);
      setSelectedTaskId(id);
      setShowMobileDetail(true);
    }
  }, [isDesktop]);

  const handleDelete = useCallback((id: string) => {
    const undo = deleteTask(id);
    setExpandedId(null);
    if (selectedTaskId === id) { setSelectedTaskId(null); setShowMobileDetail(false); }
    showToast("Task deleted", { label: "Undo", onPress: undo });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [deleteTask, showToast, selectedTaskId]);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleLongPress = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  function handleBulkComplete() {
    selectedIds.forEach(id => { const t = tasks.find(t => t.id === id); if (t && !t.done) toggleTask(id); });
    showToast(`${selectedIds.size} task${selectedIds.size !== 1 ? "s" : ""} completed`);
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  function handleBulkDelete() {
    const count = selectedIds.size;
    const undos: Array<() => void> = [];
    selectedIds.forEach(id => undos.push(deleteTask(id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    showToast(`${count} task${count !== 1 ? "s" : ""} deleted`, {
      label: "Undo", onPress: () => undos.forEach(u => u()),
    });
  }

  const visible = tasks.filter(t =>
    !t.archived &&
    matchesSearch(t, search) &&
    (filterPriority ? t.priority === filterPriority : true)
  );

  const overdue   = visible.filter(isOverdue);
  const today     = visible.filter(isToday);
  const scheduled = visible.filter(isScheduled);
  const someday   = visible.filter(isSomeday);
  const done      = visible.filter(t => t.done);
  const open      = tasks.filter(t => !t.done && !t.archived);
  const archived  = tasks.filter(t => t.archived);
  const focusTasks = [...overdue, ...today];

  const effectiveExpandedId = isDesktop ? selectedTaskId : expandedId;
  const sectionProps = {
    expandedId: effectiveExpandedId,
    onToggleExpand: handleToggleExpand,
    selectMode, selectedIds,
    onSelect: handleSelect,
    onDelete: handleDelete,
    onReorderUp: (id: string) => reorderTask(id, "up"),
    onReorderDown: (id: string) => reorderTask(id, "down"),
    onReorder: setSectionOrder,
    highlightId, onTaskMeasureY: handleTaskMeasureY,
    sortBy, onLongPress: handleLongPress,
  };

  // Sync pill
  const [pillText, setPillText] = useState<string | null>(null);
  useEffect(() => {
    if (syncStatus === "syncing") {
      setPillText("Syncing…");
    } else if (syncStatus === "synced") {
      setPillText("Synced ✓");
      const t = setTimeout(() => setPillText(null), 2000);
      return () => clearTimeout(t);
    } else {
      setPillText(null);
    }
  }, [syncStatus]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);

  if (!loaded) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text size="sm" secondary>Loading…</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
      {/* Sync status pill */}
      {pillText && (
        <View style={{ alignItems: "center", paddingVertical: spacing[1] }}>
          <View style={{ backgroundColor: `${colors.accent}20`, borderRadius: 99, paddingHorizontal: spacing[3], paddingVertical: 3 }}>
            <Text size="xs" style={{ color: colors.accent }}>{pillText}</Text>
          </View>
        </View>
      )}

      <View style={{ flex: 1, flexDirection: isDesktop ? "row" : "column" }}>
      <KeyboardAvoidingView
        style={{
          flex: isDesktop ? undefined : 1,
          width: isDesktop ? "40%" : undefined,
          borderRightWidth: isDesktop ? 1 : 0,
          borderRightColor: colors.bgBorder,
          overflow: "hidden",
        }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16], ...webContentStyle }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
          }
        >
          {/* Header */}
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5] }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text size="2xl" weight="bold">Tasks</Text>
              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                <Pressable
                  onPress={() => setFocusMode(v => !v)}
                  style={{
                    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
                    borderRadius: radius.sm, borderWidth: 1,
                    borderColor: focusMode ? colors.accent : colors.bgBorder,
                    backgroundColor: focusMode ? `${colors.accent}18` : "transparent",
                  }}
                >
                  <Text size="xs" weight="medium" style={{ color: focusMode ? colors.accent : colors.textSecondary }}>
                    {focusMode ? "⚡ Focus" : "Focus"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
                  style={{
                    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
                    borderRadius: radius.sm, borderWidth: 1,
                    borderColor: selectMode ? colors.accent : colors.bgBorder,
                    backgroundColor: selectMode ? `${colors.accent}18` : "transparent",
                  }}
                >
                  <Text size="xs" weight="medium" style={{ color: selectMode ? colors.accent : colors.textSecondary }}>
                    {selectMode ? "Cancel" : "Select"}
                  </Text>
                </Pressable>
                {archived.length > 0 && (
                  <Pressable
                    onPress={() => setShowArchive(v => !v)}
                    style={{
                      paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
                      borderRadius: radius.sm, borderWidth: 1,
                      borderColor: showArchive ? colors.accent : colors.bgBorder,
                      backgroundColor: showArchive ? `${colors.accent}18` : "transparent",
                    }}
                  >
                    <Text size="xs" weight="medium" style={{ color: showArchive ? colors.accent : colors.textSecondary }}>
                      Archive{archived.length > 0 ? ` · ${archived.length}` : ""}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
            <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
              {open.length > 0 ? `${open.length} open` : "All done"}
            </Text>
          </View>

          <AddTaskRow onAdd={handleAdd} inputRef={addInputRef} />

          <SearchBar value={search} onChange={setSearch} placeholder="Search tasks…" />
          <View style={{ flexDirection: "row", gap: spacing[1.5], flexWrap: "wrap", marginBottom: spacing[3] }}>
            {(Object.entries(PRIORITY_CONFIG) as [Priority, { label: string; color: string }][]).map(([key, cfg]) => (
              <Chip key={key} label={cfg.label} color={cfg.color} active={filterPriority === key}
                onPress={() => setFilterPriority(p => p === key ? null : key)} />
            ))}
          </View>

          {/* Sort / Group bar */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], flexWrap: "wrap", marginBottom: spacing[4] }}>
            {!focusMode && (
              <>
                <Pressable
                  onPress={() => setGrouped(v => !v)}
                  style={{
                    paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
                    borderRadius: radius.sm, borderWidth: 1,
                    borderColor: colors.bgBorder, backgroundColor: colors.bgTertiary,
                    flexDirection: "row", alignItems: "center", gap: 4,
                  }}
                >
                  <Text size="xs" style={{ color: colors.textSecondary }}>{grouped ? "Grouped" : "Flat"}</Text>
                </Pressable>
                <View style={{ width: 1, height: 14, backgroundColor: colors.bgBorder }} />
              </>
            )}
            {([["priority", "Priority"], ["due_date", "Due date"], ["title", "A–Z"], ["created", "Added"]] as [SortBy, string][]).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setSortBy(key)}
                style={{
                  paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
                  borderRadius: radius.sm, borderWidth: 1,
                  borderColor: sortBy === key ? colors.accent : colors.bgBorder,
                  backgroundColor: sortBy === key ? `${colors.accent}15` : "transparent",
                }}
              >
                <Text size="xs" style={{ color: sortBy === key ? colors.accent : colors.textSecondary }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {focusMode ? (
            focusTasks.length === 0 ? (
              <EmptyState type="tasks" title="All clear" subtitle="No overdue or due-today tasks — enjoy the moment." />
            ) : (
              <Section label={`Focus · ${focusTasks.length}`} tasks={focusTasks} {...sectionProps} />
            )
          ) : tasks.length === 0 ? (
            <EmptyState type="tasks" title="No tasks yet" subtitle={'Tap the field above or press "N" to add your first task.'} />
          ) : !grouped ? (
            <>
              <Section
                label="All tasks"
                tasks={applySort(visible.filter(t => !t.done), sortBy)}
                {...sectionProps}
                sortBy="created"
              />
              {done.length > 0 && (
                <Section label="Completed" tasks={done} {...sectionProps} sortBy="created" persistCollapse="tasks_section_collapsed_completed" />
              )}
            </>
          ) : (
            <>
              {overdue.length > 0 && <Section label="Overdue" tasks={overdue} {...sectionProps} />}
              {today.length > 0   && <Section label="Today"   tasks={today}   {...sectionProps} />}
              <Section label="Scheduled" tasks={scheduled} {...sectionProps} />
              <Section label="Someday"   tasks={someday}   {...sectionProps} emptyMessage="No tasks without a due date" />
              {done.length > 0    && <Section label="Completed" tasks={done}  {...sectionProps} persistCollapse="tasks_section_collapsed_completed" />}
            </>
          )}

          {/* ── Archive ─────────────────────────────────────────────────── */}
          {showArchive && archived.length > 0 && (
            <View style={{ marginTop: spacing[4] }}>
              <Text size="xs" weight="semibold" style={{
                textTransform: "uppercase", letterSpacing: 1.2,
                color: colors.textTertiary, fontSize: 11, marginBottom: spacing[3],
              }}>
                Archive · {archived.length}
              </Text>
              <Surface style={{ overflow: "hidden", padding: 0 }}>
                {archived.map((task, i) => (
                  <View key={task.id} style={{
                    flexDirection: "row", alignItems: "center",
                    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
                    gap: spacing[3],
                    borderBottomWidth: i === archived.length - 1 ? 0 : 1,
                    borderBottomColor: colors.bgBorder,
                  }}>
                    <View style={{
                      width: 18, height: 18, borderRadius: 9,
                      backgroundColor: colors.bgBorder,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <View style={{ width: 8, height: 4, borderLeftWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.textTertiary, transform: [{ rotate: "-45deg" }, { translateY: -1 }] }} />
                    </View>
                    <Text size="sm" style={{ flex: 1, color: colors.textTertiary, textDecorationLine: "line-through", opacity: 0.7 }} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Pressable onPress={() => unarchiveTask(task.id)} hitSlop={8}>
                      <Text size="xs" style={{ color: colors.accent }}>Restore</Text>
                    </Pressable>
                    <Pressable onPress={() => deleteTask(task.id)} hitSlop={8}>
                      <Text size="xs" style={{ color: colors.textTertiary }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </Surface>
            </View>
          )}
        </ScrollView>

        {selectMode && (
          <View style={{
            flexDirection: "row", gap: spacing[2], padding: spacing[3],
            backgroundColor: colors.bgSecondary,
            borderTopWidth: 1, borderTopColor: colors.bgBorder,
            flexWrap: "wrap",
          }}>
            <Text size="sm" secondary style={{ alignSelf: "center", marginRight: spacing[1] }}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select tasks"}
            </Text>
            {selectedIds.size > 0 && (
              <>
                <Pressable onPress={handleBulkComplete}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: colors.accent }}>
                  <Text size="sm" weight="medium" style={{ color: "#fff" }}>Complete</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    selectedIds.forEach(id => updateTask(id, { due_date: getTodayStr() }));
                    showToast(`Due date set to today for ${selectedIds.size} task${selectedIds.size !== 1 ? "s" : ""}`);
                    setSelectedIds(new Set());
                    setSelectMode(false);
                  }}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder }}>
                  <Text size="sm" weight="medium" style={{ color: colors.textSecondary }}>Today</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    selectedIds.forEach(id => archiveTask(id));
                    showToast(`${selectedIds.size} task${selectedIds.size !== 1 ? "s" : ""} archived`);
                    setSelectedIds(new Set());
                    setSelectMode(false);
                  }}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder }}>
                  <Text size="sm" weight="medium" style={{ color: colors.textSecondary }}>Archive</Text>
                </Pressable>
                <Pressable onPress={handleBulkDelete}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: `${colors.danger}20`, borderWidth: 1, borderColor: `${colors.danger}44` }}>
                  <Text size="sm" weight="medium" style={{ color: colors.danger }}>Delete</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Right column — desktop detail panel */}
      {isDesktop && (
        <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
          {selectedTaskId && tasks.find(t => t.id === selectedTaskId) ? (
            <TaskDetailPanel
              task={tasks.find(t => t.id === selectedTaskId)!}
              onClose={() => setSelectedTaskId(null)}
            />
          ) : (
            <EmptyDetailPane open={open} />
          )}
        </View>
      )}
      </View>

      {/* Mobile task detail modal */}
      {!isDesktop && showMobileDetail && selectedTaskId && tasks.find(t => t.id === selectedTaskId) && (
        <Modal
          visible={showMobileDetail}
          animationType="slide"
          onRequestClose={() => { setShowMobileDetail(false); setSelectedTaskId(null); }}
          statusBarTranslucent
        >
          <GradientBackground>
            <SafeAreaView style={{ flex: 1 }}>
              <TaskDetailPanel
                task={tasks.find(t => t.id === selectedTaskId)!}
                onClose={() => { setShowMobileDetail(false); setSelectedTaskId(null); }}
              />
            </SafeAreaView>
          </GradientBackground>
        </Modal>
      )}
      </SafeAreaView>
    </GradientBackground>
  );
}
