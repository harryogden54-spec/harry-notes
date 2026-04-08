import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, ScrollView, SafeAreaView, TextInput,
  Pressable, KeyboardAvoidingView, Platform, LayoutAnimation, Modal,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Swipeable } from "react-native-gesture-handler";
import { useLocalSearchParams } from "expo-router";

import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox, Divider, EmptyState } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";
import { useLists, LIST_COLORS, type NoteList, type ListItemType } from "@/lib/ListsContext";
import { useToast } from "@/lib/ToastContext";
import { SearchBar } from "@/components/ui/SearchBar";

function animate() {
  if (Platform.OS !== "web") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

// ─── Color Picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: spacing[1.5], flexWrap: "wrap" }}>
      {LIST_COLORS.map(c => (
        <Pressable key={c} onPress={() => onChange(c)}
          style={{ width: 26, height: 26, borderRadius: 99, backgroundColor: c, borderWidth: value === c ? 2 : 0, borderColor: "#fff", transform: [{ scale: value === c ? 1.15 : 1 }] }}
        />
      ))}
    </View>
  );
}

// ─── Create List Modal ────────────────────────────────────────────────────────

function CreateListModal({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const { colors } = useTheme();
  const { addList } = useLists();
  const [name, setName]   = useState("");
  const [color, setColor] = useState(LIST_COLORS[0]);

  function submit() {
    const n = name.trim();
    if (!n) return;
    addList(n, color);
    setName("");
    setColor(LIST_COLORS[0]);
    onDone();
  }

  function cancel() {
    setName("");
    setColor(LIST_COLORS[0]);
    onDone();
  }

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
            paddingBottom: Platform.OS === "ios" ? spacing[10] : spacing[5],
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text size="lg" weight="bold">New list</Text>
              <Pressable onPress={cancel} hitSlop={12}>
                <Text size="sm" style={{ color: colors.textTertiary }}>✕</Text>
              </Pressable>
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
                <Text size="sm" weight="semibold" style={{ color: "#fff" }}>Create list</Text>
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
  item, listId, otherLists,
}: {
  item: { id: string; content: string; type: ListItemType; done: boolean };
  listId: string;
  otherLists: NoteList[];
}) {
  const { colors } = useTheme();
  const { toggleItem, updateItem, deleteItem, moveItem } = useLists();
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
      <View style={{ justifyContent: "center", paddingHorizontal: spacing[4], backgroundColor: "#F2646422", marginLeft: spacing[1] }}>
        <Text size="xs" weight="semibold" style={{ color: "#F26464" }}>✕</Text>
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
            paddingVertical: spacing[2], paddingHorizontal: spacing[1],
            borderRadius: radius.sm,
            backgroundColor: hovered ? colors.bgTertiary : "transparent",
            opacity: item.done ? 0.5 : 1,
          }}
        >
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
                {item.content}
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
  const { addItem } = useLists();
  const [val, setVal]   = useState("");
  const [type, setType] = useState<ListItemType>(defaultType);

  function submit() {
    const v = val.trim();
    if (!v) return;
    addItem(listId, v, type);
    setVal("");
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[2] }}>
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

// ─── List Card ────────────────────────────────────────────────────────────────

function ListCard({ list, isExpanded, onToggleExpand, otherLists }: {
  list: NoteList; isExpanded: boolean; onToggleExpand: () => void; otherLists: NoteList[];
}) {
  const { colors } = useTheme();
  const { updateList, deleteList, duplicateList, pinList } = useLists();
  const { showToast } = useToast();
  const [editingName, setEditingName]   = useState(false);
  const [nameVal, setNameVal]           = useState(list.name);
  const [editingColor, setEditingColor] = useState(false);

  const color = list.color ?? LIST_COLORS[0];
  const items = list.items ?? [];

  // Done items sink to bottom; undone items first
  const activeItems = items.filter(i => !i.done);
  const doneItems   = items.filter(i => i.done);
  const sortedItems = [...activeItems, ...doneItems];

  const checkboxItems = items.filter(i => i.type === "checkbox");
  const done  = checkboxItems.filter(i => i.done).length;
  const total = checkboxItems.length;

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
          <Text size="sm" weight="semibold">{list.name}</Text>
          {items.length > 0 && (
            <Text size="xs" secondary>
              {items.length} item{items.length !== 1 ? "s" : ""}
              {total > 0 ? ` · ${done}/${total} done` : ""}
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
                  style={[{ flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
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

            {/* Items — done items sink to bottom at 50% opacity */}
            {sortedItems.map(item => (
              <ListItemRow key={item.id} item={item} listId={list.id} otherLists={otherLists} />
            ))}

            <AddItemRow listId={list.id} defaultType="checkbox" />

            <Divider />

            {/* Footer actions */}
            <View style={{ flexDirection: "row", gap: spacing[2], justifyContent: "flex-end" }}>
              <Pressable
                onPress={() => { duplicateList(list.id); showToast(`"${list.name}" duplicated`); }}
                style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder }}
              >
                <Text size="xs" secondary>Duplicate</Text>
              </Pressable>
              <Pressable onPress={handleDelete}
                style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: "#F2646444", backgroundColor: "#F2646410" }}>
                <Text size="xs" style={{ color: "#F26464" }}>Delete list</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ListsScreen() {
  const { colors } = useTheme();
  const { lists, loaded } = useLists();
  const [creating, setCreating]     = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const params = useLocalSearchParams<{ create?: string }>();
  const handledParam = useRef(false);

  useEffect(() => {
    if (!loaded || handledParam.current) return;
    if (params.create === "1") {
      handledParam.current = true;
      setCreating(true);
    }
  }, [loaded, params.create]);

  const filtered = lists.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!loaded) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: "center", alignItems: "center" }}>
        <Text size="sm" secondary>Loading…</Text>
      </SafeAreaView>
    );
  }

  const handleToggleExpand = (id: string) => {
    animate();
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <CreateListModal visible={creating} onDone={() => setCreating(false)} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[16], ...webContentStyle }} keyboardShouldPersistTaps="handled">
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
              <Text style={{ color: "#fff", fontSize: 16, lineHeight: 20 }}>+</Text>
              <Text size="sm" weight="medium" style={{ color: "#fff" }}>New list</Text>
            </Pressable>
          </View>

          {lists.length > 1 && <SearchBar value={search} onChange={setSearch} placeholder="Search lists…" />}

          {filtered.length === 0 && (
            <EmptyState
              type="lists"
              title={search ? "No lists match" : "No lists yet"}
              subtitle={search ? "Try a different search term." : 'Tap "New list" to get started.'}
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
  );
}
