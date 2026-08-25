import React, { useState } from "react";
import { View, Pressable, TextInput as RNTextInput, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius, shape, fontFamily, iconSize, inputText } from "@/lib/theme";
import { useDumpsActions, type Dump } from "@/lib/DumpContext";

type Props = {
  /** Today's sparks, newest first. */
  sparks: Dump[];
  /** YYYY-MM-DD the new spark is filed under. */
  date: string;
  onDelete: (id: string) => void;
};

/**
 * Block B: the brainstem box. One line in, filed against today, listed
 * underneath so the thought visibly landed somewhere. Deliberately separate
 * from the journal: a spark is a fragment, and making it share the journal's
 * text area would mean opening the day's entry to record one.
 */
export function SparkBox({ sparks, date, onDelete }: Props) {
  const { colors } = useTheme();
  const { addDump } = useDumpsActions();
  const [draft, setDraft] = useState("");

  function commit() {
    const content = draft.trim();
    if (!content) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addDump({ tag: "spark", note_date: date, content });
    setDraft("");
  }

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <Text size="cardTitle" weight="semibold">Brainstem ticklers</Text>
        {sparks.length > 0 && (
          <View style={{ ...shape.countPill, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder }}>
            <Text size="meta" tertiary>{sparks.length}</Text>
          </View>
        )}
      </View>

      <View style={{
        flexDirection: "row", alignItems: "center", gap: spacing[2],
        backgroundColor: colors.bgTertiary,
        borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.bgBorder,
        paddingHorizontal: spacing[3], paddingVertical: spacing[2],
      }}>
        <RNTextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          returnKeyType="done"
          blurOnSubmit={false}
          placeholder="…"
          placeholderTextColor={colors.textTertiary}
          style={[
            { flex: 1, ...inputText, fontFamily: fontFamily.regular, color: colors.textPrimary, paddingVertical: 2 },
            { outlineStyle: "none" } as any,
          ]}
        />
        <Pressable
          onPress={commit}
          accessibilityLabel="Save thought"
          style={{
            paddingHorizontal: spacing[2.5], paddingVertical: spacing[1.5],
            borderRadius: radius.md,
            backgroundColor: draft.trim() ? colors.accent : colors.bgSecondary,
          }}
        >
          <Ionicons name="add" size={iconSize.sm} color={draft.trim() ? colors.textInverse : colors.textTertiary} />
        </Pressable>
      </View>

      {sparks.length > 0 && (
        <View style={{ gap: spacing[1.5] }}>
          {sparks.map(s => (
            <View
              key={s.id}
              style={{
                flexDirection: "row", alignItems: "flex-start", gap: spacing[2],
                paddingVertical: spacing[1],
              }}
            >
              <View style={{
                width: 5, height: 5, borderRadius: 99, marginTop: 7,
                backgroundColor: colors.accent,
              }} />
              <Text size="sm" style={{ flex: 1, lineHeight: 20 }}>{s.content}</Text>
              <Pressable onPress={() => onDelete(s.id)} hitSlop={8} accessibilityLabel="Delete thought">
                <Ionicons name="close-outline" size={iconSize.sm} color={colors.textTertiary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
