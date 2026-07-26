import React from "react";
import { View, TextInput, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox } from "@/components/ui";
import { spacing, radius, fontFamily, getShadow } from "@/lib/theme";
import { useCoursesActions, tableProgress, type CourseTable } from "@/lib/CoursesContext";
import { ProgressRing } from "./ProgressRing";

type Props = {
  table: CourseTable;
  onEdit: () => void;
  onDelete: () => void;
  /** Mobile: render a small progress ring inside the header (desktop shows a
   *  separate ring panel beside the card instead, per the mockup). */
  ringInHeader?: boolean;
  /** Condensed to header only — title, row/tick count and progress ring. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

/** One Courses table: title bar with edit/delete, column headers, editable
 *  rows (text cells inline-editable, tickbox cells as circular checkboxes),
 *  and an add-row action. */
export function CourseTableCard({ table, onEdit, onDelete, ringInHeader, collapsed, onToggleCollapse }: Props) {
  const { colors, scheme } = useTheme();
  const { addRow, deleteRow, updateCell } = useCoursesActions();
  const progress = tableProgress(table);

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: `${colors.bgBorder}88`,
        backgroundColor: colors.bgSecondary,
        overflow: "hidden",
        ...getShadow("sm", scheme),
      }}
    >
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: spacing[3],
        paddingHorizontal: spacing[4], paddingVertical: spacing[3],
        // No divider when condensed — the header IS the card.
        borderBottomWidth: collapsed ? 0 : 1, borderBottomColor: `${colors.bgBorder}88`,
      }}>
        {onToggleCollapse && (
          <Pressable
            onPress={onToggleCollapse}
            hitSlop={8}
            accessibilityLabel={collapsed ? `Expand ${table.title || "table"}` : `Collapse ${table.title || "table"}`}
            style={({ hovered }: any) => ({ padding: spacing[1], borderRadius: radius.md, backgroundColor: hovered ? colors.bgTertiary : "transparent" })}
          >
            <Ionicons name={collapsed ? "chevron-forward" : "chevron-down"} size={15} color={colors.textTertiary} />
          </Pressable>
        )}
        {/* Title is also a collapse affordance — a chevron alone is a small target. */}
        <Pressable onPress={onToggleCollapse} disabled={!onToggleCollapse} style={{ flex: 1, gap: 1 }}>
          <Text size="lg" weight="semibold" numberOfLines={1}>{table.title || "Untitled table"}</Text>
          <Text size="xs" tertiary>
            {table.rows.length} row{table.rows.length !== 1 ? "s" : ""}
            {progress.total > 0 ? ` · ${progress.ticked}/${progress.total} ticked` : ""}
          </Text>
        </Pressable>
        {/* Condensed always shows the ring, whatever the platform — progress is
            the whole point of a collapsed row. */}
        {(ringInHeader || collapsed) && progress.total > 0 && (
          <ProgressRing ticked={progress.ticked} total={progress.total} size={38} />
        )}
        <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel="Edit table"
          style={({ hovered }: any) => ({ padding: spacing[1.5], borderRadius: radius.md, backgroundColor: hovered ? colors.bgTertiary : "transparent" })}>
          {({ hovered }: any) => (
            <Ionicons name="create-outline" size={16} color={hovered ? colors.textPrimary : colors.textTertiary} />
          )}
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel="Delete table"
          style={({ hovered }: any) => ({ padding: spacing[1.5], borderRadius: radius.md, backgroundColor: hovered ? `${colors.danger}14` : "transparent" })}>
          {({ hovered }: any) => (
            <Ionicons name="trash-outline" size={15} color={hovered ? colors.danger : colors.textTertiary} />
          )}
        </Pressable>
      </View>

      {collapsed ? null : <>
      {/* Column headers */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[3], paddingTop: spacing[2.5], paddingBottom: spacing[1.5] }}>
        {table.columns.map(col => (
          <View key={col.id} style={{ flex: 1, paddingHorizontal: spacing[1.5] }}>
            <Text
              size="2xs" weight="semibold" numberOfLines={1}
              style={{
                color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.7,
                textAlign: col.type === "checkbox" ? "center" : "left",
              }}
            >
              {col.name}
            </Text>
          </View>
        ))}
        <View style={{ width: 26 }} />
      </View>

      {/* Rows */}
      {table.rows.map(row => (
        <View
          key={row.id}
          style={{
            flexDirection: "row", alignItems: "center",
            paddingHorizontal: spacing[3], minHeight: 40,
            borderTopWidth: 1, borderTopColor: `${colors.bgBorder}55`,
          }}
        >
          {table.columns.map(col => (
            <View key={col.id} style={{ flex: 1, paddingHorizontal: spacing[1.5], alignItems: col.type === "checkbox" ? "center" : "stretch", justifyContent: "center" }}>
              {col.type === "checkbox" ? (
                <Checkbox
                  shape="circle"
                  size={19}
                  checked={row.cells[col.id] === true}
                  onToggle={() => updateCell(table.id, row.id, col.id, row.cells[col.id] !== true)}
                  accessibilityLabel={`${col.name}`}
                />
              ) : (
                <TextInput
                  value={typeof row.cells[col.id] === "string" ? row.cells[col.id] as string : ""}
                  onChangeText={v => updateCell(table.id, row.id, col.id, v)}
                  placeholder="…"
                  placeholderTextColor={`${colors.textTertiary}88`}
                  multiline={Platform.OS !== "web"}
                  style={[
                    {
                      color: colors.textPrimary, fontSize: 13, fontFamily: fontFamily.regular,
                      paddingVertical: spacing[2.5], paddingHorizontal: 0,
                    },
                    // @ts-ignore
                    { outlineStyle: "none" },
                  ]}
                />
              )}
            </View>
          ))}
          <Pressable
            onPress={() => deleteRow(table.id, row.id)}
            hitSlop={6}
            accessibilityLabel="Delete row"
            style={{ width: 26, alignItems: "center" }}
          >
            {({ hovered }: any) => (
              <Ionicons name="close-outline" size={14} color={hovered ? colors.danger : `${colors.textTertiary}77`} />
            )}
          </Pressable>
        </View>
      ))}

      {/* Add row */}
      <Pressable
        onPress={() => addRow(table.id)}
        style={({ hovered }: any) => ({
          flexDirection: "row", alignItems: "center", gap: spacing[1.5],
          paddingHorizontal: spacing[4], paddingVertical: spacing[2.5],
          borderTopWidth: 1, borderTopColor: `${colors.bgBorder}55`,
          backgroundColor: hovered ? colors.bgTertiary : "transparent",
        })}
      >
        <Ionicons name="add" size={14} color={colors.accent} />
        <Text size="xs" weight="medium" style={{ color: colors.accent }}>Add row</Text>
      </Pressable>
      </>}
    </View>
  );
}
