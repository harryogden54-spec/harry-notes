import React, { useState } from "react";
import { View, TextInput, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Divider, DatePicker, Surface } from "@/components/ui";
import { spacing, radius, resolveAccentSwatch } from "@/lib/theme";
import { getTodayStr, getTomorrowStr, getNextWeekStr, parseNaturalDate } from "@/lib/utils";
import { UNI_COURSES, type TaskCategory, type UniCourse, type Priority } from "@/lib/TasksContext";
import { useCategoriesData } from "@/lib/TaskCategoriesContext";
import { Chip } from "./Chip";
import { formatDate } from "./constants";
import { PrioritySelector } from "./PrioritySelector";
import { TaskComposerModal } from "./TaskComposerModal";

type Props = {
  onAdd: (
    title: string,
    date?: string,
    category?: TaskCategory,
    uniCourse?: UniCourse,
    priority?: Priority,
  ) => void;
  inputRef: React.RefObject<TextInput | null>;
  onTaskCreated?: (id: string) => void;
};

export function AddTaskRow({ onAdd, inputRef, onTaskCreated }: Props) {
  const { colors, scheme } = useTheme();
  const { categories } = useCategoriesData();
  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
  const uniCat = sortedCategories.find(c => c.id === "uni");
  const uniColor = resolveAccentSwatch(uniCat?.color ?? "orchid", scheme).color;
  const [value, setValue]               = useState("");
  const [focused, setFocused]           = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [quickDate, setQuickDate]       = useState<string | undefined>();
  const [quickCat, setQuickCat]         = useState<TaskCategory | undefined>();
  const [quickCourse, setQuickCourse]   = useState<UniCourse>("Misc");
  const [quickPriority, setQuickPriority] = useState<Priority | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const showOptions = focused || value.length > 0 || !!quickDate || !!quickCat || !!quickPriority;
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();
  const nextWeek = getNextWeekStr();
  const dueDateColor = quickDate && quickDate < today ? colors.danger : quickDate === today ? colors.warning : colors.accent;

  const { date: nlpDate, cleanText: nlpClean } = !quickDate ? parseNaturalDate(value) : { date: null, cleanText: value };

  function submit() {
    const t = value.trim();
    if (!t) return;
    const finalTitle = !quickDate && nlpDate ? (nlpClean.trim() || t) : t;
    const finalDate  = quickDate ?? (nlpDate ?? undefined);
    onAdd(finalTitle, finalDate, quickCat, quickCat === "uni" ? quickCourse : undefined, quickPriority);
    setValue("");
    setQuickDate(undefined);
    setQuickCat(undefined);
    setQuickPriority(undefined);
    setShowDatePicker(false);
  }

  const DATE_PRESETS = [
    { label: "Today",     date: today },
    { label: "Tomorrow",  date: tomorrow },
    { label: "Next week", date: nextWeek },
  ];

  return (
    <Surface variant="elevated" style={{ borderRadius: radius.xl, borderColor: focused ? colors.accent : undefined, marginBottom: spacing[4] }}>
      <View style={{ paddingVertical: spacing[3], paddingHorizontal: spacing[4], gap: spacing[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
          <Ionicons name="add" size={17} color={colors.accent} />
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
              <Text size="xs" weight="medium" style={{ color: colors.textInverse }}>Add</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setShowComposer(true)} hitSlop={8} accessibilityLabel="More task options">
            <Ionicons name="expand-outline" size={15} color={colors.textTertiary} />
          </Pressable>
        </View>

        {nlpDate && !quickDate && value.trim().length > 0 && (
          <Pressable
            onPress={() => { setQuickDate(nlpDate); setValue(nlpClean.trim() || value); }}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], paddingHorizontal: spacing[1], paddingTop: spacing[1] }}
          >
            <Text size="xs" style={{ color: colors.accent }}>📅 {formatDate(nlpDate)}</Text>
            <Text size="xs" style={{ color: colors.textTertiary }}>detected — tap to set as due date</Text>
          </Pressable>
        )}

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
                  <DatePicker value={quickDate} onChange={d => { setQuickDate(d ?? undefined); setShowDatePicker(false); }} />
                )}
              </View>

              {/* Category row */}
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[1.5], flexWrap: "wrap" }}>
                <Text size="xs" style={{ color: colors.textTertiary, width: 32, marginTop: 3 }}>Cat.</Text>
                <View style={{ flex: 1, gap: spacing[1.5] }}>
                  <View style={{ flexDirection: "row", gap: spacing[1.5], flexWrap: "wrap" }}>
                    {sortedCategories.map(cat => {
                      const color = resolveAccentSwatch(cat.color, scheme).color;
                      const active = quickCat === cat.id;
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={() => setQuickCat(c => c === cat.id ? undefined : cat.id)}
                          style={{
                            paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
                            borderRadius: 99, borderWidth: 1,
                            borderColor: active ? color : colors.bgBorder,
                            backgroundColor: active ? `${color}18` : "transparent",
                          }}
                        >
                          <Text size="xs" style={{ color: active ? color : colors.textSecondary }}>{cat.name}</Text>
                        </Pressable>
                      );
                    })}
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
                            borderColor: quickCourse === course ? uniColor : colors.bgBorder,
                            backgroundColor: quickCourse === course ? `${uniColor}18` : "transparent",
                          }}
                        >
                          <Text size="xs" style={{ color: quickCourse === course ? uniColor : colors.textSecondary }}>{course}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Urgency row — same inline treatment as date and category, so the
                  three things worth setting at capture time are all here without
                  expanding the full composer. */}
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[1.5], flexWrap: "wrap" }}>
                <Text size="xs" style={{ color: colors.textTertiary, width: 32, marginTop: 3 }}>Urg.</Text>
                <View style={{ flex: 1 }}>
                  <PrioritySelector value={quickPriority} onChange={setQuickPriority} />
                </View>
              </View>
            </View>
          </Animated.View>
        )}
      </View>
      <TaskComposerModal
        visible={showComposer}
        onClose={() => setShowComposer(false)}
        initialTitle={value}
        onCreated={id => { setValue(""); onTaskCreated?.(id); }}
      />
    </Surface>
  );
}
