import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Modal, View, TextInput, Pressable, ScrollView,
  Platform, useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCommandPalette } from "@/lib/CommandPaletteContext";
import { useTasks, type Task } from "@/lib/TasksContext";
import { useNotes } from "@/lib/NotesContext";
import { useToast } from "@/lib/ToastContext";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius, fontFamily } from "@/lib/theme";
import { PRIORITY_CONFIG, formatDate } from "@/components/tasks/constants";

// ── Navigation shortcuts ───────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Go to Home",     icon: "home-outline",          route: "/(tabs)/"        },
  { label: "Go to Today",    icon: "today-outline",         route: "/(tabs)/today"   },
  { label: "Go to Tasks",    icon: "checkbox-outline",      route: "/(tabs)/tasks"   },
  { label: "Go to Notes",    icon: "document-text-outline", route: "/(tabs)/notes"   },
  { label: "Go to Lists",    icon: "list-outline",          route: "/(tabs)/lists"   },
  { label: "Go to Calendar", icon: "calendar-outline",      route: "/(tabs)/calendar"},
] as const;

// ── Result union type ──────────────────────────────────────────────────────────
type NavItem    = { type: "nav";    label: string; icon: string; route: string };
type CreateItem = { type: "create"; label: string };
type TaskResult = { type: "task";   task: Task };
type NoteResult = { type: "note";   id: string; title: string; preview: string };
type ResultItem = NavItem | CreateItem | TaskResult | NoteResult;

