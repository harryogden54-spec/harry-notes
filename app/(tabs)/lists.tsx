import React, { useState, useCallback, useRef, useEffect } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, ScrollView, TextInput,
  Pressable, KeyboardAvoidingView, Platform, LayoutAnimation, Modal, RefreshControl,
  useWindowDimensions,
} from "react-native";
// Side-notch padding only — PersistentHeader owns the top inset, MobileTabBar the bottom.
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Swipeable } from "react-native-gesture-handler";
import { useLocalSearchParams } from "expo-router";

// DraggableFlatList is native-only — on web use a plain map
const DraggableFlatList = Platform.OS !== "web"
  ? require("react-native-draggable-flatlist").default
  : null;
const ScaleDecorator = Platform.OS !== "web"
  ? require("react-native-draggable-flatlist").ScaleDecorator
  : ({ children }: { children: React.ReactNode }) => <>{children}</>;

import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox, Divider, EmptyState, GradientBackground } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useScrollBottomPadding } from "@/lib/TabBarHeightContext";
import { cmpRecentDesc } from "@/lib/utils";
import { useListsData, useListsActions, useListsSync, LIST_COLORS, type NoteList, type ListItemType, type ListItem } from "@/lib/ListsContext";
import { useToast } from "@/lib/ToastContext";
import { SearchBar } from "@/components/ui/SearchBar";

function animate() {
  if (Platform.OS !== "web") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  { name: "Grocery",  color: LIST_COLORS[2], items: ["🥛 Milk", "🥚 Eggs", "🍞 Bread", "🧀 Cheese", "🍎 Apples"] },
  { name: "Packing",  color: LIST_COLORS[0], items: ["👕 T-shirts", "🩲 Underwear", "🧦 Socks", "🪥 Toothbrush", "💊 Medications"] },
  { name: "Reading",  color: LIST_COLORS[1], items: ["📖 Current book", "📚 Next up", "✅ Finished recently"] },
  { name: "Study",    color: LIST_COLORS[3], items: ["📝 Review notes", "📚 Read chapter", "✏️ Do exercises", "🔁 Flashcards"] },
];

// ─── Color Picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing[1.5], flexWrap: "wrap" }}>
      {LIST_COLORS.map(c => (
        <Pressable key={c} onPress={() => onChange(c)}
          style={{ width: 26, height: 26, borderRadius: 99, backgroundColor: c, borderWidth: value === c ? 2 : 0, borderColor: colors.textInverse, transform: [{ scale: value === c ? 1.15 : 1 }] }}
        />
      ))}
    </View>
  );
}

// ─── Create List Modal ────────────────────────────────────────────────────────

