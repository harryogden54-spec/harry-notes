import React, { useState } from "react";
import { View, Pressable, TextInput, Modal } from "react-native";
import { Text } from "@/components/ui/Text";
import { GlassCard } from "@/components/ui/GlassCard";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";
import { useStickyNotes, type StickyNote } from "@/lib/StickyNotesContext";

interface Props {
  note: StickyNote | null;
  visible: boolean;
  onClose: () => void;
}

export function StickyNoteModal({ note, visible, onClose }: Props) {
  const { colors } = useTheme();
  const { updateNote, deleteNote } = useStickyNotes();
  const [content, setContent] = useState(note?.content ?? "");

  React.useEffect(() => { setContent(note?.content ?? ""); }, [note]);

  if (!note) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing[6] }}
        onPress={onClose}
      >
        <Pressable onPress={e => e.stopPropagation?.()}>
          <GlassCard style={{ borderLeftWidth: 4, borderLeftColor: note.colour }}>
            <View style={{ gap: spacing[3] }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: note.colour }} />
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text size="xs" style={{ color: colors.textTertiary }}>✕</Text>
                </Pressable>
              </View>
              <TextInput
                value={content}
                onChangeText={setContent}
                onBlur={() => updateNote(note.id, content)}
                placeholder="Note content…"
                placeholderTextColor={colors.textTertiary}
                multiline
                autoFocus
                style={[
                  { color: colors.textPrimary, fontSize: 14, lineHeight: 22, minHeight: 100, textAlignVertical: "top" },
                  // @ts-ignore
                  { outlineStyle: "none" },
                ]}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing[2] }}>
                <Pressable
                  onPress={() => { deleteNote(note.id); onClose(); }}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, borderWidth: 1, borderColor: `${colors.danger}44` }}
                >
                  <Text size="xs" style={{ color: colors.danger }}>Delete</Text>
                </Pressable>
                <Pressable
                  onPress={() => { updateNote(note.id, content); onClose(); }}
                  style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radius.sm, backgroundColor: colors.accent }}
                >
                  <Text size="xs" weight="medium" style={{ color: "#fff" }}>Save</Text>
                </Pressable>
              </View>
            </View>
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
