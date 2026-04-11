import React, { useState, useRef, useCallback } from "react";
import {
  View, SafeAreaView, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { Text, GlassCard } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { webContentStyle } from "@/lib/webLayout";

type TodayItem = {
  id: string;
  text: string;
  done: boolean;
};

function getTodayLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const [items, setItems]       = useState<TodayItem[]>([]);
  const [input, setInput]       = useState("");
  const inputRef                = useRef<TextInput | null>(null);

  const active    = items.filter(i => !i.done);
  const completed = items.filter(i => i.done);

  function addItem() {
    const text = input.trim();
    if (!text) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(prev => [{ id: `t_${Date.now()}`, text, done: false }, ...prev]);
    setInput("");
  }

  const toggleItem = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const rest = prev.filter(i => i.id !== id);
      // Un-completing moves back to top; completing pushes to bottom
      if (item.done) {
        return [{ ...item, done: false }, ...rest];
      }
      return [...rest, { ...item, done: true }];
    });
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ padding: spacing[4], paddingBottom: spacing[24] }, webContentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5] }}>
            <Text size="2xl" weight="bold">Today</Text>
            <Text size="sm" secondary style={{ marginTop: spacing[0.5] }}>{getTodayLabel()}</Text>
          </View>

          {/* Add input */}
          <GlassCard style={{ marginBottom: spacing[4], padding: 0, overflow: "hidden" }}>
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
          </GlassCard>

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

          {/* Active items */}
          {active.length > 0 && (
            <View style={{ marginBottom: spacing[4] }}>
              <Text size="xs" weight="semibold" style={{
                textTransform: "uppercase", letterSpacing: 1.2,
                color: colors.textSecondary, fontSize: 11,
                marginBottom: spacing[2],
              }}>
                TO DO · {active.length}
              </Text>
              <GlassCard style={{ overflow: "hidden", padding: 0 }}>
                {active.map((item, i) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleItem(item.id)}
                    onDelete={() => deleteItem(item.id)}
                    isLast={i === active.length - 1}
                  />
                ))}
              </GlassCard>
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
              <GlassCard style={{ overflow: "hidden", padding: 0 }}>
                {completed.map((item, i) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleItem(item.id)}
                    onDelete={() => deleteItem(item.id)}
                    isLast={i === completed.length - 1}
                  />
                ))}
              </GlassCard>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ItemRow({ item, onToggle, onDelete, isLast }: {
  item: TodayItem;
  onToggle: () => void;
  onDelete: () => void;
  isLast: boolean;
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
          borderColor: item.done ? colors.accent : colors.bgBorder,
          backgroundColor: item.done ? colors.accent : "transparent",
          alignItems: "center", justifyContent: "center",
        }}
      >
        {item.done && (
          <View style={{
            width: 10, height: 5,
            borderLeftWidth: 1.5, borderBottomWidth: 1.5,
            borderColor: "#fff",
            transform: [{ rotate: "-45deg" }, { translateY: -1 }],
          }} />
        )}
      </Pressable>

      <Text
        size="sm"
        style={{
          flex: 1,
          color: item.done ? colors.textTertiary : colors.textPrimary,
          textDecorationLine: item.done ? "line-through" : "none",
          opacity: item.done ? 0.6 : 1,
        }}
      >
        {item.text}
      </Text>

      <Pressable onPress={onDelete} hitSlop={8}>
        <Text size="xs" style={{ color: colors.textTertiary }}>✕</Text>
      </Pressable>
    </View>
  );
}