export function CreateListModal({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const { colors } = useTheme();
  // A full-window Modal owns all its own insets — the sheet's bottom padding
  // has to clear the home indicator. Platform.OS === "ios" used to stand in for
  // that and is false in the iOS PWA.
  const insets = useSafeAreaInsets();
  const { addList } = useListsActions();
  const [name, setName]             = useState("");
  const [color, setColor]           = useState(LIST_COLORS[0]);
  const [templateItems, setTemplateItems] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  function applyTemplate(t: typeof TEMPLATES[number]) {
    if (selectedTemplate === t.name) {
      setSelectedTemplate(null);
      setTemplateItems([]);
      if (name === t.name) { setName(""); setColor(LIST_COLORS[0]); }
    } else {
      setSelectedTemplate(t.name);
      setTemplateItems(t.items);
      setName(t.name);
      setColor(t.color);
    }
  }

  function submit() {
    const n = name.trim();
    if (!n) return;
    addList(n, color, templateItems.length > 0 ? templateItems : undefined);
    reset();
    onDone();
  }

  function reset() {
    setName("");
    setColor(LIST_COLORS[0]);
    setTemplateItems([]);
    setSelectedTemplate(null);
  }

  function cancel() { reset(); onDone(); }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }} onPress={cancel}>
          <Pressable onPress={() => {}} style={{
            backgroundColor: colors.bgSecondary,
            borderTopLeftRadius: radius["2xl"],
            borderTopRightRadius: radius["2xl"],
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.bgBorder,
            padding: spacing[5],
            gap: spacing[4],
            paddingBottom: insets.bottom + spacing[5],
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text size="lg" weight="bold">New list</Text>
              <Pressable onPress={cancel} hitSlop={12}>
                <Text size="sm" style={{ color: colors.textTertiary }}>✕</Text>
              </Pressable>
            </View>

            {/* Template picker */}
            <View style={{ gap: spacing[2] }}>
              <Text size="xs" secondary weight="medium">Start from template</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing[1] }}>
                <View style={{ flexDirection: "row", gap: spacing[2], paddingHorizontal: spacing[1] }}>
                  {TEMPLATES.map(t => {
                    const active = selectedTemplate === t.name;
                    return (
                      <Pressable
                        key={t.name}
                        onPress={() => applyTemplate(t)}
                        style={{
                          paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
                          borderRadius: radius.lg,
                          borderWidth: 1,
                          borderColor: active ? t.color : colors.bgBorder,
                          backgroundColor: active ? `${t.color}22` : colors.bgTertiary,
                        }}
                      >
                        <Text size="xs" weight="medium" style={{ color: active ? t.color : colors.textSecondary }}>
                          {t.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="List name…"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              onSubmitEditing={submit}
              style={[{
                color: colors.textPrimary,
                fontSize: 16,
                borderWidth: 1,
                borderColor: colors.bgBorder,
                borderRadius: radius.md,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                backgroundColor: colors.bgTertiary,
              },
              // @ts-ignore
              { outlineStyle: "none" }]}
            />

            <View style={{ gap: spacing[2] }}>
              <Text size="xs" secondary weight="medium">Colour</Text>
              <ColorPicker value={color} onChange={setColor} />
            </View>

            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <Pressable onPress={cancel} style={{
                flex: 1, paddingVertical: spacing[3], borderRadius: radius.lg,
                borderWidth: 1, borderColor: colors.bgBorder, alignItems: "center",
              }}>
                <Text size="sm" secondary weight="medium">Cancel</Text>
              </Pressable>
              <Pressable onPress={submit} style={{
                flex: 2, paddingVertical: spacing[3], borderRadius: radius.lg,
                backgroundColor: colors.accent, alignItems: "center",
              }}>
                <Text size="sm" weight="semibold" style={{ color: colors.textInverse }}>Create list</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── List Item Row ────────────────────────────────────────────────────────────

function ListItemRow({
  item, listId, otherLists, drag, isDragActive,
}: {
  item: { id: string; content: string; type: ListItemType; done: boolean };
  listId: string;
  otherLists: NoteList[];
  drag?: () => void;
  isDragActive?: boolean;
}) {
  const { colors } = useTheme();
  const { toggleItem, updateItem, deleteItem, moveItem } = useListsActions();
  const { showToast } = useToast();
  const [editing, setEditing]   = useState(false);
  const [val, setVal]           = useState(item.content);
  const [hovered, setHovered]   = useState(false);
  const [showMove, setShowMove] = useState(false);

  function saveEdit() {
    const v = val.trim();
    if (v) updateItem(listId, item.id, { content: v });
    else {
      const undo = deleteItem(listId, item.id);
      showToast("Item deleted", { label: "Undo", onPress: undo });
    }
    setEditing(false);
  }

  function handleDelete() {
    const undo = deleteItem(listId, item.id);
    showToast("Item deleted", { label: "Undo", onPress: undo });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  function renderRightActions() {
    if (Platform.OS === "web") return null;
    return (
      <View style={{ justifyContent: "center", paddingHorizontal: spacing[4], backgroundColor: `${colors.danger}22`, marginLeft: spacing[1] }}>
        <Text size="xs" weight="semibold" style={{ color: colors.danger }}>✕</Text>
      </View>
    );
  }

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      onSwipeableOpen={(dir) => { if (dir === "right") handleDelete(); }}
      overshootRight={false}
      friction={2}
    >
      <View>
        <View
          // @ts-ignore
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { setHovered(false); setShowMove(false); }}
          style={{
            flexDirection: "row", alignItems: "center", gap: spacing[3],
            paddingVertical: spacing[3], paddingHorizontal: spacing[2],
            borderRadius: radius.sm,
            borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
            backgroundColor: isDragActive ? colors.bgTertiary : hovered ? `${colors.bgTertiary}CC` : "transparent",
            opacity: item.done ? 0.55 : 1,
          }}
        >
          {drag && (
            <Pressable onLongPress={drag} delayLongPress={150} hitSlop={8}>
              <Text style={{ color: colors.textTertiary, fontSize: 14, lineHeight: 20 }}>⠿</Text>
            </Pressable>
          )}
          {item.type === "checkbox" ? (
            <Checkbox checked={item.done} onToggle={() => toggleItem(listId, item.id)} size={15} />
          ) : (
            <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: colors.textTertiary, marginHorizontal: 5 }} />
          )}

          {editing ? (
            <TextInput value={val} onChangeText={setVal} autoFocus onBlur={saveEdit} onSubmitEditing={saveEdit}
              style={[{ flex: 1, color: colors.textPrimary, fontSize: 13 },
              // @ts-ignore
              { outlineStyle: "none" }]} />
          ) : (
            <Pressable onPress={() => setEditing(true)} style={{ flex: 1 }}>
              <Text size="sm" style={{
                color: item.done ? colors.textTertiary : colors.textPrimary,
                textDecorationLine: item.done ? "line-through" : "none",
              }}>
                {item.content || (item as any).text || ""}
              </Text>
            </Pressable>
          )}

          {hovered && !editing && (
            <View style={{ flexDirection: "row", gap: spacing[1] }}>
              {otherLists.length > 0 && (
                <Pressable onPress={() => setShowMove(v => !v)} hitSlop={8}>
                  <Text size="xs" style={{ color: colors.textTertiary }}>→</Text>
                </Pressable>
              )}
              <Pressable onPress={handleDelete} hitSlop={8}>
                <Text size="xs" style={{ color: colors.textTertiary }}>✕</Text>
              </Pressable>
            </View>
          )}
        </View>

        {showMove && (
          <View style={{ marginLeft: spacing[6], marginBottom: spacing[1], flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
            <Text size="xs" secondary style={{ marginRight: spacing[1] }}>Move to:</Text>
            {otherLists.map(l => (
              <Pressable key={l.id} onPress={() => { moveItem(listId, item.id, l.id); setShowMove(false); showToast(`Moved to "${l.name}"`); }}
                style={{ paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1, borderColor: l.color ?? LIST_COLORS[0], backgroundColor: `${l.color ?? LIST_COLORS[0]}18` }}>
                <Text size="xs" style={{ color: l.color ?? LIST_COLORS[0] }}>{l.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Swipeable>
  );
}

// ─── Add Item Row ─────────────────────────────────────────────────────────────

function AddItemRow({ listId, defaultType }: { listId: string; defaultType: ListItemType }) {
  const { colors } = useTheme();
  const { addItem } = useListsActions();
  const [val, setVal]   = useState("");
  const [type, setType] = useState<ListItemType>(defaultType);

  function submit() {
    const v = val.trim();
    if (!v) return;
    addItem(listId, v, type);
    setVal("");
  }

  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: spacing[2],
      marginTop: spacing[2],
      paddingHorizontal: spacing[2], paddingVertical: spacing[2],
      backgroundColor: colors.bgSecondary,
      borderTopWidth: 1, borderTopColor: colors.bgBorder,
      borderRadius: radius.md,
    }}>
      <Ionicons name="add" size={15} color={colors.textTertiary} />
      <Pressable onPress={() => setType(t => t === "checkbox" ? "bullet" : "checkbox")} hitSlop={8}>
        {type === "checkbox"
          ? <View style={{ width: 15, height: 15, borderRadius: 3, borderWidth: 1.5, borderColor: colors.bgBorder }} />
          : <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: colors.textTertiary, marginHorizontal: 5 }} />
        }
      </Pressable>
      <TextInput value={val} onChangeText={setVal} placeholder="Add item…" placeholderTextColor={colors.textTertiary}
        onSubmitEditing={submit}
        style={[{ flex: 1, color: colors.textPrimary, fontSize: 13, paddingVertical: spacing[1] },
        // @ts-ignore
        { outlineStyle: "none" }]} />
      {val.length > 0 && (
        <Pressable onPress={submit} hitSlop={8}>
          <Text size="xs" style={{ color: colors.accent }} weight="medium">Add</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── List Index Row (desktop left pane) ──────────────────────────────────────

export function ListIndexRow({ list, isSelected, onSelect }: {
  list: NoteList;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { colors } = useTheme();
  const color = list.color ?? LIST_COLORS[0];
  const items = list.items ?? [];
  return (
    <Pressable
      onPress={onSelect}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing[3],
        paddingHorizontal: spacing[4], paddingVertical: spacing[3],
        backgroundColor: isSelected ? colors.bgTertiary : "transparent",
        borderLeftWidth: 2,
        borderLeftColor: isSelected ? color : "transparent",
      }}
    >
      <View style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: color, flexShrink: 0 }} />
      <View style={{ flex: 1, gap: spacing[0.5] }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text size="sm" weight={isSelected ? "semibold" : "regular"} numberOfLines={1} style={{ flex: 1 }}>
            {list.name}
          </Text>
          {list.pinned && <Text size="xs" style={{ color: colors.accent }}>★</Text>}
        </View>
        <Text size="xs" secondary numberOfLines={1}>
          {items.length} item{items.length !== 1 ? "s" : ""}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── List Detail Pane (desktop right pane) ────────────────────────────────────

export function ListDetailPane({ list, otherLists }: { list: NoteList; otherLists: NoteList[] }) {
  const { colors } = useTheme();
  const { updateList, deleteList, duplicateList, pinList, reorderItems } = useListsActions();
  const { showToast } = useToast();
  const [editingName, setEditingName]   = useState(false);
  const [nameVal, setNameVal]           = useState(list.name);
  const [editingColor, setEditingColor] = useState(false);

  useEffect(() => { setNameVal(list.name); }, [list.id, list.name]);
  useEffect(() => { setEditingName(false); setEditingColor(false); }, [list.id]);

  const color = list.color ?? LIST_COLORS[0];
  const items = list.items ?? [];
  const activeItems = items.filter(i => !i.done);
  const doneItems   = items.filter(i => i.done);

  function saveName() {
    const v = nameVal.trim();
    if (v) updateList(list.id, { name: v });
    else setNameVal(list.name);
    setEditingName(false);
  }

  function handleDelete() {
    const undo = deleteList(list.id);
    showToast(`"${list.name}" deleted`, { label: "Undo", onPress: undo });
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing[6], paddingBottom: spacing[16] }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], marginBottom: spacing[2] }}>
        <Pressable onPress={() => setEditingColor(v => !v)} hitSlop={8}>
          <View style={{ width: 20, height: 20, borderRadius: 99, backgroundColor: color, shadowColor: color, shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }} />
        </Pressable>
        {editingName ? (
          <TextInput
            value={nameVal}
            onChangeText={setNameVal}
            autoFocus
            onBlur={saveName}
            onSubmitEditing={saveName}
            style={[
              { flex: 1, color: colors.textPrimary, fontSize: 22, fontFamily: fontFamily.bold },
              // @ts-ignore
              { outlineStyle: "none" },
            ]}
          />
        ) : (
          <Pressable onPress={() => setEditingName(true)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <Text size="2xl" weight="bold">{list.name}</Text>
            {items.length > 0 && (
              <View style={{ backgroundColor: `${color}22`, borderRadius: 99, paddingHorizontal: spacing[2], paddingVertical: 2 }}>
                <Text size="xs" style={{ color }}>{activeItems.length}/{items.length}</Text>
              </View>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={() => { pinList(list.id); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          hitSlop={10}
          style={{ padding: spacing[1] }}
        >
          <Text size="base" style={{ color: list.pinned ? colors.accent : colors.textTertiary }}>
            {list.pinned ? "★" : "☆"}
          </Text>
        </Pressable>
      </View>

      {editingColor && (
        <View style={{ marginBottom: spacing[3] }}>
          <ColorPicker value={color} onChange={c => { updateList(list.id, { color: c }); setEditingColor(false); }} />
        </View>
      )}

      <Divider style={{ marginBottom: spacing[4] }} />

      {/* Active items */}
      {activeItems.map(item => (
        <ListItemRow key={item.id} item={item} listId={list.id} otherLists={otherLists} />
      ))}

      {/* Done items */}
      {doneItems.map(item => (
        <ListItemRow key={item.id} item={item} listId={list.id} otherLists={otherLists} />
      ))}

      <AddItemRow listId={list.id} defaultType="checkbox" />

      <Divider style={{ marginTop: spacing[4], marginBottom: spacing[3] }} />

      {/* Footer actions */}
      <View style={{ flexDirection: "row", gap: spacing[2], justifyContent: "flex-end" }}>
        <Pressable
          onPress={() => { duplicateList(list.id); showToast(`"${list.name}" duplicated`); }}
          style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}
        >
          <Text size="xs" secondary>Duplicate</Text>
        </Pressable>
        <Pressable
          onPress={handleDelete}
          style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: `${colors.danger}44`, backgroundColor: `${colors.danger}10` }}
        >
          <Text size="xs" style={{ color: colors.danger }}>Delete list</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── List Card (mobile — expand-in-place) ─────────────────────────────────────

export function ListCard({ list, isExpanded, onToggleExpand, otherLists }: {
  list: NoteList; isExpanded: boolean; onToggleExpand: () => void; otherLists: NoteList[];
}) {
  const { colors } = useTheme();
  const { updateList, deleteList, duplicateList, pinList, reorderItems } = useListsActions();
  const { showToast } = useToast();
  const [editingName, setEditingName]   = useState(false);
  const [nameVal, setNameVal]           = useState(list.name);
  const [editingColor, setEditingColor] = useState(false);

  const color = list.color ?? LIST_COLORS[0];
  const items = list.items ?? [];

  const activeItems = items.filter(i => !i.done);
  const doneItems   = items.filter(i => i.done);

  function saveName() {
    const v = nameVal.trim();
    if (v) updateList(list.id, { name: v });
    else setNameVal(list.name);
    setEditingName(false);
  }

  function handleDelete() {
    const undo = deleteList(list.id);
    showToast(`"${list.name}" deleted`, { label: "Undo", onPress: undo });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: isExpanded ? color : colors.bgBorder, backgroundColor: colors.bgSecondary, overflow: "hidden", borderLeftWidth: 3, borderLeftColor: color, marginBottom: spacing[2] }}>
      {/* Header */}
      <Pressable onPress={onToggleExpand} style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], padding: spacing[3] }}>
        <View style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: color }} />
        <View style={{ flex: 1 }}>
          <Pressable
            onLongPress={() => { if (!isExpanded) onToggleExpand(); setEditingName(true); }}
            // @ts-ignore web double-click
            onDoubleClick={Platform.OS === "web" ? () => { if (!isExpanded) onToggleExpand(); setEditingName(true); } : undefined}
            onPress={onToggleExpand}
          >
            <Text size="sm" weight="semibold">{list.name}</Text>
          </Pressable>
          {items.length > 0 && (
            <Text size="xs" secondary>
              {items.length} item{items.length !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); pinList(list.id); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          hitSlop={10}
          style={{ padding: spacing[1] }}
        >
          <Text size="xs" style={{ color: list.pinned ? colors.accent : colors.textTertiary }}>
            {list.pinned ? "★" : "☆"}
          </Text>
        </Pressable>
        <Text size="xs" style={{ color: colors.textTertiary }}>{isExpanded ? "▴" : "▾"}</Text>
      </Pressable>

      {isExpanded && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
          <Divider />
          <View style={{ padding: spacing[3], gap: spacing[3] }}>
            {/* Editable name + color */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <Pressable onPress={() => setEditingColor(v => !v)}>
                <View style={{ width: 14, height: 14, borderRadius: 99, backgroundColor: color }} />
              </Pressable>
              {editingName ? (
                <TextInput value={nameVal} onChangeText={setNameVal} autoFocus onBlur={saveName} onSubmitEditing={saveName}
                  style={[{ flex: 1, color: colors.textPrimary, fontSize: 15, fontFamily: fontFamily.semibold },
                  // @ts-ignore
                  { outlineStyle: "none" }]} />
              ) : (
                <Pressable onPress={() => setEditingName(true)} style={{ flex: 1 }}>
                  <Text size="base" weight="semibold">{list.name}</Text>
                </Pressable>
              )}
            </View>

            {editingColor && (
              <ColorPicker value={color} onChange={c => { updateList(list.id, { color: c }); setEditingColor(false); }} />
            )}

            <Divider />

            {activeItems.length > 0 && (
              Platform.OS === "web" ? (
                activeItems.map(item => (
                  <ListItemRow key={item.id} item={item} listId={list.id} otherLists={otherLists} />
                ))
              ) : (
                <DraggableFlatList
                  data={activeItems}
                  keyExtractor={(i: ListItem) => i.id}
                  renderItem={({ item, drag, isActive }: any) => (
                    <ScaleDecorator>
                      <ListItemRow item={item} listId={list.id} otherLists={otherLists} drag={drag} isDragActive={isActive} />
                    </ScaleDecorator>
                  )}
                  onDragEnd={({ data }: any) => reorderItems(list.id, [...data, ...doneItems])}
                  scrollEnabled={false}
                  activationDistance={12}
                  removeClippedSubviews={false}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                />
              )
            )}
            {doneItems.map(item => (
              <ListItemRow key={item.id} item={item} listId={list.id} otherLists={otherLists} />
            ))}

            <AddItemRow listId={list.id} defaultType="checkbox" />

            <Divider />

            <View style={{ flexDirection: "row", gap: spacing[2], justifyContent: "flex-end" }}>
              <Pressable
                onPress={() => { duplicateList(list.id); showToast(`"${list.name}" duplicated`); }}
                style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}
              >
                <Text size="xs" secondary>Duplicate</Text>
              </Pressable>
              <Pressable onPress={handleDelete}
                style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: `${colors.danger}44`, backgroundColor: `${colors.danger}10` }}>
                <Text size="xs" style={{ color: colors.danger }}>Delete list</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

function ListsScreen() {
  const { colors } = useTheme();
  const scrollBottom = useScrollBottomPadding();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 768;
  const { lists, loaded } = useListsData();
  const [creating, setCreating]     = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const params = useLocalSearchParams<{ create?: string; listId?: string }>();
  const handledParam = useRef(false);

  useEffect(() => {
    if (!loaded || handledParam.current) return;
    if (params.create === "1") {
      handledParam.current = true;
      setCreating(true);
    }
  }, [loaded, params.create]);

  // Auto-select first list on desktop when loaded (skip if a specific list was requested)
  useEffect(() => {
    if (isDesktop && loaded && !selectedId && lists.length > 0 && !params.listId) {
      setSelectedId(lists[0].id);
    }
  }, [isDesktop, loaded, lists.length]);

  // Navigate to a specific list when listId param is provided (from sidebar)
  useEffect(() => {
    if (isDesktop && loaded && params.listId) {
      setSelectedId(params.listId);
    }
  }, [isDesktop, loaded, params.listId]);

  // Auto-select newly created list on desktop
  const prevListsLength = useRef(0);
  useEffect(() => {
    if (isDesktop && lists.length > prevListsLength.current && prevListsLength.current > 0) {
      const sorted = [...lists].sort(cmpRecentDesc);
      if (sorted[0]) setSelectedId(sorted[0].id);
    }
    prevListsLength.current = lists.length;
  }, [lists.length, isDesktop]);

  const filtered = lists.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const { syncNow, syncStatus } = useListsSync();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);

  if (!loaded) {
    return (
      <GradientBackground>
        <SafeAreaView edges={["left", "right"]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text size="sm" secondary>Loading…</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const handleToggleExpand = (id: string) => {
    animate();
    setExpandedId(prev => prev === id ? null : id);
  };

  // ── Desktop two-pane layout ──────────────────────────────────────────────────
  if (isDesktop) {
    const selectedList = lists.find(l => l.id === selectedId) ?? null;

    return (
      <GradientBackground>
        <SafeAreaView edges={["left", "right"]} style={{ flex: 1 }}>
          <CreateListModal visible={creating} onDone={() => setCreating(false)} />
          <View style={{ flex: 1, flexDirection: "row" }}>
            {/* Left pane — list index */}
            <View style={{ width: 280, borderRightWidth: 1, borderRightColor: colors.bgBorder, flexShrink: 0 }}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: spacing[16] }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
              >
                {/* Pane header */}
                <View style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  paddingHorizontal: spacing[4], paddingTop: spacing[5], paddingBottom: spacing[3],
                }}>
                  <Text size="xl" weight="bold">Lists</Text>
                  <Pressable
                    onPress={() => setCreating(true)}
                    style={{ width: 28, height: 28, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="add" size={18} color={colors.textInverse} />
                  </Pressable>
                </View>

                {lists.length > 1 && (
                  <View style={{ paddingHorizontal: spacing[3], marginBottom: spacing[2] }}>
                    <SearchBar value={search} onChange={setSearch} placeholder="Search lists…" />
                  </View>
                )}

                {filtered.length === 0 ? (
                  <View style={{ padding: spacing[4] }}>
                    <Text size="sm" secondary>{search ? "No lists match." : 'Tap + to create a list.'}</Text>
                  </View>
                ) : (
                  filtered.map(list => (
                    <ListIndexRow
                      key={list.id}
                      list={list}
                      isSelected={selectedId === list.id}
                      onSelect={() => setSelectedId(list.id)}
                    />
                  ))
                )}
              </ScrollView>
            </View>

            {/* Right pane — list detail */}
            <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
              {selectedList ? (
                <ListDetailPane
                  list={selectedList}
                  otherLists={lists.filter(l => l.id !== selectedList.id)}
                />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[2] }}>
                  <Text size="2xl">✓</Text>
                  <Text size="sm" secondary>Select a list to view its items</Text>
                </View>
              )}
            </View>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── Mobile layout — expand-in-place ──────────────────────────────────────────
  return (
    <GradientBackground>
      <SafeAreaView edges={["left", "right"]} style={{ flex: 1 }}>
      <CreateListModal visible={creating} onDone={() => setCreating(false)} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: scrollBottom }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
          }
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing[4], paddingBottom: spacing[5] }}>
            <View>
              <Text size="2xl" weight="bold">Lists</Text>
              <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>
                {lists.length > 0 ? `${lists.length} list${lists.length !== 1 ? "s" : ""}` : "No lists yet"}
              </Text>
            </View>
            <Pressable onPress={() => setCreating(true)}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, backgroundColor: colors.accent }}>
              <Ionicons name="add" size={15} color={colors.textInverse} />
              <Text size="sm" weight="medium" style={{ color: colors.textInverse }}>New list</Text>
            </Pressable>
          </View>

          {lists.length > 1 && <SearchBar value={search} onChange={setSearch} placeholder="Search lists…" />}

          {filtered.length === 0 && (
            <EmptyState
              type="lists"
              title={search ? "No lists match" : "No lists yet"}
              subtitle={search ? "Try a different search term." : "Create your first list."}
            />
          )}

          {filtered.map(list => (
            <ListCard
              key={list.id}
              list={list}
              isExpanded={expandedId === list.id}
              onToggleExpand={() => handleToggleExpand(list.id)}
              otherLists={lists.filter(l => l.id !== list.id)}
            />
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

export default function ListsScreenBounded() {
  return <ErrorBoundary><ListsScreen /></ErrorBoundary>;
}

