import React, { useState, useEffect, useRef } from "react";
import {
  View, Pressable, TextInput, Modal, Platform, KeyboardAvoidingView,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Text } from "@/components/ui/Text";
import { DatePicker } from "@/components/ui/DatePicker";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { getTodayStr, getTomorrowStr } from "@/lib/utils";
import { type TaskCategory, type UniCourse, UNI_COURSES } from "@/lib/TasksContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, dueDate?: string, category?: TaskCategory, uniCourse?: UniCourse) => void;
}

export function QuickAddModal({ visible, onClose, onAdd }: Props) {
  const { colors } = useTheme();
  const [title, setTitle]           = useState("");
  const [quickDate, setQuickDate]   = useState<"none" | "today" | "tomorrow" | "custom">("none");
  const [customDate, setCustomDate] = useState<string | undefined>();
  const [showPicker, setShowPicker] = useState(false);
  const [category, setCategory]     = useState<TaskCategory | undefined>();
  const [uniCourse, setUniCourse]   = useState<UniCourse>("Misc");
  const inputRef = useRef<TextInput | null>(null);
  const today    = getTodayStr();
  const tomorrow = getTomorrowStr();

  // Auto-focus input when opened
  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state on close
      setTitle("");
      setQuickDate("none");
      setCustomDate(undefined);
      setShowPicker(false);
      setCategory(undefined);
    }
  }, [visible]);

  // Web: dismiss on Escape
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  function getEffectiveDate(): string | undefined {
    if (quickDate === "today")    return today;
    if (quickDate === "tomorrow") return tomorrow;
    if (quickDate === "custom")   return customDate;
    return undefined;
  }

  function submit() {
    const t = title.trim();
    if (!t) return;
    onAdd(t, getEffectiveDate(), category, category === "uni" ? uniCourse : undefined);
    onClose();
  }

  const content = (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" } as any}
      />

      {/* Card */}
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={{
          backgroundColor: colors.bgSecondary,
          borderRadius: radius["2xl"],
          borderWidth: 1,
          borderColor: colors.bgBorder,
          padding: spacing[5],
          gap: spacing[4],
          width: "90%" as any,
          maxWidth: 440,
          // @ts-ignore
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 24,
          elevation: 10,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text size="base" weight="semibold">New task</Text>
          <Pressable onPress={onClose} hitSlop={12}
            style={{ width: 24, height: 24, borderRadius: 99, backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center" }}>
            <Text size="sm" style={{ color: colors.textTertiary }}>✕</Text>
          </Pressable>
        </View>

        {/* Title input */}
        <TextInput
          ref={inputRef}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={submit}
          placeholder="Task title…"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          style={[
            {
              color: colors.textPrimary,
              fontSize: 16,
              fontFamily: fontFamily.medium,
              paddingVertical: spacing[3],
              paddingHorizontal: spacing[3],
              backgroundColor: colors.bgTertiary,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.bgBorder,
            },
            // @ts-ignore
            { outlineStyle: "none" },
          ]}
        />

        {/* Date row */}
        <View style={{ gap: spacing[1.5] }}>
          <Text size="xs" style={{ color: colors.textTertiary, fontFamily: fontFamily.medium }}>Date</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5] }}>
            {(["none", "today", "tomorrow", "custom"] as const).map(opt => {
              const labels = { none: "No date", today: "Today", tomorrow: "Tomorrow", custom: "Custom" };
              const active = quickDate === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    setQuickDate(opt);
                    if (opt === "custom") setShowPicker(true);
                    else setShowPicker(false);
                  }}
                  style={{
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[1.5],
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: active ? colors.accent : colors.bgBorder,
                    backgroundColor: active ? `${colors.accent}18` : "transparent",
                  }}
                >
                  <Text size="xs" weight={active ? "semibold" : undefined} style={{ color: active ? colors.accent : colors.textSecondary }}>
                    {opt === "custom" && customDate && active
                      ? new Date(customDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : labels[opt]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {showPicker && (
            <DatePicker
              value={customDate}
              onChange={(d) => {
                setCustomDate(d ?? undefined);
                setShowPicker(false);
              }}
            />
          )}
        </View>

        {/* Category row */}
        <View style={{ gap: spacing[1.5] }}>
          <Text size="xs" style={{ color: colors.textTertiary, fontFamily: fontFamily.medium }}>Category</Text>
          <View style={{ flexDirection: "row", gap: spacing[1.5] }}>
            {([["personal", "Personal", colors.accent], ["uni", "Uni", "#B48EAD"]] as [TaskCategory, string, string][]).map(([cat, label, color]) => (
              <Pressable
                key={cat}
                onPress={() => setCategory(c => c === cat ? undefined : cat)}
                style={{
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1.5],
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: category === cat ? color : colors.bgBorder,
                  backgroundColor: category === cat ? `${color}18` : "transparent",
                }}
              >
                <Text size="xs" weight={category === cat ? "semibold" : undefined} style={{ color: category === cat ? color : colors.textSecondary }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {category === "uni" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
              {UNI_COURSES.map(course => (
                <Pressable
                  key={course}
                  onPress={() => setUniCourse(course)}
                  style={{
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[0.5],
                    borderRadius: 99,
                    borderWidth: 1,
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

        {/* Add button */}
        <Pressable
          onPress={submit}
          style={{
            backgroundColor: title.trim() ? colors.accent : colors.bgTertiary,
            borderRadius: radius.lg,
            paddingVertical: spacing[3],
            alignItems: "center",
          }}
        >
          <Text size="sm" weight="semibold" style={{ color: title.trim() ? "#fff" : colors.textTertiary }}>
            Add task
          </Text>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );

  if (Platform.OS === "web") {
    if (!visible) return null;
    return (
      <View style={{ position: "absolute", inset: 0, zIndex: 100 } as any}>
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {content}
    </Modal>
  );
}
