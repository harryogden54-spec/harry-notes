import React, { useState, useRef, useCallback } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  View, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, Modal, RefreshControl,
} from "react-native";
// Side-notch padding only — PersistentHeader owns the top inset, MobileTabBar the bottom.
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist";
import { useTheme } from "@/lib/useTheme";
import { Text, Surface, GradientBackground, FocusTimer } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useScrollBottomPadding } from "@/lib/TabBarHeightContext";
import { webContentStyle } from "@/lib/webLayout";
import { useTasksData } from "@/lib/TasksContext";
import { useTodayData, useTodayActions, useTodaySync, type TodayItem } from "@/lib/TodayContext";
import { getTodayStr, formatHeaderDate } from "@/lib/utils";
import { useMounted } from "@/lib/useMounted";

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;

// ── Timeline helpers ───────────────────────────────────────────────────────────

const TIMELINE_HOURS = [
  "06:00","07:00","08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00","19:00",
  "20:00","21:00","22:00",
];

function formatHour(time: string) {
  const h = parseInt(time.split(":")[0], 10);
  if (h === 0)  return "12am";
  if (h < 12)   return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

function byOrder(a: TodayItem, b: TodayItem) {
  return a.order - b.order;
}

function TodayScreen() {
  const { colors } = useTheme();
  const scrollBottom = useScrollBottomPadding(spacing[24]);
  const { tasks } = useTasksData();
  const { items: allItems } = useTodayData();
  const { addItem: addTodayItem, toggleItem, deleteItem, updateItemTime, moveItem, reorderActive } = useTodayActions();
  const { syncNow } = useTodaySync();
  const [input, setInput]             = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const mounted = useMounted();
  const [showTimer, setShowTimer]       = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timePickerFor, setTimePickerFor] = useState<string | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  const dateLabel = mounted ? formatHeaderDate() : "";

  // The context store holds ALL days' items — carry-forward (past incomplete
  // items get today's date) runs inside TodayContext itself. Active items are
  // today's slice; done items stay listed past their day (user request
  // 2026-07-12) — newest day first, manual order within a day.
  const todayStr = getTodayStr();
  const dayItems = allItems.filter(i => i.date === todayStr);
  const active    = dayItems.filter(i => !i.done).sort(byOrder);
  const completed = allItems.filter(i => i.done)
    .sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order);

  // Suggestions: overdue + today tasks sorted by priority, not already in list
  const existingTexts = new Set(dayItems.map(i => i.text.toLowerCase()));
  const suggestions = tasks
    .filter(t =>
      !t.done && !t.archived &&
      !!t.due_date && t.due_date <= todayStr &&
      !existingTexts.has(t.title.toLowerCase())
    )
    .sort((a, b) => {
      const ai = a.priority ? PRIORITY_ORDER.indexOf(a.priority as any) : 99;
      const bi = b.priority ? PRIORITY_ORDER.indexOf(b.priority as any) : 99;
      return ai - bi;
    })
    .slice(0, 6);

  function addItem() {
    const text = input.trim();
    if (!text) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addTodayItem(text);
    setInput("");
  }

  function addSuggestion(title: string) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addTodayItem(title);
  }

  const onToggleItem = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleItem(id);
  }, [toggleItem]);

  const onDeleteItem = useCallback((id: string) => {
    deleteItem(id);
  }, [deleteItem]);

  // Web reorder affordance — native uses long-press drag instead.
  const onMoveItem = useCallback((id: string, dir: "up" | "down") => {
    moveItem(id, todayStr, dir);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveItem, todayStr]);

  const onDragEndActive = useCallback((data: TodayItem[]) => {
    reorderActive(todayStr, data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reorderActive, todayStr]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow().catch(() => {});
    setRefreshing(false);
  }, [syncNow]);

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
        {/* Reorder: long-press drag handle on native, ↑/↓ buttons on web
            (RNGH drag is unreliable on web — same pattern as TaskItem). */}
        {Platform.OS !== "web" ? (
          <Pressable onLongPress={drag} hitSlop={8} delayLongPress={150}>
            <Ionicons name="reorder-three-outline" size={18} color={colors.textTertiary} />
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", gap: 2 }}>
            <Pressable onPress={() => onMoveItem(item.id, "up")} hitSlop={6}
              style={{ padding: 3, borderRadius: 4, backgroundColor: colors.bgTertiary }}>
              <Text size="xs" style={{ color: colors.textTertiary }}>↑</Text>
            </Pressable>
            <Pressable onPress={() => onMoveItem(item.id, "down")} hitSlop={6}
              style={{ padding: 3, borderRadius: 4, backgroundColor: colors.bgTertiary }}>
              <Text size="xs" style={{ color: colors.textTertiary }}>↓</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => onToggleItem(item.id)}
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

        <Pressable onPress={() => onDeleteItem(item.id)} hitSlop={8}>
          <Ionicons name="close-outline" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>
    </ScaleDecorator>
  );

  return (
    <GradientBackground>
      <SafeAreaView edges={["left", "right"]} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

          {/* Time-picker modal */}
          <Modal visible={timePickerFor !== null} transparent animationType="slide" onRequestClose={() => setTimePickerFor(null)}>
            <Pressable
              style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
              onPress={() => setTimePickerFor(null)}
            >
              <Pressable onPress={() => {}}>
                <View style={{ backgroundColor: colors.bgSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[5], gap: spacing[4] }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text size="base" weight="semibold">Set time block</Text>
                    <Pressable onPress={() => setTimePickerFor(null)} hitSlop={12}>
                      <Ionicons name="close-outline" size={18} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                    {TIMELINE_HOURS.map(h => {
                      const current = timePickerFor ? active.find(i => i.id === timePickerFor)?.time_block : undefined;
                      const isActive = current === h;
                      return (
                        <Pressable
                          key={h}
                          onPress={() => { if (timePickerFor) updateItemTime(timePickerFor, h); setTimePickerFor(null); }}
                          style={{
                            paddingHorizontal: spacing[3], paddingVertical: spacing[2],
                            borderRadius: radius.sm, borderWidth: 1,
                            borderColor: isActive ? colors.accent : colors.bgBorder,
                            backgroundColor: isActive ? `${colors.accent}18` : colors.bgTertiary,
                            minWidth: 60, alignItems: "center",
                          }}
                        >
                          <Text size="sm" style={{ color: isActive ? colors.accent : colors.textPrimary }}>{formatHour(h)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    onPress={() => { if (timePickerFor) updateItemTime(timePickerFor, undefined); setTimePickerFor(null); }}
                    style={{ alignSelf: "center", paddingVertical: spacing[2] }}
                  >
                    <Text size="sm" style={{ color: colors.danger }}>Clear time</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[{ padding: spacing[4], paddingBottom: scrollBottom }, webContentStyle]}
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
            <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5], flexDirection: "row", alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}>
                <Text size="2xl" weight="bold">Today</Text>
                <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>{dateLabel}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                <Pressable
                  onPress={() => setShowTimeline(v => !v)}
                  style={{
                    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
                    borderRadius: radius.sm, borderWidth: 1,
                    borderColor: showTimeline ? colors.accent : colors.bgBorder,
                    backgroundColor: showTimeline ? `${colors.accent}18` : "transparent",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="time-outline" size={12} color={showTimeline ? colors.accent : colors.textTertiary} />
                    <Text size="xs" style={{ color: showTimeline ? colors.accent : colors.textTertiary }}>Timeline</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => setShowTimer(v => !v)}
                  style={{
                    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
                    borderRadius: radius.sm, borderWidth: 1,
                    borderColor: showTimer ? colors.accent : colors.bgBorder,
                    backgroundColor: showTimer ? `${colors.accent}18` : "transparent",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="timer-outline" size={12} color={showTimer ? colors.accent : colors.textTertiary} />
                    <Text size="xs" style={{ color: showTimer ? colors.accent : colors.textTertiary }}>Focus</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Focus timer widget */}
            {showTimer && (
              <View style={{ marginBottom: spacing[4] }}>
                <FocusTimer />
              </View>
            )}

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
                    <Text size="xs" weight="medium" style={{ color: colors.textInverse }}>Add</Text>
                  </Pressable>
                )}
              </View>
            </Surface>

            {/* Empty state + suggestions */}
            {dayItems.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: spacing[10], gap: spacing[3] }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: `${colors.accent}18`,
                  borderWidth: 2, borderColor: `${colors.accent}40`,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name="sunny-outline" size={28} color={colors.accent} />
                </View>
                <Text size="base" weight="semibold">Nothing yet</Text>
                <Text size="sm" secondary style={{ textAlign: "center" }}>
                  Add what you want to get done today.{"\n"}Resets daily at midnight.
                </Text>
              </View>
            )}

            {/* Suggestions — full panel when empty, collapsed chip when list has items */}
            {suggestions.length > 0 && (
              <View style={{ marginTop: spacing[2] }}>
                {dayItems.length > 0 ? (
                  // Collapsed chip — tapping reveals the same panel below
                  <Pressable
                    onPress={() => setShowSuggestions(v => !v)}
                    style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], alignSelf: "flex-start" }}
                  >
                    <Text size="xs" weight="semibold" style={{
                      textTransform: "uppercase", letterSpacing: 1.2,
                      color: showSuggestions ? colors.accent : colors.textSecondary, fontSize: 11,
                    }}>
                      SUGGESTED · {suggestions.length}
                    </Text>
                    <Ionicons
                      name={showSuggestions ? "chevron-up" : "chevron-down"}
                      size={12} color={showSuggestions ? colors.accent : colors.textTertiary}
                    />
                  </Pressable>
                ) : (
                  <Text size="xs" weight="semibold" style={{
                    textTransform: "uppercase", letterSpacing: 1.2,
                    color: colors.textSecondary, fontSize: 11,
                    marginBottom: spacing[2],
                  }}>
                    SUGGESTED · {suggestions.length}
                  </Text>
                )}
                {(dayItems.length === 0 || showSuggestions) && (
                  <Surface style={{ overflow: "hidden", padding: 0, marginTop: spacing[2] }}>
                    {suggestions.map((task, i) => (
                      <View key={task.id} style={{
                        flexDirection: "row", alignItems: "center",
                        paddingHorizontal: spacing[4], paddingVertical: spacing[3],
                        gap: spacing[3],
                        borderBottomWidth: i === suggestions.length - 1 ? 0 : 1,
                        borderBottomColor: colors.bgBorder,
                      }}>
                        <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: task.due_date && task.due_date < todayStr ? colors.danger : colors.warning }} />
                        <Text size="sm" style={{ flex: 1, color: colors.textPrimary }} numberOfLines={1}>{task.title}</Text>
                        {task.due_date && task.due_date < todayStr && (
                          <Text size="xs" style={{ color: colors.danger, marginRight: spacing[1] }}>Overdue</Text>
                        )}
                        <Pressable
                          onPress={() => addSuggestion(task.title)}
                          style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm, backgroundColor: `${colors.accent}18`, borderWidth: 1, borderColor: `${colors.accent}40` }}
                        >
                          <Text size="xs" style={{ color: colors.accent }} weight="medium">+ Add</Text>
                        </Pressable>
                      </View>
                    ))}
                  </Surface>
                )}
              </View>
            )}

            {/* Active items — list or timeline */}
            {active.length > 0 && !showTimeline && (
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
                    onDragEnd={({ data }) => onDragEndActive(data)}
                    scrollEnabled={false}
                    activationDistance={Platform.OS === "web" ? 999 : 12}
                    removeClippedSubviews={Platform.OS !== "web"}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                  />
                </Surface>
              </View>
            )}

            {/* Timeline view */}
            {showTimeline && active.length > 0 && (
              <TimelineSection
                items={active}
                colors={colors}
                onToggle={onToggleItem}
                onDelete={onDeleteItem}
                onPickTime={setTimePickerFor}
                onClearTime={id => updateItemTime(id, undefined)}
              />
            )}

            {showTimeline && active.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: spacing[6] }}>
                <Text size="sm" secondary>No active items to schedule.</Text>
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
                      onToggle={() => onToggleItem(item.id)}
                      onDelete={() => onDeleteItem(item.id)}
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
          borderColor: colors.textInverse,
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
        <Ionicons name="close-outline" size={16} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

