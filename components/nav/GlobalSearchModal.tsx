import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { useTasks } from "@/lib/TasksContext";
import { useNotes } from "@/lib/NotesContext";
import { SearchResults } from "@/components/dashboard/SearchResults";

type Props = { visible: boolean; onClose: () => void };

export function GlobalSearchModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { tasks } = useTasks();
  const { notes } = useNotes();
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={{ position: "absolute", inset: 0, zIndex: 150, backgroundColor: "rgba(0,0,0,0.6)" } as any}>
      <Pressable style={{ position: "absolute", inset: 0 } as any} onPress={onClose} />
      <View style={{
        position: "absolute",
        top: 80,
        left: "50%",
        transform: [{ translateX: -280 }],
        width: 560,
        maxWidth: "90%" as any,
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.bgBorder,
        overflow: "hidden",
        // @ts-ignore
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.4,
        shadowRadius: 32,
      }}>
        <View style={{
          flexDirection: "row", alignItems: "center", gap: spacing[3],
          paddingHorizontal: spacing[4], paddingVertical: spacing[3],
          borderBottomWidth: query.length > 0 ? 1 : 0,
          borderBottomColor: colors.bgBorder,
        }}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks, lists, notes…"
            placeholderTextColor={colors.textTertiary}
            style={[
              { flex: 1, color: colors.textPrimary, fontSize: 16, fontFamily: fontFamily.regular },
              // @ts-ignore
              { outlineStyle: "none" },
            ]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-outline" size={16} color={colors.textTertiary} />
            </Pressable>
          )}
          <View style={{ backgroundColor: colors.bgTertiary, borderRadius: radius.sm, paddingHorizontal: spacing[1.5], paddingVertical: 2, borderWidth: 1, borderColor: colors.bgBorder }}>
            <Text style={{ fontSize: 11, fontFamily: "monospace" as any, color: colors.textTertiary }}>Esc</Text>
          </View>
        </View>
        {query.trim().length >= 1 ? (
          <ScrollView
            style={{ maxHeight: 480 }}
            contentContainerStyle={{ padding: spacing[4] }}
            keyboardShouldPersistTaps="handled"
          >
            <SearchResults
              tasks={tasks.filter(t => !t.done && !t.archived)}
              notes={notes}
              query={query.trim()}
              onTaskPress={() => onClose()}
            />
          </ScrollView>
        ) : (
          <View style={{ padding: spacing[4], paddingTop: spacing[3] }}>
            <Text style={{ fontSize: 12, fontFamily: fontFamily.regular, color: colors.textTertiary }}>
              Type to search across tasks, lists, and notes
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
