import React, { useState, useEffect } from "react";
import { View, Pressable, TextInput } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";
import { STICKY_COLOURS } from "@/lib/StickyNotesContext";

const SHEET_HEIGHT = 300;

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (content: string, colour: string) => void;
}

export function QuickAddNoteSheet({ visible, onClose, onAdd }: Props) {
  const { colors } = useTheme();
  const [content, setContent] = useState("");
  const [colour, setColour]   = useState<string>(STICKY_COLOURS[0]);

  const translateY = useSharedValue(SHEET_HEIGHT);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  useEffect(() => {
    translateY.value = withSpring(visible ? 0 : SHEET_HEIGHT, { damping: 22, stiffness: 260 });
  }, [visible]);

  function submit() {
    const c = content.trim();
    if (!c) return;
    onAdd(c, colour);
    setContent("");
    setColour(STICKY_COLOURS[0]);
    onClose();
  }

  return (
    <Animated.View style={[animatedStyle, {
      position: "absolute", left: 0, right: 0, bottom: 0,
      backgroundColor: colors.bgSecondary,
      borderTopWidth: 1, borderTopColor: colors.bgBorder,
      borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"],
      padding: spacing[5],
      gap: spacing[4],
    }]}>
      <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: colors.bgBorder, alignSelf: "center", marginBottom: spacing[1] }} />
      <Text size="base" weight="semibold">Quick note</Text>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Note content…"
        placeholderTextColor={colors.textTertiary}
        multiline
        autoFocus={visible}
        style={[
          {
            color: colors.textPrimary, fontSize: 14,
            paddingVertical: spacing[3], paddingHorizontal: spacing[3],
            backgroundColor: colors.bgTertiary, borderRadius: radius.lg,
            borderWidth: 1, borderColor: colour,
            minHeight: 88, textAlignVertical: "top", lineHeight: 22,
          },
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />
      <View style={{ flexDirection: "row", gap: spacing[3], alignItems: "center" }}>
        <Text size="xs" secondary>Colour</Text>
        {STICKY_COLOURS.map(c => (
          <Pressable
            key={c}
            onPress={() => setColour(c)}
            style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: c,
              borderWidth: colour === c ? 2 : 0,
              borderColor: "#fff",
              transform: [{ scale: colour === c ? 1.2 : 1 }],
            }}
          />
        ))}
      </View>
      <Pressable
        onPress={submit}
        style={{
          backgroundColor: content.trim() ? colors.accent : colors.bgTertiary,
          borderRadius: radius.lg, paddingVertical: spacing[3],
          alignItems: "center",
        }}
      >
        <Text size="sm" weight="semibold" style={{ color: content.trim() ? "#fff" : colors.textTertiary }}>
          Add note
        </Text>
      </Pressable>
    </Animated.View>
  );
}