// ── TimelineSection ───────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>["colors"];

type TimelineSectionProps = {
  items: TodayItem[];
  colors: Colors;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPickTime: (id: string) => void;
  onClearTime: (id: string) => void;
};

function TimelineSection({ items, colors, onToggle, onDelete, onPickTime, onClearTime }: TimelineSectionProps) {
  const scheduled   = items.filter(i => i.time_block);
  const unscheduled = items.filter(i => !i.time_block);

  return (
    <>
      {/* Hour grid */}
      <View style={{ marginBottom: spacing[4], borderRadius: radius.xl, borderWidth: 1, borderColor: colors.bgBorder, overflow: "hidden", backgroundColor: colors.bgSecondary }}>
        {TIMELINE_HOURS.map((hour, idx) => {
          const slotItems = scheduled.filter(i => i.time_block === hour);
          const isLast = idx === TIMELINE_HOURS.length - 1;
          return (
            <View
              key={hour}
              style={{
                flexDirection: "row",
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: colors.bgBorder,
                minHeight: slotItems.length > 0 ? undefined : 36,
              }}
            >
              {/* Time label */}
              <View style={{ width: 44, paddingTop: spacing[2], paddingLeft: spacing[3], alignItems: "flex-start" }}>
                <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: fontFamily.medium }}>
                  {formatHour(hour)}
                </Text>
              </View>
              {/* Slot divider + items */}
              <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.bgBorder, paddingHorizontal: spacing[3], paddingVertical: slotItems.length > 0 ? spacing[1.5] : 0, gap: spacing[1] }}>
                {slotItems.map(item => (
                  <TimelineItemRow
                    key={item.id}
                    item={item}
                    colors={colors}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onPickTime={onPickTime}
                    onClearTime={onClearTime}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {/* Unscheduled items */}
      {unscheduled.length > 0 && (
        <View style={{ marginBottom: spacing[4] }}>
          <Text size="xs" weight="semibold" style={{
            textTransform: "uppercase", letterSpacing: 1.2,
            color: colors.textSecondary, fontSize: 11, marginBottom: spacing[2],
          }}>
            UNSCHEDULED · {unscheduled.length}
          </Text>
          <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.bgBorder, overflow: "hidden", backgroundColor: colors.bgSecondary }}>
            {unscheduled.map((item, i) => (
              <View key={item.id} style={{ borderBottomWidth: i === unscheduled.length - 1 ? 0 : 1, borderBottomColor: colors.bgBorder }}>
                <TimelineItemRow
                  item={item}
                  colors={colors}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onPickTime={onPickTime}
                  onClearTime={onClearTime}
                />
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

type TimelineItemRowProps = {
  item: TodayItem;
  colors: Colors;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPickTime: (id: string) => void;
  onClearTime: (id: string) => void;
};

function TimelineItemRow({ item, colors, onToggle, onDelete, onPickTime, onClearTime }: TimelineItemRowProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], paddingVertical: spacing[1.5], paddingHorizontal: spacing[1] }}>
      {/* Checkbox */}
      <Pressable
        onPress={() => onToggle(item.id)}
        hitSlop={8}
        style={{
          width: 18, height: 18, borderRadius: 9,
          borderWidth: 1.5, borderColor: colors.bgBorder,
          backgroundColor: "transparent",
          alignItems: "center", justifyContent: "center",
        }}
      />
      {/* Text */}
      <Text size="sm" style={{ flex: 1, color: colors.textPrimary }} numberOfLines={2}>{item.text}</Text>
      {/* Clock button — assign / change time */}
      <Pressable onPress={() => item.time_block ? onClearTime(item.id) : onPickTime(item.id)} hitSlop={8}>
        <Ionicons name="timer-outline" size={14} color={item.time_block ? colors.accent : colors.textTertiary} />
      </Pressable>
      {/* If has time, show change button */}
      {item.time_block && (
        <Pressable onPress={() => onPickTime(item.id)} hitSlop={8}>
          <Text size="xs" style={{ color: colors.accent }}>{formatHour(item.time_block)}</Text>
        </Pressable>
      )}
      {/* Delete */}
      <Pressable onPress={() => onDelete(item.id)} hitSlop={8}>
        <Ionicons name="close-outline" size={16} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

export default function TodayScreenBounded() {
  return <ErrorBoundary><TodayScreen /></ErrorBoundary>;
}
