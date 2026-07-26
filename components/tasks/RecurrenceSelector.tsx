import React, { useState } from "react";
import { View, Pressable, ScrollView, Modal, SafeAreaView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius } from "@/lib/theme";
import { RECURRENCE_PRESETS, recurrenceLabel } from "@/lib/utils";
import { Chip } from "./Chip";

type Props = { value?: string; onChange: (r: string | undefined) => void };

export function RecurrenceSelector({ value, onChange }: Props) {
  const { colors } = useTheme();
  const [showModal, setShowModal] = useState(false);

  if (value) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5], alignItems: "center" }}>
        <Chip
          label={`↻ ${recurrenceLabel(value)}`}
          color={colors.accent}
          onRemove={() => onChange(undefined)}
        />
        <Pressable onPress={() => setShowModal(true)}>
          <Text size="xs" style={{ color: colors.textTertiary }}>Change</Text>
        </Pressable>
        <RecurrenceModal
          visible={showModal}
          current={value}
          onSelect={r => { onChange(r); setShowModal(false); }}
          onClose={() => setShowModal(false)}
        />
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5], alignItems: "center" }}>
      <Pressable
        onPress={() => setShowModal(true)}
        style={{
          paddingHorizontal: spacing[2], paddingVertical: spacing[1],
          borderRadius: radius.sm, borderWidth: 1, borderColor: colors.bgBorder,
        }}
      >
        <Text size="xs" style={{ color: colors.textSecondary }}>Set recurrence…</Text>
      </Pressable>
      <RecurrenceModal
        visible={showModal}
        current={value}
        onSelect={r => { onChange(r); setShowModal(false); }}
        onClose={() => setShowModal(false)}
      />
    </View>
  );
}

function RecurrenceModal({
  visible, current, onSelect, onClose,
}: {
  visible: boolean;
  current?: string;
  onSelect: (r: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  // Sheet clears the home indicator from the measured inset — the old
  // Platform.OS === "ios" check is false in the iOS PWA.
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.bgSecondary,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingBottom: insets.bottom + spacing[6],
            paddingTop: spacing[4],
          }}
          onPress={e => e.stopPropagation()}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing[5], marginBottom: spacing[3] }}>
            <Text size="base" weight="semibold">Repeat</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text size="sm" style={{ color: colors.textTertiary }}>Done</Text>
            </Pressable>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.bgBorder }}>
            {RECURRENCE_PRESETS.map(preset => (
              <Pressable
                key={preset.value}
                onPress={() => onSelect(preset.value)}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  paddingHorizontal: spacing[5], paddingVertical: spacing[3],
                  borderBottomWidth: 1, borderBottomColor: colors.bgBorder,
                }}
              >
                <Text size="sm" style={{ color: preset.value === current ? colors.accent : colors.textPrimary }}>
                  {preset.label}
                </Text>
                {preset.value === current && (
                  <Ionicons name="checkmark" size={14} color={colors.accent} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
