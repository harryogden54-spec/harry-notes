import React, { useMemo, useDeferredValue } from "react";
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
import { noteDisplayTitle } from "@/components/notes/utils";
import type { Task } from "@/lib/TasksContext";
import type { Note } from "@/lib/NotesContext";

interface Props {
  tasks: Task[];
  notes: Note[];
  query: string;
  onTaskPress: (id: string) => void;
  /** Called when the user presses Enter (or the "Add as task" button) on a no-results query. */
  onAdd?: (title: string) => void;
}

/** True when none of the matched fields contain the word "body". */
function isTitleOnlyMatch(result: { matches?: Array<{ key?: string }> }): boolean {
  if (!result.matches || result.matches.length === 0) return false;
  return result.matches.every(m => m.key !== "body");
}

export function SearchResults({ tasks, notes, query, onTaskPress, onAdd }: Props) {
  const { colors } = useTheme();
  const router = useRouter();

  // Index construction is split from query execution: the Fuse index rebuilds
  // only when the collection changes, never per keystroke. The query runs
  // against a deferred value so typing stays responsive on large collections.
  const deferredQuery = useDeferredValue(query);

  const taskFuse = useMemo(
    () => new Fuse(tasks, { keys: ["title", "description"], threshold: 0.35, ignoreLocation: true }),
    [tasks]
  );
  const noteFuse = useMemo(
    () => new Fuse(notes, {
      keys: [
        { name: "body",  weight: 0.7 },
        { name: "title", weight: 0.3 },
      ],
      threshold: 0.4,
      ignoreLocation: true,
      includeMatches: true,
    }),
    [notes]
  );

  const matchTasks = useMemo(() => {
    if (!deferredQuery) return [];
    return taskFuse.search(deferredQuery).map((r: { item: Task }) => r.item).slice(0, 8);
  }, [taskFuse, deferredQuery]);

  /**
   * Feature 16 — body-first search for notes.
   * Body matches score higher (weight 0.7) than title matches (weight 0.3).
   * Within the results, body-matched notes come first; title-only matches
   * are visually demoted (secondary colour, italic "title match" chip).
   */
  const matchNotes = useMemo(() => {
    if (!deferredQuery) return [] as Array<{ note: Note; titleOnly: boolean }>;
    const raw = noteFuse.search(deferredQuery) as Array<{ item: Note; matches?: Array<{ key?: string }> }>;
    const annotated = raw.slice(0, 8).map(r => ({ note: r.item, titleOnly: isTitleOnlyMatch(r) }));
    // Body matches first, then title-only
    return [
      ...annotated.filter(a => !a.titleOnly),
      ...annotated.filter(a => a.titleOnly),
    ];
  }, [noteFuse, deferredQuery]);

  if (matchTasks.length === 0 && matchNotes.length === 0) {
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
          <Text size="label" weight="semibold" secondary style={{ textTransform: "uppercase", marginBottom: spacing[2] }}>
            Tasks · {matchTasks.length}
          </Text>
          <GlassCard style={{ overflow: "hidden" }}>
            {matchTasks.map((t: Task, i: number) => (
              <View key={t.id} style={i === matchTasks.length - 1 ? { borderBottomWidth: 0 } : undefined}>
                <TaskRow task={t} onPress={onTaskPress} />
              </View>
            ))}
          </GlassCard>
        </View>
      )}
      {matchNotes.length > 0 && (
        <View style={{ marginBottom: spacing[5] }}>
          <Text size="label" weight="semibold" secondary style={{ textTransform: "uppercase", marginBottom: spacing[2] }}>
            Notes · {matchNotes.length}
          </Text>
          {matchNotes.map(({ note: n, titleOnly }) => {
            // For body matches: show the first non-empty line of the body as a preview.
            // For title-only matches: demote visually with secondary title colour + badge.
            const preview = stripMarkdown(n.body.split("\n").find((l: string) => l.trim()) ?? "");
            return (
              <Pressable key={n.id} onPress={() => router.push(`/(tabs)/notes?openId=${n.id}` as any)}>
                <GlassCard style={{ padding: spacing[3], marginBottom: spacing[2], opacity: titleOnly ? 0.72 : 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5], marginBottom: preview ? 2 : 0 }}>
                    <Text
                      size="sm"
                      weight="semibold"
                      numberOfLines={1}
                      style={{ flex: 1, color: titleOnly ? colors.textSecondary : colors.textPrimary }}
                    >
                      {noteDisplayTitle(n)}
                    </Text>
                    {titleOnly && (
                      <View style={{ backgroundColor: `${colors.textTertiary}22`, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 9, color: colors.textTertiary, fontFamily: fontFamily.medium }}>title</Text>
                      </View>
                    )}
                  </View>
                  {!titleOnly && preview ? (
                    <Text size="xs" secondary numberOfLines={1}>{preview}</Text>
                  ) : null}
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
