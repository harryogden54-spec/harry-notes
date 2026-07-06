import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Pressable, TextInput, Modal, Platform, ScrollView,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, fontFamily, getShadow, THEMES, type ThemeId } from "@/lib/theme";
import { getTodayStr, getTomorrowStr, parseNaturalDate } from "@/lib/utils";
import { type TaskCategory, type UniCourse, UNI_COURSES, useTasksData } from "@/lib/TasksContext";
import { useNotesData, useNotesActions } from "@/lib/NotesContext";
import { useThemeContext } from "@/lib/ThemeContext";
import { DatePicker } from "@/components/ui/DatePicker";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, dueDate?: string, category?: TaskCategory, uniCourse?: UniCourse) => void;
}

// ─── Command item types ───────────────────────────────────────────────────────

type CmdItem =
  | { kind: "action"; id: string; icon: IoniconName; label: string; run: () => void }
  | { kind: "nav";    id: string; icon: IoniconName; label: string; run: () => void }
  | { kind: "recent"; id: string; icon: IoniconName; label: string; sub: string; run: () => void }
  | { kind: "theme";  id: string; label: string; active: boolean; run: () => void };

function matches(text: string, q: string) {
  return !q || text.toLowerCase().includes(q.toLowerCase());
}

// ─── Task creation subform ────────────────────────────────────────────────────

