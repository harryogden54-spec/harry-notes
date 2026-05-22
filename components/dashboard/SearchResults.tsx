import React, { useMemo } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – fuse.js ships types but they are not resolved in this project setup
import Fuse from "fuse.js";
import { Text } from "@/components/ui/Text";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskRow } from "@/components/ui/TaskRow";
import { useTheme } from "@/lib/useTheme";
import { spacing, fontFamily } from "@/lib/theme";
import { stripMarkdown } from "@/lib/utils";
import type { Task } from "@/lib/TasksContext";
import type { NoteList } from "@/lib/ListsContext";
import type { Note } from "@/lib/NotesContext";

interface Props {
  tasks: Task[];
  lists: NoteList[];
  notes: Note[];
  query: string;
  onTaskPress: (id: string) => void;
  /** Called when the user presses Enter (or the "Add as task" button) on a no-results query. */
  onAdd?: (title: string) => void;
}

export function SearchResults({ tasks, lists, notes, query, onTaskPress, onAdd }: Props) {
  const { colors } = useTheme();
  const router = useRouter();

  const matchTasks = useMemo(() => {
    if (!query) return [];
    const fuse = new Fuse(tasks, { keys: ["title", "description"], threshold: 0.35, ignoreLocation: true });
    return fuse.search(query).map((r: { item: Task }) => r.item).slice(0, 8);
  }, [tasks, query]);

  const matchNotes = useMemo(() => {
    if (!query) return [];
    const fuse = new Fuse(notes, { keys: ["title", "body"], threshold: 0.35, ignoreLocation: true });
    return fuse.search(query).map((r: { item: Note }) => r.item).slice(0, 6);
  }, [notes, query]);

  const matchLists = useMemo(() => {
    if (!query) return [];
    const fuse = new Fuse(lists, { keys: ["name", "items.content"], threshold: 0.35, ignoreLocation: true });
    return fuse.search(query).map((r: { item: NoteList }) => r.item).slice(0, 5);
  }, [lists, query]);

  if (matchTasks.length === 0 && matchLists.length === 0 && matchNotes.length === 0) {
    return (
      <View>
        <EmptyState type="search" title="No results" subtitle={`Nothing found for "${query}".`} />
        {onAdd && (
          <Pressable
            onPress={() => onAdd(query)}
            style={{
              alignSelf: "center", marginTop: spacing[2],
              paddingHorizontal: spacing[4], paddingVertical: spacing[2],
              borderRadius: 99, borderWidth: 1, borderColor: colors.accent,
              backgroundColor: `${colors.accent}14`,
            }}
          >
            <Text size="sm" style={{ color: colors.accent }}>
              + Add "{query}" as a task
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View>
      {matchTasks.length > 0 && (
        <View style={{ marginBottom: spacing[5] }}>
          <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.textSecondary, fontFamily: fontFamily.semibold, textTransform: "uppercase", marginBottom: spacing[2] }}>
            Tasks · {matchTasks.length}
          </Text>
          <GlassCard style={{ overflow: "hidden" }}>
            {matchTasks.map((t: Task, i: number) => (
              <View key={t.id} style={i === matchTasks.length - 1 ? { borderBottomWidth: 0 } : undefined}>
                <TaskRow task={t} onPress={() => onTaskPress(t.id)} />
              </View>
            ))}
          </GlassCard>
        </View>
      )}
      {matchNotes.length > 0 && (
        <View style={{ marginBottom: spacing[5] }}>
          <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.textSecondary, fontFamily: fontFamily.semibold, textTransform: "uppercase", marginBottom: spacing[2] }}>
            Notes · {matchNotes.length}
          </Text>
          {matchNotes.map((n: Note) => {
            const preview = stripMarkdown(n.body.split("\n").find((l: string) => l.trim()) ?? "");
            return (
              <Pressable key={n.id} onPress={() => router.push(`/(tabs)/notes?openId=${n.id}` as any)}>
                <GlassCard style={{ padding: spacing[3], marginBottom: spacing[2] }}>
                  <Text size="sm" weight="semibold" numberOfLines={1}>{n.title || "Untitled"}</Text>
                  {preview ? <Text size="xs" secondary numberOfLines={1} style={{ marginTop: 2 }}>{preview}</Text> : null}
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      )}
      {matchLists.length > 0 && (
        <View>
          <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.textSecondary, fontFamily: fontFamily.semibold, textTransform: "uppercase", marginBottom: spacing[2] }}>
            Lists · {matchLists.length}
          </Text>
          {matchLists.map((l: NoteList) => {
            const color = l.color ?? colors.accent;
            const items = l.items ?? [];
            const done  = items.filter((i: NoteList["items"][number]) => i.type === "checkbox" && i.done).length;
            const total = items.filter((i: NoteList["items"][number]) => i.type === "checkbox").length;
            return (
              <Pressable key={l.id} onPress={() => router.push("/(tabs)/lists" as any)}>
                <GlassCard style={{ padding: spacing[3], marginBottom: spacing[2], borderLeftWidth: 3, borderLeftColor: color }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                    <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: color }} />
                    <Text size="sm" weight="semibold">{l.name}</Text>
                    <Text size="xs" secondary style={{ marginLeft: "auto" as any }}>
                      {total > 0 ? `${done}/${total}` : `${items.length} items`}
                    </Text>
                  </View>
                  {total > 0 && (
                    <View style={{ height: 3, borderRadius: 99, backgroundColor: `${color}30`, marginTop: spacing[2] }}>
                      <View style={{ height: 3, borderRadius: 99, backgroundColor: color, width: `${Math.round(done / total * 100)}%` as any }} />
                    </View>
                  )}
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
