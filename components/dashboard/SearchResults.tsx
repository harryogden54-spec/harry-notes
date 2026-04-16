import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
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
}

export function SearchResults({ tasks, lists, notes, query, onTaskPress }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const q = query.toLowerCase();
  const matchTasks = tasks.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.description?.toLowerCase().includes(q) ||
    (t.tags ?? []).some(tag => tag.includes(q))
  );
  const matchLists = lists.filter(l =>
    l.name.toLowerCase().includes(q) ||
    (l.items ?? []).some(i => i.content.toLowerCase().includes(q))
  );
  const matchNotes = notes.filter(n =>
    n.title.toLowerCase().includes(q) ||
    n.body.toLowerCase().includes(q)
  );

  if (matchTasks.length === 0 && matchLists.length === 0 && matchNotes.length === 0) {
    return <EmptyState type="search" title="No results" subtitle={`Nothing found for "${query}".`} />;
  }

  return (
    <View>
      {matchTasks.length > 0 && (
        <View style={{ marginBottom: spacing[5] }}>
          <Text style={{ fontSize: 11, letterSpacing: 1.2, color: colors.textSecondary, fontFamily: fontFamily.semibold, textTransform: "uppercase", marginBottom: spacing[2] }}>
            Tasks · {matchTasks.length}
          </Text>
          <GlassCard style={{ overflow: "hidden" }}>
            {matchTasks.map((t, i) => (
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
          {matchNotes.map(n => {
            const preview = stripMarkdown(n.body.split("\n").find(l => l.trim()) ?? "");
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
          {matchLists.map(l => {
            const color = l.color ?? colors.accent;
            const items = l.items ?? [];
            return (
              <GlassCard key={l.id} style={{ padding: spacing[3], marginBottom: spacing[2], borderLeftWidth: 3, borderLeftColor: color }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                  <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: color }} />
                  <Text size="sm" weight="semibold">{l.name}</Text>
                  <Text size="xs" secondary style={{ marginLeft: "auto" as any }}>{items.length} items</Text>
                </View>
              </GlassCard>
            );
          })}
        </View>
      )}
    </View>
  );
}
