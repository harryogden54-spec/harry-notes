import React, { useState, useEffect, useRef } from "react";
import { View, TextInput, Pressable, Platform, Modal, ScrollView } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius, fontFamily, getShadow } from "@/lib/theme";
import {
  useCoursesActions, type CourseTable, type CourseColumn, type CourseColumnType,
} from "@/lib/CoursesContext";

type DraftColumn = { id: string; name: string; type: CourseColumnType; isNew: boolean };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** When set, edits this table's title + columns; otherwise creates a new table. */
  table?: CourseTable | null;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Fresh tables start with a sensible revision-tracker shape — rename or
// remove freely (mirrors Harry's soil-mechanics mockup).
function defaultColumns(): DraftColumn[] {
  return [
    { id: newId(), name: "Week",   type: "text",     isNew: true },
    { id: newId(), name: "Topics", type: "text",     isNew: true },
    { id: newId(), name: "Done",   type: "checkbox", isNew: true },
  ];
}

/**
 * Create/edit modal for a Courses table: title, plus a column builder where
 * each column is named and typed (free text vs. tickbox). Editing an existing
 * table keeps column ids stable so row cell data survives; removed columns
 * have their cells pruned by updateTableStructure.
 */
export function TableEditorModal({ visible, onClose, table }: Props) {
  const { colors, scheme } = useTheme();
  const { addTable, updateTableStructure } = useCoursesActions();
  const [title, setTitle]     = useState("");
  const [columns, setColumns] = useState<DraftColumn[]>(defaultColumns);
  const titleRef = useRef<TextInput | null>(null);
  const isEdit = !!table;

  useEffect(() => {
    if (!visible) return;
    setTitle(table?.title ?? "");
    setColumns(
      table
        ? table.columns.map(c => ({ ...c, isNew: false }))
        : defaultColumns()
    );
    setTimeout(() => titleRef.current?.focus(), 80);
  }, [visible, table]);

  const canSave = title.trim().length > 0 && columns.length > 0;

  function submit() {
    if (!canSave) return;
    const named = columns.map((c, i) => ({ ...c, name: c.name.trim() || `Column ${i + 1}` }));
    if (isEdit && table) {
      updateTableStructure(table.id, title.trim(), named.map(({ isNew, ...c }) => c as CourseColumn));
    } else {
      addTable(title.trim(), named.map(({ id, isNew, ...c }) => c));
    }
    onClose();
  }

  if (!visible) return null;

  const inputStyle = [
    {
      color: colors.textPrimary, fontSize: 16, fontFamily: fontFamily.medium,
      paddingVertical: spacing[3], paddingHorizontal: spacing[3],
      backgroundColor: colors.bgTertiary, borderRadius: radius.lg,
      borderWidth: 1, borderColor: colors.bgBorder,
    },
    { outlineStyle: "none" } as any, // web-only reset, not in RN's TextStyle
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-start", paddingTop: Platform.OS === "web" ? 80 : 60 }}>
        <Pressable onPress={onClose} style={{ position: "absolute", inset: 0, backgroundColor: "#00000055" } as any} />
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={{
            backgroundColor: colors.bgSecondary, borderRadius: radius["2xl"],
            borderWidth: 1, borderColor: colors.bgBorder,
            width: "90%" as any, maxWidth: 520,
            ...getShadow("overlay", scheme),
            maxHeight: Platform.OS === "web" ? "85vh" as any : 620,
          }}
        >
          <ScrollView contentContainerStyle={{ padding: spacing[5], gap: spacing[4] }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <Text size="base" weight="semibold" style={{ flex: 1 }}>{isEdit ? "Edit table" : "New table"}</Text>
              <Pressable onPress={onClose} hitSlop={12}
                style={{ width: 24, height: 24, borderRadius: 99, backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close-outline" size={14} color={colors.textTertiary} />
              </Pressable>
            </View>

            <TextInput
              ref={titleRef}
              value={title}
              onChangeText={setTitle}
              placeholder="Table title — e.g. Soil Mechanics"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="next"
              style={inputStyle}
            />

            <View style={{ gap: spacing[1.5] }}>
              <Text size="xs" weight="semibold" style={{ color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.6 }}>
                Columns · {columns.length}
              </Text>

              <View style={{ gap: spacing[2] }}>
                {columns.map((col, i) => (
                  <View key={col.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                    <TextInput
                      value={col.name}
                      onChangeText={name => setColumns(prev => prev.map(c => c.id === col.id ? { ...c, name } : c))}
                      placeholder={`Column ${i + 1}`}
                      placeholderTextColor={colors.textTertiary}
                      style={[
                        {
                          flex: 1, color: colors.textPrimary, fontSize: 13, fontFamily: fontFamily.regular,
                          paddingVertical: spacing[2], paddingHorizontal: spacing[2.5],
                          backgroundColor: colors.bgTertiary, borderRadius: radius.md,
                          borderWidth: 1, borderColor: colors.bgBorder,
                        },
                        // @ts-ignore
                        { outlineStyle: "none" },
                      ]}
                    />
                    {/* Type toggle — free text vs. tickbox */}
                    <View style={{ flexDirection: "row", backgroundColor: colors.bgTertiary, borderRadius: 999, borderWidth: 1, borderColor: colors.bgBorder, padding: 2 }}>
                      {([["text", "text-outline", "Text"], ["checkbox", "checkbox-outline", "Tickbox"]] as const).map(([type, icon, label]) => {
                        const active = col.type === type;
                        return (
                          <Pressable
                            key={type}
                            accessibilityLabel={`${label} column`}
                            onPress={() => setColumns(prev => prev.map(c => c.id === col.id ? { ...c, type } : c))}
                            style={{
                              paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
                              borderRadius: 999,
                              backgroundColor: active ? colors.bgSecondary : "transparent",
                              borderWidth: 1, borderColor: active ? colors.bgBorder : "transparent",
                            }}
                          >
                            <Ionicons name={icon} size={13} color={active ? colors.accent : colors.textTertiary} />
                          </Pressable>
                        );
                      })}
                    </View>
                    <Pressable
                      onPress={() => setColumns(prev => prev.filter(c => c.id !== col.id))}
                      hitSlop={8}
                      accessibilityLabel="Remove column"
                      disabled={columns.length <= 1}
                      style={{ opacity: columns.length <= 1 ? 0.3 : 1 }}
                    >
                      <Ionicons name="close-outline" size={16} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => setColumns(prev => [...prev, { id: newId(), name: "", type: "text", isNew: true }])}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], alignSelf: "flex-start", paddingVertical: spacing[1.5] }}
              >
                <Ionicons name="add" size={14} color={colors.accent} />
                <Text size="sm" style={{ color: colors.accent }}>Add column</Text>
              </Pressable>
            </View>

            {isEdit && (
              <Text size="xs" tertiary>
                Removing a column deletes its cell data in every row. Rows themselves are kept.
              </Text>
            )}

            <View style={{ flexDirection: "row", gap: spacing[2], justifyContent: "flex-end" }}>
              <Pressable onPress={onClose}
                style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2.5], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder }}>
                <Text size="sm" style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submit} disabled={!canSave}
                style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2.5], borderRadius: radius.lg, backgroundColor: canSave ? colors.accent : colors.bgTertiary }}>
                <Text size="sm" weight="semibold" style={{ color: canSave ? colors.textInverse : colors.textTertiary }}>
                  {isEdit ? "Save changes" : "Create table"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