function TaskCreateForm({ initialTitle, onAdd, onClose, colors }: {
  initialTitle: string;
  onAdd: Props["onAdd"];
  onClose: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const [title, setTitle]           = useState(initialTitle);
  const [quickDate, setQuickDate]   = useState<"none" | "today" | "tomorrow" | "custom">("none");
  const [customDate, setCustomDate] = useState<string | undefined>();
  const [showPicker, setShowPicker] = useState(false);
  const [showMore, setShowMore]     = useState(false);
  const [category, setCategory]     = useState<TaskCategory | undefined>();
  const [uniCourse, setUniCourse]   = useState<UniCourse>("Misc");
  const inputRef = useRef<TextInput | null>(null);
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const nlp = title.trim() ? parseNaturalDate(title) : { date: null, cleanText: title };
  const nlpDate = quickDate === "none" ? nlp.date : null;

  function getEffectiveDate(): string | undefined {
    if (quickDate === "today")    return today;
    if (quickDate === "tomorrow") return tomorrow;
    if (quickDate === "custom")   return customDate;
    if (nlpDate)                  return nlpDate;
    return undefined;
  }

  function submit() {
    const raw = title.trim();
    if (!raw) return;
    const finalTitle = (quickDate === "none" && nlpDate) ? nlp.cleanText || raw : raw;
    onAdd(finalTitle, getEffectiveDate(), category, category === "uni" ? uniCourse : undefined);
    onClose();
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="arrow-back-outline" size={18} color={colors.textTertiary} />
        </Pressable>
        <Text size="base" weight="semibold" style={{ flex: 1 }}>New task</Text>
        <Pressable onPress={onClose} hitSlop={12}
          style={{ width: 24, height: 24, borderRadius: 99, backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="close-outline" size={14} color={colors.textTertiary} />
        </Pressable>
      </View>

      <TextInput
        ref={inputRef}
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        placeholder="Task title…"
        placeholderTextColor={colors.textTertiary}
        returnKeyType="done"
        style={[
          { color: colors.textPrimary, fontSize: 16, fontFamily: fontFamily.medium, paddingVertical: spacing[3], paddingHorizontal: spacing[3], backgroundColor: colors.bgTertiary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />

      {nlpDate && quickDate === "none" && (
        <Animated.View entering={FadeIn.duration(150)} style={{
          flexDirection: "row", alignItems: "center", gap: spacing[2],
          paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
          backgroundColor: `${colors.accent}14`, borderRadius: radius.lg,
          borderWidth: 1, borderColor: `${colors.accent}30`, alignSelf: "flex-start",
        }}>
          <Ionicons name="calendar-outline" size={12} color={colors.accent} />
          <Text size="xs" weight="medium" style={{ color: colors.accent }}>
            {new Date(nlpDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </Text>
          <Text size="xs" style={{ color: `${colors.accent}80` }}>detected</Text>
        </Animated.View>
      )}

      <View style={{ gap: spacing[1.5] }}>
        <Text size="xs" style={{ color: colors.textTertiary, fontFamily: fontFamily.medium }}>Date</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5] }}>
          {(["none", "today", "tomorrow", "custom"] as const).map(opt => {
            const labels = { none: "No date", today: "Today", tomorrow: "Tomorrow", custom: "Custom" };
            const active = quickDate === opt;
            return (
              <Pressable key={opt} onPress={() => { setQuickDate(opt); if (opt === "custom") setShowPicker(true); else setShowPicker(false); }}
                style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.xl, borderWidth: 1, borderColor: active ? colors.accent : colors.bgBorder, backgroundColor: active ? `${colors.accent}18` : "transparent" }}>
                <Text size="xs" weight={active ? "semibold" : undefined} style={{ color: active ? colors.accent : colors.textSecondary }}>
                  {opt === "custom" && customDate && active ? new Date(customDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : labels[opt]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {showPicker && <DatePicker value={customDate} onChange={(d) => { setCustomDate(d ?? undefined); setShowPicker(false); }} />}
      </View>

      <Pressable onPress={() => setShowMore(v => !v)} style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
        <Ionicons name={showMore ? "chevron-up" : "chevron-down"} size={12} color={colors.textTertiary} />
        <Text size="xs" style={{ color: colors.textTertiary }}>More options</Text>
        {category && <Text size="xs" style={{ color: colors.accent }}> · {category}</Text>}
      </Pressable>

      {showMore && (
        <View style={{ gap: spacing[1.5] }}>
          <Text size="xs" style={{ color: colors.textTertiary, fontFamily: fontFamily.medium }}>Category</Text>
          <View style={{ flexDirection: "row", gap: spacing[1.5] }}>
            {([["personal", "Personal"], ["uni", "Uni"]] as [TaskCategory, string][]).map(([cat, label]) => (
              <Pressable key={cat} onPress={() => setCategory(c => c === cat ? undefined : cat)}
                style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.xl, borderWidth: 1, borderColor: category === cat ? colors.accent : colors.bgBorder, backgroundColor: category === cat ? `${colors.accent}18` : "transparent" }}>
                <Text size="xs" weight={category === cat ? "semibold" : undefined} style={{ color: category === cat ? colors.accent : colors.textSecondary }}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {category === "uni" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
              {UNI_COURSES.map(course => (
                <Pressable key={course} onPress={() => setUniCourse(course)}
                  style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[0.5], borderRadius: 99, borderWidth: 1, borderColor: uniCourse === course ? colors.accent : colors.bgBorder, backgroundColor: uniCourse === course ? `${colors.accent}18` : "transparent" }}>
                  <Text size="xs" style={{ color: uniCourse === course ? colors.accent : colors.textSecondary }}>{course}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      <Pressable onPress={submit} style={{ backgroundColor: title.trim() ? colors.accent : colors.bgTertiary, borderRadius: radius.lg, paddingVertical: spacing[3], alignItems: "center" }}>
        <Text size="sm" weight="semibold" style={{ color: title.trim() ? colors.textInverse : colors.textTertiary }}>Add task</Text>
      </Pressable>
    </View>
  );
}

// ─── Main palette ─────────────────────────────────────────────────────────────

export function QuickAddModal({ visible, onClose, onAdd }: Props) {
  const { colors, scheme } = useTheme();
  const router = useRouter();
  const { tasks } = useTasksData();
  const { notes } = useNotesData();
  const { addNote, updateNote } = useNotesActions();
  const { themeId, setThemeId } = useThemeContext();

  const [query, setQuery]       = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [mode, setMode]         = useState<"palette" | "add-task">("palette");
  const inputRef = useRef<TextInput | null>(null);

  // Reset on open/close
  useEffect(() => {
    if (visible) {
      setQuery("");
      setActiveIdx(0);
      setMode("palette");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  // Build command items
  const items: CmdItem[] = useMemo(() => {
    const q = query;
    const result: CmdItem[] = [];

    // ── Actions ──────────────────────────────────────────────────────────────
    if (matches("New note", q))
      result.push({ kind: "action", id: "new-note", icon: "document-text-outline", label: "New note", run: () => { onClose(); setTimeout(() => router.push("/(tabs)/notes?create=1" as any), 50); } });

    // ── Navigation ────────────────────────────────────────────────────────────
    const navItems = [
      { label: "Go to Today",  icon: "today-outline" as IoniconName, path: "/(tabs)/today" },
      { label: "Go to Tasks",  icon: "checkbox-outline" as IoniconName, path: "/(tabs)/tasks" },
      { label: "Go to Notes",  icon: "document-text-outline" as IoniconName, path: "/(tabs)/notes" },
    ];
    for (const n of navItems) {
      if (matches(n.label, q))
        result.push({ kind: "nav", id: `nav-${n.path}`, icon: n.icon, label: n.label, run: () => { onClose(); router.push(n.path as any); } });
    }

    // ── Recent items ──────────────────────────────────────────────────────────
    const recent = [
      ...tasks.filter(t => !t.archived).map(t => ({ label: t.title, sub: "Task", stamp: t.updated_at ?? t.created_at ?? "", run: () => { onClose(); router.push(`/(tabs)/tasks?taskId=${t.id}` as any); } })),
      ...notes.filter(n => !n.archived).map(n => ({ label: n.title || "Untitled", sub: "Note", stamp: n.updated_at ?? n.created_at, run: () => { onClose(); router.push(`/(tabs)/notes?openId=${n.id}` as any); } })),
    ]
      .sort((a, b) => (b.stamp ?? "").localeCompare(a.stamp ?? ""))
      .filter(r => matches(r.label, q))
      .slice(0, 5);

    for (const r of recent) {
      result.push({ kind: "recent", id: `recent-${r.label}-${r.sub}`, icon: r.sub === "Task" ? "checkbox-outline" : r.sub === "Note" ? "document-text-outline" : "list-outline", label: r.label, sub: r.sub, run: r.run });
    }

    // ── Themes ────────────────────────────────────────────────────────────────
    for (const [id, def] of Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]) {
      if (matches(def.label, q))
        result.push({ kind: "theme", id: `theme-${id}`, label: def.label, active: themeId === id, run: () => setThemeId(id) });
    }

    return result;
  }, [query, tasks, notes, themeId, setThemeId, router, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (Platform.OS !== "web" || !visible || mode !== "palette") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, items.length)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        if (activeIdx === 0) {
          // First slot = create task from query text
          if (query.trim()) { onAdd(query.trim()); onClose(); }
          return;
        }
        const item = items[activeIdx - 1];
        if (item) item.run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, mode, items, activeIdx, query, onAdd, onClose]);

  // Reset activeIdx when items change
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Feature 4: create a note pre-seeded with [[Task title]] and navigate to it.
  function handleTakeNote(taskTitle: string) {
    const id = addNote();
    updateNote(id, {
      title: `Notes: ${taskTitle}`,
      body: `[[${taskTitle}]]\n\n`,
    });
    onClose();
    setTimeout(() => router.push(`/(tabs)/notes?openId=${id}` as any), 50);
  }

  const content = (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-start", paddingTop: Platform.OS === "web" ? 80 : 60 }}>
      <Pressable onPress={onClose} style={{ position: "absolute", inset: 0 } as any} />
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={{
          backgroundColor: colors.bgSecondary, borderRadius: radius["2xl"],
          borderWidth: 1, borderColor: colors.bgBorder,
          padding: spacing[5], gap: spacing[3],
          width: "90%" as any, maxWidth: 480,
          ...getShadow("overlay", scheme),
          maxHeight: Platform.OS === "web" ? "70vh" as any : 560,
        }}
      >
        {mode === "add-task" ? (
          <TaskCreateForm initialTitle={query} onAdd={onAdd} onClose={onClose} colors={colors} />
        ) : (
          <>
            {/* Search input */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], backgroundColor: colors.bgTertiary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder, paddingHorizontal: spacing[3] }}>
              <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => { if (query.trim()) { onAdd(query.trim()); onClose(); } }}
                placeholder="Search or add task…"
                placeholderTextColor={colors.textTertiary}
                returnKeyType="done"
                style={[
                  { flex: 1, color: colors.textPrimary, fontSize: 15, fontFamily: fontFamily.regular, paddingVertical: spacing[3] },
                  // @ts-ignore
                  { outlineStyle: "none" },
                ]}
              />
              <View style={{ backgroundColor: colors.bgSecondary, borderRadius: radius.sm, paddingHorizontal: spacing[1.5], paddingVertical: 2, borderWidth: 1, borderColor: colors.bgBorder }}>
                <Text style={{ fontSize: 10, fontFamily: "monospace" as any, color: colors.textTertiary }}>Esc</Text>
              </View>
            </View>

            {/* New task hint */}
            <Pressable
              onPress={() => setMode("add-task")}
              style={[{
                flexDirection: "row", alignItems: "center", gap: spacing[2],
                paddingHorizontal: spacing[3], paddingVertical: spacing[2.5],
                borderRadius: radius.lg, borderWidth: 1,
                borderColor: activeIdx === 0 ? colors.accent : colors.bgBorder,
                backgroundColor: activeIdx === 0 ? `${colors.accent}10` : "transparent",
              }]}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
              <Text size="sm" style={{ flex: 1, color: colors.textPrimary }}>
                {query.trim() ? `Create task "${query.trim()}"` : "New task…"}
              </Text>
              <Text style={{ fontSize: 10, fontFamily: "monospace" as any, color: colors.textTertiary }}>↵</Text>
            </Pressable>

            {/* Command list */}
            {items.length > 0 && (
              <ScrollView
                style={{ maxHeight: 300 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Section: Actions */}
                {items.filter(i => i.kind === "action").length > 0 && (
                  <View style={{ marginBottom: spacing[2] }}>
                    <Text style={{ fontSize: 10, fontFamily: fontFamily.semibold, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[1], paddingHorizontal: spacing[1] }}>Actions</Text>
                    {items.filter(i => i.kind === "action").map((item, idx) => {
                      const flatIdx = items.indexOf(item) + 1;
                      return (
                        <Pressable key={item.id} onPress={item.run}
                          style={{ flexDirection: "row", alignItems: "center", gap: spacing[2.5], paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: activeIdx === flatIdx ? `${colors.accent}10` : "transparent" }}>
                          {"icon" in item && <Ionicons name={item.icon} size={15} color={colors.accent} />}
                          <Text size="sm" style={{ color: colors.textPrimary }}>{item.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Section: Navigate */}
                {items.filter(i => i.kind === "nav").length > 0 && (
                  <View style={{ marginBottom: spacing[2] }}>
                    <Text style={{ fontSize: 10, fontFamily: fontFamily.semibold, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[1], paddingHorizontal: spacing[1] }}>Navigate</Text>
                    {items.filter(i => i.kind === "nav").map((item) => {
                      const flatIdx = items.indexOf(item) + 1;
                      return (
                        <Pressable key={item.id} onPress={item.run}
                          style={{ flexDirection: "row", alignItems: "center", gap: spacing[2.5], paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: activeIdx === flatIdx ? `${colors.accent}10` : "transparent" }}>
                          {"icon" in item && <Ionicons name={item.icon} size={15} color={colors.textSecondary} />}
                          <Text size="sm" style={{ color: colors.textPrimary }}>{item.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Section: Recent */}
                {items.filter(i => i.kind === "recent").length > 0 && (
                  <View style={{ marginBottom: spacing[2] }}>
                    <Text style={{ fontSize: 10, fontFamily: fontFamily.semibold, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[1], paddingHorizontal: spacing[1] }}>Recent</Text>
                    {items.filter(i => i.kind === "recent").map((item) => {
                      const flatIdx = items.indexOf(item) + 1;
                      const isActive = activeIdx === flatIdx;
                      const isTask = "sub" in item && item.sub === "Task";
                      return (
                        <View key={item.id}>
                          <Pressable onPress={item.run}
                            style={{ flexDirection: "row", alignItems: "center", gap: spacing[2.5], paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: isActive ? `${colors.accent}10` : "transparent" }}>
                            {"icon" in item && <Ionicons name={item.icon} size={15} color={colors.textTertiary} />}
                            <Text size="sm" style={{ flex: 1, color: colors.textPrimary }} numberOfLines={1}>{item.label}</Text>
                            {"sub" in item && <Text size="xs" style={{ color: colors.textTertiary }}>{item.sub}</Text>}
                          </Pressable>
                          {/* Feature 4: when a task row is active, show "Take note about…" action */}
                          {isActive && isTask && (
                            <Pressable
                              onPress={() => handleTakeNote(item.label)}
                              style={{
                                flexDirection: "row", alignItems: "center", gap: spacing[2],
                                marginLeft: spacing[6], marginBottom: spacing[1],
                                paddingHorizontal: spacing[2.5], paddingVertical: spacing[1.5],
                                borderRadius: radius.md, borderWidth: 1,
                                borderColor: `${colors.accent}40`,
                                backgroundColor: `${colors.accent}08`,
                              }}
                            >
                              <Ionicons name="document-text-outline" size={13} color={colors.accent} />
                              <Text size="xs" style={{ color: colors.accent }}>
                                Take note about "{item.label.length > 30 ? item.label.slice(0, 30) + "…" : item.label}"
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Section: Themes */}
                {items.filter(i => i.kind === "theme").length > 0 && (
                  <View>
                    <Text style={{ fontSize: 10, fontFamily: fontFamily.semibold, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[1.5], paddingHorizontal: spacing[1] }}>Themes</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5] }}>
                      {items.filter(i => i.kind === "theme").map(item => (
                        <Pressable key={item.id} onPress={item.run}
                          style={{ paddingHorizontal: spacing[2.5], paddingVertical: spacing[1], borderRadius: radius.xl, borderWidth: 1, borderColor: ("active" in item && item.active) ? colors.accent : colors.bgBorder, backgroundColor: ("active" in item && item.active) ? `${colors.accent}18` : colors.bgTertiary }}>
                          <Text size="xs" style={{ color: ("active" in item && item.active) ? colors.accent : colors.textSecondary }}>{item.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );

  if (Platform.OS === "web") {
    if (!visible) return null;
    return <View style={{ position: "absolute", inset: 0, zIndex: 100 } as any}>{content}</View>;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {content}
    </Modal>
  );
}
