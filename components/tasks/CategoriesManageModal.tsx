import React, { useState } from "react";
import { View, TextInput, Pressable, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, GradientBackground, Divider } from "@/components/ui";
import { spacing, radius, fontFamily, ACCENT_OPTIONS, resolveAccentSwatch, type AccentId } from "@/lib/theme";
import { useCategoriesData, useCategoriesActions, type Category } from "@/lib/TaskCategoriesContext";
import { useTasksData, useTasksActions } from "@/lib/TasksContext";

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** Small 10-dot accent swatch picker — same visual language as
 *  Settings → Appearance's accent picker, sized down for an inline row. */
function AccentPicker({ value, onChange }: { value: AccentId; onChange: (id: AccentId) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5] }}>
      {ACCENT_OPTIONS.map(opt => {
        const active = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            hitSlop={4}
            accessibilityLabel={opt.label}
            style={{
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: opt.color,
              borderWidth: active ? 2.5 : 1.5,
              borderColor: active ? colors.textPrimary : `${opt.color}40`,
              alignItems: "center", justifyContent: "center",
            }}
          >
            {active && <Ionicons name="checkmark" size={11} color={colors.textInverse} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function CategoryRow({
  category, index, count, isFirst, isLast, onMoveUp, onMoveDown,
}: {
  category: Category;
  index: number;
  count: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { colors, scheme } = useTheme();
  const { updateCategory, deleteCategory } = useCategoriesActions();
  const { updateTask } = useTasksActions();
  const { tasks } = useTasksData();
  const [name, setName] = useState(category.name);
  const [pickingColor, setPickingColor] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const swatch = resolveAccentSwatch(category.color, scheme);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== category.name) updateCategory(category.id, { name: trimmed });
    else if (!trimmed) setName(category.name); // ignore empty rename
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    // Reassign this category's tasks to Uncategorized before removing it —
    // deleteCategory only touches task_categories, it has no access to tasks
    // (sibling context).
    tasks.filter(t => t.category === category.id).forEach(t => updateTask(t.id, { category: undefined }));
    deleteCategory(category.id);
    setConfirmDelete(false);
  }

  return (
    <View style={{
      borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder,
      backgroundColor: colors.bgSecondary, padding: spacing[3], gap: spacing[2.5],
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2.5] }}>
        <Pressable
          onPress={() => setPickingColor(v => !v)}
          hitSlop={8}
          accessibilityLabel="Change colour"
          style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: swatch.color }}
        />
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={commitName}
          onSubmitEditing={commitName}
          placeholder="Category name"
          placeholderTextColor={colors.textTertiary}
          style={[
            { flex: 1, color: colors.textPrimary, fontSize: 14, fontFamily: fontFamily.medium, paddingVertical: 2 },
            // @ts-ignore
            { outlineStyle: "none" },
          ]}
        />
        <View style={{ flexDirection: "row", gap: 2 }}>
          <Pressable onPress={onMoveUp} disabled={isFirst} hitSlop={6}
            style={{ padding: 4, borderRadius: 4, backgroundColor: colors.bgTertiary, opacity: isFirst ? 0.35 : 1 }}>
            <Text size="xs" style={{ color: colors.textTertiary }}>↑</Text>
          </Pressable>
          <Pressable onPress={onMoveDown} disabled={isLast} hitSlop={6}
            style={{ padding: 4, borderRadius: 4, backgroundColor: colors.bgTertiary, opacity: isLast ? 0.35 : 1 }}>
            <Text size="xs" style={{ color: colors.textTertiary }}>↓</Text>
          </Pressable>
        </View>
      </View>

      {pickingColor && (
        <AccentPicker value={category.color} onChange={c => { updateCategory(category.id, { color: c }); setPickingColor(false); }} />
      )}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text size="xs" style={{ color: colors.textTertiary }}>
          {count} task{count !== 1 ? "s" : ""}
        </Text>
        {confirmDelete ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <Text size="xs" style={{ color: colors.danger }}>
              {count > 0 ? `Move ${count} task${count !== 1 ? "s" : ""} to Uncategorized?` : "Delete category?"}
            </Text>
            <Pressable onPress={handleDelete}
              style={{ paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.danger }}>
              <Text size="xs" weight="semibold" style={{ color: colors.textInverse }}>Confirm</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmDelete(false)}
              style={{ paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}>
              <Text size="xs" style={{ color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={handleDelete} hitSlop={6}>
            <Ionicons name="trash-outline" size={14} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function CategoriesManageModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { categories } = useCategoriesData();
  const { addCategory, reorderCategories } = useCategoriesActions();
  const { tasks } = useTasksData();
  const [newName, setNewName] = useState("");

  const sorted = [...categories].sort((a, b) => a.order - b.order);
  const countFor = (id: string) => tasks.filter(t => t.category === id).length;

  function move(id: string, direction: "up" | "down") {
    const idx = sorted.findIndex(c => c.id === id);
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || swap < 0 || swap >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    reorderCategories(next.map(c => c.id));
  }

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    // Cycle through accents so successive new categories aren't all the same colour.
    const nextAccent = ACCENT_OPTIONS[categories.length % ACCENT_OPTIONS.length].id;
    addCategory(trimmed, nextAccent);
    setNewName("");
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GradientBackground>
        {/* Full-window modal — covers the status bar, so keep all edges. */}
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.bgBorder }}>
            <Text size="lg" weight="bold" style={{ flex: 1 }}>Edit categories</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text size="sm" style={{ color: colors.accent }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3] }}>
            {sorted.map((cat, i) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                index={i}
                count={countFor(cat.id)}
                isFirst={i === 0}
                isLast={i === sorted.length - 1}
                onMoveUp={() => move(cat.id, "up")}
                onMoveDown={() => move(cat.id, "down")}
              />
            ))}

            <Divider />

            <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "center" }}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={handleAdd}
                placeholder="New category name"
                placeholderTextColor={colors.textTertiary}
                returnKeyType="done"
                style={[
                  { flex: 1, color: colors.textPrimary, fontSize: 14, fontFamily: fontFamily.medium,
                    paddingVertical: spacing[2.5], paddingHorizontal: spacing[3],
                    backgroundColor: colors.bgTertiary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder },
                  // @ts-ignore
                  { outlineStyle: "none" },
                ]}
              />
              <Pressable
                onPress={handleAdd}
                style={{
                  paddingHorizontal: spacing[3], paddingVertical: spacing[2.5], borderRadius: radius.lg,
                  backgroundColor: newName.trim() ? colors.accent : colors.bgTertiary,
                }}
              >
                <Text size="sm" weight="semibold" style={{ color: newName.trim() ? colors.textInverse : colors.textTertiary }}>Add</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    </Modal>
  );
}
