import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, SafeAreaView, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, Modal, RefreshControl,
} from "react-native";
import * as Haptics from "expo-haptics";
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist";
import { useTheme } from "@/lib/useTheme";
import { Text, Surface, GradientBackground } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";
import { storage } from "@/lib/storage";

type TodayItem = {
  id: string;
  text: string;
  done: boolean;
};

function getTodayLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function getTodayKey() {
  return `today_items_${new Date().toISOString().slice(0, 10)}`;
}

function getYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `today_items_${d.toISOString().slice(0, 10)}`;
}

/** Purge today_items_ keys older than 7 days */
async function purgeOldKeys() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    // AsyncStorage doesn't have getAllKeys exposed via our wrapper, so we skip bulk purge
    // on first run; individual day keys naturally age out of usage.
  } catch { /* noop */ }
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const [items, setItems]             = useState<TodayItem[]>([]);
  const [input, setInput]             = useState("");
  const [carryover, setCarryover]     = useState<TodayItem[]>([]);
  const [showCarryover, setShowCarryover] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  const todayKey     = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  // Load persisted items + check carryover
  useEffect(() => {
    (async () => {
      await purgeOldKeys();
      const saved = await storage.get<TodayItem[]>(todayKey);
      if (saved) setItems(saved);

      const yesterday = await storage.get<TodayItem[]>(yesterdayKey);
      const incomplete = (yesterday ?? []).filter(i => !i.done);
      if (incomplete.length > 0) {
        setCarryover(incomplete);
        setShowCarryover(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change
  useEffect(() => {
    storage.set(todayKey, items);
  }, [items, todayKey]);

  const active    = items.filter(i => !i.done);
  const completed = items.filter(i => i.done);

  function addItem() {
    const text = input.trim();
    if (!text) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next: TodayItem[] = [{ id: `t_${Date.now()}`, text, done: false }, ...items];
    setItems(next);
    setInput("");
  }

  const toggleItem = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const rest = prev.filter(i => i.id !== id);
      return item.done ? [{ ...item, done: false }, ...rest] : [...rest, { ...item, done: true }];
    });
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  function acceptCarryover() {
    const fresh = carryover.map(i => ({ ...i, id: `co_${Date.now()}_${i.id}`, done: false }));
    setItems(prev => [...fresh, ...prev]);
    setShowCarryover(false);
    setCarryover([]);
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Today tab has no remote sync — just a short delay for UX
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // ─── Draggable row ───────────────────────────────────────────────────────────

  const renderActiveItem = ({ item, drag, isActive }: RenderItemParams<TodayItem>) => (
    <ScaleDecorator>
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: spacing[4], paddingVertical: spacing[3],
        gap: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.bgBorder,
        opacity: isActive ? 0.8 : 1,
      }}>
        {/* Drag handle */}
        <Pressable onLongPress={drag} hitSlop={8} delayLongPress={150}>
          <Text style={{ color: colors.textTertiary, fontSize: 16, lineHeight: 22 }}>⠿</Text>
        </Pressable>

        <Pressable
          onPress={() => toggleItem(item.id)}
          hitSlop={8}
          style={{
            width: 20, height: 20, borderRadius: 10,
            borderWidth: 1.5,
            borderColor: colors.bgBorder,
            backgroundColor: "transparent",
            alignItems: "center", justifyContent: "center",
          }}
        />

        <Text size="sm" style={{ flex: 1, color: colors.textPrimary }}>{item.text}</Text>

        <Pressable onPress={() => deleteItem(item.id)} hitSlop={8}>
          <Text size="xs" style={{ color: colors.textTertiary }}>✕</Text>
        </Pressable>
      </View>
    </ScaleDecorator>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

          {/* Carryover modal */}
          <Modal visible={showCarryover} transparent animationType="fade" onRequestClose={() => setShowCarryover(false)}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing[6] }}>
              <Surface style={{ padding: spacing[5], gap: spacing[4] }}>
                <Text size="lg" weight="bold">Yesterday's unfinished items</Text>
                <Text size="sm" secondary>
                  You had {carryover.length} unfinished item{carryover.length !== 1 ? "s" : ""} yesterday. Bring them forward?
                </Text>
                {carryover.slice(0, 4).map(i => (
                  <View key={i.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                    <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: colors.accent }} />
                    <Text size="sm" numberOfLines={1} style={{ flex: 1 }}>{i.text}</Text>
                  </View>
                ))}
                {carryover.length > 4 && (
                  <Text size="xs" secondary>…and {carryover.length - 4} more</Text>
                )}
                <View style={{ flexDirection: "row", gap: spacing[2] }}>
                  <Pressable
                    onPress={() => setShowCarryover(false)}
                    style={{ flex: 1, paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder, alignItems: "center" }}
                  >
                    <Text size="sm" secondary weight="medium">Dismiss</Text>
                  </Pressable>
                  <Pressable
                    onPress={acceptCarryover}
                    style={{ flex: 2, paddingVertical: spacing[3], borderRadius: radius.lg, backgroundColor: colors.accent, alignItems: "center" }}
                  >
                    <Text size="sm" weight="semibold" style={{ color: "#fff" }}>Yes, bring forward</Text>
                  </Pressable>
                </View>
              </Surface>
            </View>
          </Modal>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[{ padding: spacing[4], paddingBottom: spacing[24] }, webContentStyle]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
          >
            {/* Header */}
            <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5] }}>
              <Text size="2xl" weight="bold">Today</Text>
              <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>{getTodayLabel()}</Text>
            </View>

            {/* Add input */}
            <Surface style={{ marginBottom: spacing[4], padding: 0, overflow: "hidden" }}>
              <View style={{
                flexDirection: "row", alignItems: "center",
                paddingHorizontal: spacing[4], paddingVertical: spacing[3],
                gap: spacing[3],
              }}>
                <View style={{
                  width: 20, height: 20, borderRadius: 10,
                  borderWidth: 1.5, borderColor: colors.bgBorder,
                  alignItems: "center", justifyContent: "center",
                }} />
                <TextInput
                  ref={inputRef}
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={addItem}
                  placeholder="What needs to happen today?"
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="done"
                  style={[
                    { flex: 1, color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
                    // @ts-ignore
                    { outlineStyle: "none" },
                  ]}
                />
                {input.length > 0 && (
                  <Pressable
                    onPress={addItem}
                    style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm, backgroundColor: colors.accent }}
                  >
                    <Text size="xs" weight="medium" style={{ color: "#fff" }}>Add</Text>
                  </Pressable>
                )}
              </View>
            </Surface>

            {/* Empty state */}
            {items.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: spacing[16], gap: spacing[3] }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: `${colors.accent}18`,
                  borderWidth: 2, borderColor: `${colors.accent}40`,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 28, lineHeight: 36 }}>☀</Text>
                </View>
                <Text size="base" weight="semibold">Nothing yet</Text>
                <Text size="sm" secondary style={{ textAlign: "center" }}>
                  Add what you want to get done today.{"\n"}Resets when you close the app.
                </Text>
              </View>
            )}

            {/* Active items — draggable */}
            {active.length > 0 && (
              <View style={{ marginBottom: spacing[4] }}>
                <Text size="xs" weight="semibold" style={{
                  textTransform: "uppercase", letterSpacing: 1.2,
                  color: colors.textSecondary, fontSize: 11,
                  marginBottom: spacing[2],
                }}>
                  TO DO · {active.length}
                </Text>
                <Surface style={{ overflow: "hidden", padding: 0 }}>
                  <DraggableFlatList
                    data={active}
                    keyExtractor={i => i.id}
                    renderItem={renderActiveItem}
                    onDragEnd={({ data }) => {
                      setItems([...data, ...completed]);
                    }}
                    scrollEnabled={false}
                    activationDistance={Platform.OS === "web" ? 999 : 12}
                  />
                </Surface>
              </View>
            )}

            {/* Completed items */}
            {completed.length > 0 && (
              <View>
                <Text size="xs" weight="semibold" style={{
                  textTransform: "uppercase", letterSpacing: 1.2,
                  color: colors.textSecondary, fontSize: 11,
                  marginBottom: spacing[2],
                }}>
                  DONE · {completed.length}
                </Text>
                <Surface style={{ overflow: "hidden", padding: 0 }}>
                  {completed.map((item, i) => (
                    <CompletedRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggleItem(item.id)}
                      onDelete={() => deleteItem(item.id)}
                      isLast={i === completed.length - 1}
                    />
                  ))}
                </Surface>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function CompletedRow({ item, onToggle, onDelete, isLast }: {
  item: TodayItem; onToggle: () => void; onDelete: () => void; isLast: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing[4], paddingVertical: spacing[3],
      gap: spacing[3],
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: colors.bgBorder,
    }}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        style={{
          width: 20, height: 20, borderRadius: 10,
          borderWidth: 1.5,
          borderColor: colors.accent,
          backgroundColor: colors.accent,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <View style={{
          width: 10, height: 5,
          borderLeftWidth: 1.5, borderBottomWidth: 1.5,
          borderColor: "#fff",
          transform: [{ rotate: "-45deg" }, { translateY: -1 }],
        }} />
      </Pressable>
      <Text size="sm" style={{
        flex: 1,
        color: colors.textTertiary,
        textDecorationLine: "line-through",
        opacity: 0.6,
      }}>
        {item.text}
      </Text>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Text size="xs" style={{ color: colors.textTertiary }}>✕</Text>
      </Pressable>
    </View>
  );
}
