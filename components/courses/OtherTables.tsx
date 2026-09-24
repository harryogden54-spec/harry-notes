import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, iconSize, transition } from "@/lib/theme";
import { storage } from "@/lib/storage";
import {
  useCoursesData, useCoursesActions, tableProgress, isTrackerTable, type CourseTable,
} from "@/lib/CoursesContext";
import { useToast } from "@/lib/ToastContext";
import { CourseTableCard } from "./CourseTableCard";
import { TableEditorModal } from "./TableEditorModal";

const COLLAPSED_KEY = "courses_collapsed";
const OPEN_KEY = "courses_other_open";

/**
 * The free-form progress tables that were the whole Courses screen before the
 * semester tracker. Kept — last year's modules and any ad-hoc table still live
 * here — but folded away under one disclosure, since the tracker above now
 * does the week-to-week job.
 */
export function OtherTables() {
  const { colors } = useTheme();
  const { tables } = useCoursesData();
  const { deleteTable, setTableArchived } = useCoursesActions();
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<CourseTable | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);

  useEffect(() => {
    storage.get<string[]>(COLLAPSED_KEY).then(v => { if (Array.isArray(v)) setCollapsedIds(v); });
    storage.get<boolean>(OPEN_KEY).then(v => { if (typeof v === "boolean") setOpen(v); });
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen(prev => { storage.set(OPEN_KEY, !prev); return !prev; });
  }, []);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      storage.set(COLLAPSED_KEY, next);
      return next;
    });
  }, []);

  const { live, archived } = useMemo(() => {
    const own = tables.filter(t => !isTrackerTable(t));
    return {
      live: own.filter(t => !t.archived).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      archived: own.filter(t => t.archived),
    };
  }, [tables]);

  const handleArchive = useCallback((table: CourseTable) => {
    setTableArchived(table.id, true);
    showToast(`"${table.title || "Untitled table"}" archived`, {
      label: "Undo", onPress: () => setTableArchived(table.id, false),
    });
  }, [setTableArchived, showToast]);

  const handleDelete = useCallback((table: CourseTable) => {
    const undo = deleteTable(table.id);
    showToast(`"${table.title || "Untitled table"}" deleted`, { label: "Undo", onPress: undo });
  }, [deleteTable, showToast]);

  const count = live.length + archived.length;

  return (
    <View style={{ gap: spacing[3] }}>
      {/* A quiet ruled row, not a section label — this is last year's material. */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: spacing[2],
        borderTopWidth: 1, borderTopColor: colors.bgBorder, paddingHorizontal: spacing[1],
      }}>
        <Pressable
          onPress={toggleOpen}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={{ flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing[2] }}
        >
          <Ionicons
            name="chevron-forward" size={iconSize.xs} color={colors.textTertiary}
            style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}
          />
          <Text size="sm" weight="medium" secondary>Other tables</Text>
          {count > 0 && <Text size="meta" tertiary>{count}</Text>}
        </Pressable>
        {open && (
          <Pressable
            onPress={() => { setEditTarget(null); setEditorVisible(true); }}
            accessibilityRole="button"
            accessibilityLabel="New table"
            style={({ hovered }: any) => ({
              flexDirection: "row", alignItems: "center", gap: 4,
              paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md,
              backgroundColor: hovered ? colors.bgTertiary : "transparent",
              ...transition("background-color"),
            } as any)}
          >
            <Ionicons name="add" size={iconSize.sm} color={colors.accent} />
            <Text size="xs" weight="medium" style={{ color: colors.accent }}>New table</Text>
          </Pressable>
        )}
      </View>

      {open && (
        <View style={{ gap: spacing[3] }}>
          {live.length === 0 && (
            <Text size="sm" tertiary>No other tables — make one for anything the tracker doesn't cover.</Text>
          )}
          {live.map(table => (
            <CourseTableCard
              key={table.id}
              table={table}
              ringInHeader
              collapsed={collapsedIds.includes(table.id)}
              onToggleCollapse={() => toggleCollapsed(table.id)}
              onEdit={() => { setEditTarget(table); setEditorVisible(true); }}
              onArchive={() => handleArchive(table)}
              onDelete={() => handleDelete(table)}
            />
          ))}

          {archived.length > 0 && (
            <View style={{ gap: spacing[2], marginTop: spacing[2] }}>
              <Text size="label" weight="semibold" tertiary style={{ textTransform: "uppercase" }}>
                Archived · {archived.length}
              </Text>
              {archived.map(table => {
                const p = tableProgress(table);
                return (
                  <View
                    key={table.id}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: spacing[3],
                      borderRadius: radius.lg, borderWidth: 1, borderColor: `${colors.bgBorder}88`,
                      backgroundColor: colors.bgSecondary,
                      paddingHorizontal: spacing[4], paddingVertical: spacing[3],
                    }}
                  >
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text size="cardTitle" weight="semibold" numberOfLines={1} secondary>
                        {table.title || "Untitled table"}
                      </Text>
                      <Text size="meta" tertiary>
                        {table.rows.length} row{table.rows.length !== 1 ? "s" : ""}
                        {p.total > 0 ? ` · ${p.ticked}/${p.total} ticked` : ""}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setTableArchived(table.id, false)}
                      accessibilityLabel={`Restore ${table.title || "table"}`}
                      style={({ hovered }: any) => ({
                        paddingHorizontal: spacing[2.5], paddingVertical: 11, marginVertical: -5,
                        borderRadius: radius.md,
                        backgroundColor: hovered ? colors.bgTertiary : "transparent",
                      })}
                    >
                      <Text size="xs" style={{ color: colors.accent }}>Restore</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(table)}
                      accessibilityLabel={`Delete ${table.title || "table"}`}
                      style={({ hovered }: any) => ({
                        padding: 11, margin: -5, borderRadius: radius.md,
                        backgroundColor: hovered ? `${colors.danger}14` : "transparent",
                      })}
                    >
                      {({ hovered }: any) => (
                        <Ionicons name="trash-outline" size={iconSize.sm} color={hovered ? colors.danger : colors.textTertiary} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      <TableEditorModal visible={editorVisible} onClose={() => setEditorVisible(false)} table={editTarget} />
    </View>
  );
}
