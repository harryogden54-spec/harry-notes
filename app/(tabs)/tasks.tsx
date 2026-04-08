import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, ScrollView, SafeAreaView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, type ScrollView as RNScrollView,
} from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Swipeable } from "react-native-gesture-handler";
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox, Divider, DatePicker, SearchBar, EmptyState, GlassCard } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";
import { useTasks, type Task, type Priority, type TaskCategory, type UniCourse, UNI_COURSES } from "@/lib/TasksContext";
import { useToast } from "@/lib/ToastContext";

// ─── Constants ────────────────────────────────────────────────────────────────

function getTodayStr()    { return new Date().toISOString().slice(0, 10); }
function getTomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
function getNextWeekStr() { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#F26464" },
  high:   { label: "High",   color: "#F5A623" },
  medium: { label: "Medium", color: "#E8C84A" },
  low:    { label: "Low",    color: "#5B6AD0" },
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

function matchesSearch(task: Task, q: string) {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    task.title.toLowerCase().includes(lower) ||
    task.description?.toLowerCase().includes(lower) ||
    task.tags?.some(t => t.includes(lower))
  );
}

function animate() {
  // Intentionally empty — LayoutAnimation removed for Reanimated compat
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
        paddingHorizontal: spacing[2], paddingVertical: 3,
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
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[3], minHeight: 28 }}>
      <Text size="sm" style={{ color: colors.textTertiary, width: 16, marginTop: 2 }}>{icon}</Text>
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
  const dueDateColor = value && value < today ? "#F26464" : value === today ? colors.warning : colors.accent;
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
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
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

// ─── Tags Editor ──────────────────────────────────────────────────────────────

function TagsEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const { colors } = useTheme();
  const [input, setInput] = useState("");

  function addTag() {
    const tag = input.trim().toLowerCase().replace(/^#/, "");
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput("");
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1], alignItems: "center" }}>
      {tags.map(tag => (
        <Chip key={tag} label={`#${tag}`} onRemove={() => onChange(tags.filter(t => t !== tag))} />
      ))}
      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder={tags.length === 0 ? "Add tag…" : "+"}
        placeholderTextColor={colors.textTertiary}
        onSubmitEditing={addTag}
        onKeyPress={(e) => {
          if ((e.nativeEvent as any).key === "," || (e.nativeEvent as any).key === " ") addTag();
        }}
        style={[
          { color: colors.textPrimary, fontSize: 13, minWidth: 60, maxWidth: 120, paddingVertical: 2 },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />
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
    <View style={{ gap: spacing[1] }}>
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[1] }}>
        <View style={{ width: 15, height: 15, borderRadius: 4, borderWidth: 1.5, borderColor: colors.bgBorder }} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Add subtask…"
          placeholderTextColor={colors.textTertiary}
          onSubmitEditing={addSubtask}
          style={[
            { flex: 1, color: colors.textPrimary, fontSize: 13, paddingVertical: 2 },
            // @ts-ignore
            { outlineStyle: "none" },
          ]}
        />
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
  highlighted, onMeasureY,
}: {
  task: Task; isExpanded: boolean; onToggleExpand: () => void;
  selectMode: boolean; selected: boolean; onSelect: () => void;
  onReorderUp: () => void; onReorderDown: () => void;
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

  const priorityColor = task.priority ? PRIORITY_CONFIG[task.priority]?.color : undefined;
  const overdue       = !task.done && !!task.due_date && task.due_date < today;
  const dueDateColor  = overdue ? "#F26464" : task.due_date === today ? colors.warning : colors.textTertiary;
  const subtasks      = task.subtasks ?? [];
  const tags          = task.tags ?? [];
  const doneSubtasks  = subtasks.filter(s => s.done).length;

  function renderLeftActions() {
    if (Platform.OS === "web" || task.done) return null;
    return (
      <View style={{ justifyContent: "center", alignItems: "flex-end", paddingHorizontal: spacing[4], backgroundColor: `${colors.accent}22`, borderRadius: radius.lg, marginBottom: spacing[2], marginRight: spacing[1] }}>
        <Text size="xs" weight="semibold" style={{ color: colors.accent }}>✓ Done</Text>
      </View>
    );
  }

  function renderRightActions() {
    if (Platform.OS === "web") return null;
    return (
      <View style={{ justifyContent: "center", alignItems: "flex-start", paddingHorizontal: spacing[4], backgroundColor: "#F2646422", borderRadius: radius.lg, marginBottom: spacing[2], marginLeft: spacing[1] }}>
        <Text size="xs" weight="semibold" style={{ color: "#F26464" }}>✕ Delete</Text>
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
      <GlassCard
        // @ts-ignore
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderColor: highlighted ? colors.accent : selected ? colors.accent : isExpanded ? (priorityColor ?? colors.accent) : undefined,
          borderWidth: highlighted ? 2 : 1,
          borderLeftWidth: priorityColor && !highlighted ? 3 : highlighted ? 2 : 1,
          borderLeftColor: highlighted ? colors.accent : priorityColor ?? undefined,
          marginBottom: spacing[2],
          opacity: selected ? 0.85 : 1,
        }}
        intensity={18}
      >
        {/* Header row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], padding: spacing[3] }}>
          {selectMode ? (
            <Checkbox checked={selected} onToggle={onSelect} size={16} />
          ) : (
            <Checkbox checked={task.done} onToggle={() => updateTask(task.id, { done: !task.done })} />
          )}
          <Pressable
            onPress={selectMode ? onSelect : onToggleExpand}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing[3] }}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <Text size="sm" weight="medium" style={{
                color: task.done ? colors.textTertiary : colors.textPrimary,
                textDecorationLine: task.done ? "line-through" : "none",
              }}>{task.title}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5], alignItems: "center" }}>
                {task.due_date && <Text size="xs" style={{ color: dueDateColor }}>{formatDate(task.due_date)}</Text>}
                {subtasks.length > 0 && <Text size="xs" style={{ color: colors.textTertiary }}>{doneSubtasks}/{subtasks.length}</Text>}
                {tags.map(tag => <Text key={tag} size="xs" style={{ color: colors.textTertiary }}>#{tag}</Text>)}
                {task.category && <CategoryBadge category={task.category} uniCourse={task.uniCourse} />}
              </View>
            </View>
            {task.priority && <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: priorityColor }} />}
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

        {isExpanded && !selectMode && (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <Divider />
            <View style={{ padding: spacing[3], gap: spacing[4] }}>
              <TextInput
                value={task.title}
                onChangeText={title => updateTask(task.id, { title })}
                multiline
                style={[
                  { color: colors.textPrimary, fontSize: 15, fontWeight: "600", lineHeight: 22 },
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
                numberOfLines={3}
                style={[
                  { color: colors.textSecondary, fontSize: 13, lineHeight: 20, minHeight: 56, textAlignVertical: "top" },
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
              <MetaRow icon="#">
                <TagsEditor tags={tags} onChange={tags => updateTask(task.id, { tags })} />
              </MetaRow>
              <Divider />
              <View style={{ gap: spacing[2] }}>
                <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Subtasks{subtasks.length > 0 ? ` · ${doneSubtasks}/${subtasks.length}` : ""}
                </Text>
                <SubtasksList subtasks={subtasks} onChange={s => updateTask(task.id, { subtasks: s })} />
              </View>
              <Divider />
              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                <Pressable onPress={onDelete}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: "#F2646444", backgroundColor: "#F2646410" }}>
                  <Text size="xs" style={{ color: "#F26464" }}>Delete task</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}
      </GlassCard>
    </Swipeable>
    </View>
  );
}

// ─── Add Task Row ─────────────────────────────────────────────────────────────

function AddTaskRow({ onAdd, inputRef }: { onAdd: (t: string, date?: string) => void; inputRef: React.RefObject<TextInput | null> }) {
  const { colors } = useTheme();
  const [value, setValue]     = useState("");
  const [focused, setFocused] = useState(false);

  function submit() {
    const t = value.trim();
    if (!t) return;
    onAdd(t);
    setValue("");
  }

  return (
    <GlassCard
      style={{
        borderColor: focused ? colors.accent : undefined,
        marginBottom: spacing[4],
      }}
      intensity={18}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[2] + 2, paddingHorizontal: spacing[3] }}>
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
          <Pressable onPress={submit} style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm, backgroundColor: colors.accent }}>
            <Text size="xs" weight="medium" style={{ color: "#fff" }}>Add</Text>
          </Pressable>
        )}
      </View>
    </GlassCard>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ label, tasks, expandedId, onToggleExpand, emptyMessage, selectMode, selectedIds, onSelect, onDelete, onReorderUp, onReorderDown, onReorder, highlightId, onTaskMeasureY }: {
  label: string; tasks: Task[]; expandedId: string | null;
  onToggleExpand: (id: string) => void; emptyMessage?: string;
  selectMode: boolean; selectedIds: Set<string>;
  onSelect: (id: string) => void; onDelete: (id: string) => void;
  onReorderUp: (id: string) => void; onReorderDown: (id: string) => void;
  onReorder: (newOrder: Task[]) => void;
  highlightId?: string | null;
  onTaskMeasureY?: (id: string, y: number) => void;
}) {
  const { colors } = useTheme();
  if (tasks.length === 0 && !emptyMessage) return null;

  const sorted = sortByPriority(tasks);

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
      />
    </ScaleDecorator>
  );

  return (
    <View style={{ marginBottom: spacing[6] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: spacing[3] }}>
        <Text size="xs" weight="semibold" tertiary style={{ textTransform: "uppercase", letterSpacing: 1 }}>{label}</Text>
        {tasks.length > 0 && (
          <View style={{ backgroundColor: colors.bgTertiary, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1 }}>
            <Text size="xs" style={{ color: colors.textTertiary }}>{tasks.length}</Text>
          </View>
        )}
      </View>
      {tasks.length === 0 && emptyMessage ? (
        <GlassCard style={{ borderRadius: radius.lg }} intensity={16}>
          <View style={{ padding: spacing[5], alignItems: "center" }}>
            <Text size="sm" secondary>{emptyMessage}</Text>
          </View>
        </GlassCard>
      ) : (
        <DraggableFlatList
          data={sorted}
          keyExtractor={t => t.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => onReorder(data)}
          scrollEnabled={false}
          activationDistance={Platform.OS === "web" ? 999 : 20}
        />
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const { colors } = useTheme();
  const { tasks, addTask, loaded, deleteTask, toggleTask, reorderTask, setSectionOrder, updateTask } = useTasks();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ create?: string; taskId?: string }>();

  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [search, setSearch]                 = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | null>(null);
  const [focusMode, setFocusMode]           = useState(false);
  const [selectMode, setSelectMode]         = useState(false);
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId]       = useState<string | null>(null);
  const addInputRef    = useRef<TextInput | null>(null);
  const scrollViewRef  = useRef<RNScrollView>(null);
  const taskYPositions = useRef<Record<string, number>>({});

  const handleTaskMeasureY = useCallback((id: string, y: number) => {
    taskYPositions.current[id] = y;
  }, []);

  // Auto-focus add input or expand + scroll to a specific task when navigated here
  useEffect(() => {
    if (params.create === "1") {
      setTimeout(() => addInputRef.current?.focus(), 300);
    }
    if (params.taskId) {
      setExpandedId(params.taskId);
      setHighlightId(params.taskId);
      setTimeout(() => {
        const y = taskYPositions.current[params.taskId!];
        if (y !== undefined) {
          scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
        }
        setTimeout(() => setHighlightId(null), 2000);
      }, 350);
    }
  }, [params.create, params.taskId]);

  // Keyboard shortcuts (web)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); addInputRef.current?.focus(); }
      if (e.key === "Escape") { setExpandedId(null); setSelectMode(false); setSelectedIds(new Set()); }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); setFocusMode(v => !v); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleAdd = useCallback((title: string, due_date?: string) => {
    const id = addTask(title, due_date);
    setExpandedId(id);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [addTask]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    const undo = deleteTask(id);
    setExpandedId(null);
    showToast("Task deleted", { label: "Undo", onPress: undo });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [deleteTask, showToast]);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
    matchesSearch(t, search) &&
    (filterPriority ? t.priority === filterPriority : true)
  );

  const overdue   = visible.filter(isOverdue);
  const today     = visible.filter(isToday);
  const scheduled = visible.filter(isScheduled);
  const someday   = visible.filter(isSomeday);
  const done      = visible.filter(t => t.done);
  const open      = tasks.filter(t => !t.done);
  const focusTasks = [...overdue, ...today];

  const sectionProps = { expandedId, onToggleExpand: handleToggleExpand, selectMode, selectedIds, onSelect: handleSelect, onDelete: handleDelete, onReorderUp: (id: string) => reorderTask(id, "up"), onReorderDown: (id: string) => reorderTask(id, "down"), onReorder: setSectionOrder, highlightId, onTaskMeasureY: handleTaskMeasureY };

  if (!loaded) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: "center", alignItems: "center" }}>
        <Text size="sm" secondary>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {/* Background blobs for glass effect */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <View style={{ position: "absolute", top: -80, right: -60, width: 320, height: 320, borderRadius: 160, backgroundColor: colors.accent, opacity: 0.06 }} />
        <View style={{ position: "absolute", bottom: 60, left: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: colors.accentHover, opacity: 0.04 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16], ...webContentStyle }}
          keyboardShouldPersistTaps="handled"
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
              </View>
            </View>
            <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
              {open.length > 0 ? `${open.length} open` : "All done"}
            </Text>
          </View>

          <AddTaskRow onAdd={handleAdd} inputRef={addInputRef} />

          <SearchBar value={search} onChange={setSearch} placeholder="Search tasks…" />
          <View style={{ flexDirection: "row", gap: spacing[1.5], flexWrap: "wrap", marginBottom: spacing[4] }}>
            {(Object.entries(PRIORITY_CONFIG) as [Priority, { label: string; color: string }][]).map(([key, cfg]) => (
              <Chip key={key} label={cfg.label} color={cfg.color} active={filterPriority === key}
                onPress={() => setFilterPriority(p => p === key ? null : key)} />
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
          ) : (
            <>
              {overdue.length > 0 && <Section label="Overdue" tasks={overdue} {...sectionProps} />}
              {today.length > 0   && <Section label="Today"   tasks={today}   {...sectionProps} />}
              <Section label="Scheduled" tasks={scheduled} {...sectionProps} emptyMessage="No scheduled tasks" />
              <Section label="Someday"   tasks={someday}   {...sectionProps} emptyMessage="No tasks without a due date" />
              {done.length > 0    && <Section label="Completed" tasks={done}  {...sectionProps} />}
            </>
          )}
        </ScrollView>

        {selectMode && selectedIds.size > 0 && (
          <View style={{
            flexDirection: "row", gap: spacing[2], padding: spacing[3],
            backgroundColor: colors.bgSecondary,
            borderTopWidth: 1, borderTopColor: colors.bgBorder,
          }}>
            <Text size="sm" secondary style={{ flex: 1, alignSelf: "center" }}>
              {selectedIds.size} selected
            </Text>
            <Pressable onPress={handleBulkComplete}
              style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: colors.accent }}>
              <Text size="sm" weight="medium" style={{ color: "#fff" }}>Complete</Text>
            </Pressable>
            <Pressable onPress={handleBulkDelete}
              style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: "#F2646420", borderWidth: 1, borderColor: "#F2646444" }}>
              <Text size="sm" weight="medium" style={{ color: "#F26464" }}>Delete</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