export function CommandPalette() {
  const { isOpen, close }       = useCommandPalette();
  const { tasks, addTask }      = useTasks();
  const { notes }               = useNotes();
  const { showToast }           = useToast();
  const { colors }              = useTheme();
  const router                  = useRouter();
  const inputRef                = useRef<TextInput>(null);
  const [query, setQuery]       = useState("");
  const [selIdx, setSelIdx]     = useState(0);
  const { width }               = useWindowDimensions();
  const isWide                  = width > 640;

  // Build results list
  const results: ResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS.map(n => ({ ...n, type: "nav" as const }));
    const out: ResultItem[] = [{ type: "create", label: query.trim() }];
    tasks
      .filter(t => !t.done && !t.archived && t.title.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach(t => out.push({ type: "task", task: t }));
    notes
      .filter(n => (n.title + " " + n.body).toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(n => out.push({
        type: "note", id: n.id,
        title: n.title || "Untitled",
        preview: n.body.split("\n").find(l => l.trim()) ?? "",
      }));
    return out;
  }, [query, tasks, notes]);

  // Reset + focus when opening
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelIdx(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Clamp selection when result count changes
  useEffect(() => {
    setSelIdx(i => Math.min(i, Math.max(results.length - 1, 0)));
  }, [results.length]);

  function execute(item: ResultItem) {
    if (item.type === "create") {
      addTask(item.label);
      showToast(`Task added: ${item.label}`);
    } else if (item.type === "nav") {
      router.push(item.route as any);
    } else if (item.type === "task") {
      router.push(`/(tabs)/tasks?taskId=${item.task.id}` as any);
    } else if (item.type === "note") {
      router.push(`/(tabs)/notes?openId=${item.id}` as any);
    }
    close();
  }

  function handleKeyPress(e: any) {
    switch (e.nativeEvent.key) {
      case "ArrowDown": setSelIdx(i => Math.min(i + 1, results.length - 1)); break;
      case "ArrowUp":   setSelIdx(i => Math.max(i - 1, 0)); break;
      case "Escape":    close(); break;
      case "Enter": {
        const item = results[selIdx];
        if (item) execute(item);
        break;
      }
    }
  }

  const cardW = isWide ? Math.min(560, width - 48) : width - 32;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      {/* Backdrop */}
      <Pressable
        style={{
          flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          paddingTop: isWide ? (Platform.OS === "web" ? "15%" : 80) : spacing[8],
        }}
        onPress={close}
      >
        {/* Card — absorb taps so backdrop doesn't close */}
        <Pressable
          onPress={() => {}}
          style={{
            width: cardW,
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.xl,
            borderWidth: 1, borderColor: colors.bgBorder,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.45,
            shadowRadius: 32,
            elevation: 12,
          }}
        >
          {/* Input row */}
          <View style={{
            flexDirection: "row", alignItems: "center",
            paddingHorizontal: spacing[4], paddingVertical: spacing[3],
            gap: spacing[3],
            borderBottomWidth: results.length > 0 ? 1 : 0,
            borderBottomColor: colors.bgBorder,
          }}>
            <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={t => { setQuery(t); setSelIdx(0); }}
              onKeyPress={handleKeyPress}
              onSubmitEditing={() => { const it = results[selIdx]; if (it) execute(it); }}
              placeholder="Search or create task…"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="go"
              style={[
                { flex: 1, color: colors.textPrimary, fontSize: 16, fontFamily: fontFamily.regular },
                // @ts-ignore
                { outlineStyle: "none" },
              ]}
            />
            {Platform.OS === "web" && (
              <View style={{
                paddingHorizontal: spacing[1.5], paddingVertical: 2,
                borderRadius: 4, borderWidth: 1, borderColor: colors.bgBorder,
                backgroundColor: colors.bgTertiary,
              }}>
                <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: fontFamily.semibold }}>esc</Text>
              </View>
            )}
          </View>

          {/* Results list */}
          {results.length > 0 && (
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
              {results.map((item, i) => {
                const active = i === selIdx;
                return (
                  <Pressable
                    key={`${item.type}-${i}`}
                    onPress={() => execute(item)}
                    // @ts-ignore
                    onMouseEnter={() => setSelIdx(i)}
                    style={{
                      flexDirection: "row", alignItems: "center",
                      paddingHorizontal: spacing[4], paddingVertical: spacing[3],
                      gap: spacing[3],
                      backgroundColor: active ? `${colors.accent}14` : "transparent",
                      borderLeftWidth: 2, borderLeftColor: active ? colors.accent : "transparent",
                    }}
                  >
                    {/* Icon badge */}
                    <View style={{
                      width: 28, height: 28, borderRadius: radius.sm,
                      backgroundColor: item.type === "create" ? `${colors.accent}20` : colors.bgTertiary,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      {item.type === "create" && <Ionicons name="add"                  size={16} color={colors.accent} />}
                      {item.type === "nav"    && <Ionicons name={item.icon as any}      size={16} color={colors.textSecondary} />}
                      {item.type === "task"   && <Ionicons name="checkbox-outline"      size={16} color={colors.textTertiary} />}
                      {item.type === "note"   && <Ionicons name="document-text-outline" size={16} color={colors.textTertiary} />}
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                      {item.type === "create" && (
                        <>
                          <Text style={{ fontSize: 10, color: colors.accent, fontFamily: fontFamily.semibold, textTransform: "uppercase", letterSpacing: 1 }}>
                            New task
                          </Text>
                          <Text size="sm" style={{ color: colors.textPrimary }} numberOfLines={1}>{item.label}</Text>
                        </>
                      )}
                      {item.type === "nav" && (
                        <Text size="sm" style={{ color: colors.textPrimary }}>{item.label}</Text>
                      )}
                      {item.type === "task" && (
                        <>
                          <Text size="sm" style={{ color: colors.textPrimary }} numberOfLines={1}>{item.task.title}</Text>
                          {item.task.due_date && (
                            <Text size="xs" style={{ color: colors.textTertiary }}>{formatDate(item.task.due_date)}</Text>
                          )}
                        </>
                      )}
                      {item.type === "note" && (
                        <>
                          <Text size="sm" style={{ color: colors.textPrimary }} numberOfLines={1}>{item.title}</Text>
                          {item.preview && (
                            <Text size="xs" style={{ color: colors.textTertiary }} numberOfLines={1}>{item.preview}</Text>
                          )}
                        </>
                      )}
                    </View>

                    {/* Right accessory */}
                    {item.type === "task" && item.task.priority && (
                      <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: PRIORITY_CONFIG[item.task.priority].color }} />
                    )}
                    {item.type === "create" && (
                      <Text style={{ fontSize: 13, color: colors.textTertiary }}>↵</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Footer keyboard hints — web only */}
          {Platform.OS === "web" && (
            <View style={{
              flexDirection: "row", gap: spacing[4], alignItems: "center",
              paddingHorizontal: spacing[4], paddingVertical: spacing[2],
              borderTopWidth: 1, borderTopColor: colors.bgBorder,
              backgroundColor: colors.bgTertiary,
            }}>
              {([["↵", "select"], ["↑↓", "navigate"], ["esc", "dismiss"]] as [string, string][]).map(([key, label]) => (
                <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                  <View style={{
                    paddingHorizontal: 4, paddingVertical: 1,
                    borderRadius: 3, borderWidth: 1, borderColor: colors.bgBorder,
                    backgroundColor: colors.bgSecondary,
                  }}>
                    <Text style={{ fontSize: 10, color: colors.textTertiary }}>{key}</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: colors.textTertiary }}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
