import React, { useState } from "react";
import { View, TextInput, Pressable, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, GradientBackground, Divider } from "@/components/ui";
import { spacing, radius, fontFamily, ACCENT_OPTIONS, resolveAccentSwatch, type AccentId } from "@/lib/theme";
import { useCategoriesData, useCategoriesActions, topLevel, childrenOf, type Category } from "@/lib/TaskCategoriesContext";
import { useTasksData, useTasksActions } from "@/lib/TasksContext";

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** Small 10-dot accent swatch picker — same visual language as
 *  Settings → Appearance's accent picker, sized down for an inline row. */
function AccentPicker({ value, onChange }: { value: AccentId; onChange: (id: AccentId) => void }) {
  const { colors, scheme } = useTheme();
  const swatchOf = (opt: typeof ACCENT_OPTIONS[number]) => scheme === "dark" ? opt.color : opt.light;
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
              // Per-scheme variant, matching what the category chip will render.
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: swatchOf(opt),
              borderWidth: active ? 2.5 : 1.5,
              borderColor: active ? colors.textPrimary : `${swatchOf(opt)}40`,
              alignItems: "center", justifyContent: "center",
            }}
          >
            {active && <Ionicons name="checkmark" size={12} color={colors.textInverse} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function CategoryRow({
  category, count, isFirst, isLast, onMoveUp, onMoveDown,
  isSub = false, descendantIds = [], onAddSub,
}: {
  category: Category;
  /** Tasks filed here **and** in any subcategory — what a delete would move. */
  count: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Renders compact and indented; subcategories have no children of their own. */
  isSub?: boolean;
  /** Subcategory ids, so deleting a parent can reassign their tasks too. */
  descendantIds?: string[];
  onAddSub?: () => void;
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
    // Reassign tasks to Uncategorized before removing — deleteCategory only
    // touches task_categories, it has no access to tasks (sibling context).
    // Includes subcategory tasks, because deleteCategory cascades to children.
    const doomed = new Set([category.id, ...descendantIds]);
    tasks.filter(t => t.category && doomed.has(t.category))
         .forEach(t => updateTask(t.id, { category: undefined }));
    deleteCategory(category.id);
    setConfirmDelete(false);
  }

  return (
    <View style={{
      borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder,
      backgroundColor: isSub ? colors.bgTertiary : colors.bgSecondary,
      padding: isSub ? spacing[2.5] : spacing[3], gap: spacing[2.5],
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], flexWrap: "wrap" }}>
            <Text size="xs" style={{ color: colors.danger }}>
              {descendantIds.length > 0
                ? `Delete this and ${descendantIds.length} subcategor${descendantIds.length === 1 ? "y" : "ies"}${count > 0 ? `, moving ${count} task${count !== 1 ? "s" : ""} to Uncategorized` : ""}?`
                : count > 0 ? `Move ${count} task${count !== 1 ? "s" : ""} to Uncategorized?` : "Delete category?"}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
            {onAddSub && (
              <Pressable onPress={onAddSub} hitSlop={6} accessibilityLabel={`Add subcategory to ${category.name}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="add" size={12} color={colors.accent} />
                <Text size="xs" style={{ color: colors.accent }}>Subcategory</Text>
              </Pressable>
            )}
            <Pressable onPress={handleDelete} hitSlop={6} accessibilityLabel={`Delete ${category.name}`}>
              <Ionicons name="trash-outline" size={14} color={colors.textTertiary} />
            </Pressable>
          </View>
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
  // Draft subcategory name per parent; a non-null entry also opens its input.
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});

  const roots = topLevel(categories);
  const countFor = (id: string) => tasks.filter(t => t.category === id).length;

  /** Reorder within a sibling set. `order` is sibling-scoped, so passing just
   *  those ids is enough — reorderCategories only touches the ids it is given. */
  function move(siblings: Category[], id: string, direction: "up" | "down") {
    const idx = siblings.findIndex(c => c.id === id);
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || swap < 0 || swap >= siblings.length) return;
    const next = [...siblings];
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

  function handleAddSub(parentId: string) {
    const trimmed = (subDrafts[parentId] ?? "").trim();
    if (!trimmed) return;
    // Subcategories inherit the parent's colour — the badge shows them as one
    // family, so a separate accent would be noise.
    const parent = categories.find(c => c.id === parentId);
    addCategory(trimmed, parent?.color ?? "navy", parentId);
    setSubDrafts(d => ({ ...d, [parentId]: "" }));
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
            {roots.map((cat, i) => {
              const subs = childrenOf(categories, cat.id);
              const subIds = subs.map(s => s.id);
              const draft = subDrafts[cat.id];
              return (
                <View key={cat.id} style={{ gap: spacing[2] }}>
                  <CategoryRow
                    category={cat}
                    // What a delete would move: this category plus its children.
                    count={countFor(cat.id) + subIds.reduce((n, id) => n + countFor(id), 0)}
                    descendantIds={subIds}
                    isFirst={i === 0}
                    isLast={i === roots.length - 1}
                    onMoveUp={() => move(roots, cat.id, "up")}
                    onMoveDown={() => move(roots, cat.id, "down")}
                    onAddSub={() => setSubDrafts(d => ({ ...d, [cat.id]: d[cat.id] ?? "" }))}
                  />

                  {subs.map((sub, j) => (
                    <View key={sub.id} style={{ marginLeft: spacing[5] }}>
                      <CategoryRow
                        category={sub}
                        isSub
                        count={countFor(sub.id)}
                        isFirst={j === 0}
                        isLast={j === subs.length - 1}
                        onMoveUp={() => move(subs, sub.id, "up")}
                        onMoveDown={() => move(subs, sub.id, "down")}
                      />
                    </View>
                  ))}

                  {draft !== undefined && (
                    <View style={{ marginLeft: spacing[5], flexDirection: "row", gap: spacing[2], alignItems: "center" }}>
                      <TextInput
                        value={draft}
                        onChangeText={v => setSubDrafts(d => ({ ...d, [cat.id]: v }))}
                        onSubmitEditing={() => handleAddSub(cat.id)}
                        autoFocus
                        placeholder={`Subcategory of ${cat.name}`}
                        placeholderTextColor={colors.textTertiary}
                        returnKeyType="done"
                        style={[
                          { flex: 1, color: colors.textPrimary, fontSize: 13, fontFamily: fontFamily.medium,
                            paddingVertical: spacing[2], paddingHorizontal: spacing[2.5],
                            backgroundColor: colors.bgTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bgBorder },
                          // @ts-ignore
                          { outlineStyle: "none" },
                        ]}
                      />
                      <Pressable onPress={() => handleAddSub(cat.id)}
                        style={{ paddingHorizontal: spacing[2.5], paddingVertical: spacing[2], borderRadius: radius.md,
                                 backgroundColor: draft.trim() ? colors.accent : colors.bgTertiary }}>
                        <Text size="xs" weight="semibold" style={{ color: draft.trim() ? colors.textInverse : colors.textTertiary }}>Add</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setSubDrafts(d => { const n = { ...d }; delete n[cat.id]; return n; })}
                        hitSlop={8}
                      >
                        <Ionicons name="close-outline" size={16} color={colors.textTertiary} />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}

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
