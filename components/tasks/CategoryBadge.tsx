import React from "react";
import { View } from "react-native";
import { useTheme } from "@/lib/useTheme";
// Direct import, not the barrel: components/ui/index.ts re-exports TaskRow,
// which renders this badge — the barrel would be a require cycle.
import { Text } from "@/components/ui/Text";
import { spacing, resolveAccentSwatch } from "@/lib/theme";
import { useCategoriesData } from "@/lib/TaskCategoriesContext";
import type { TaskCategory, UniCourse } from "@/lib/TasksContext";

type Props = {
  category?: TaskCategory;
  uniCourse?: UniCourse;
  /** Set on the board, where the surrounding column already names the top-level
   *  category — the badge then drops that half and shows only what the column
   *  does not say. */
  rootImplied?: boolean;
};

export const CategoryBadge = React.memo(function CategoryBadge({ category, uniCourse, rootImplied }: Props) {
  const { scheme } = useTheme();
  const { categories } = useCategoriesData();
  if (!category) return null;
  const cat    = categories.find(c => c.id === category);
  const parent = cat?.parent_id ? categories.find(c => c.id === cat.parent_id) : undefined;
  // A subcategory inherits its parent's colour so a column reads as one family.
  const color  = resolveAccentSwatch(parent?.color ?? cat?.color ?? "slate", scheme).color;
  // The legacy "uni" category carries a course; custom categories the user adds
  // have no course concept. The course alone ("Misc") is cryptic away from the
  // Uni column — badges now also appear on dashboard and search rows — so
  // qualify it there. A subcategory shows just its own name: the parent is
  // carried by the inherited colour and, on the board, by its column.
  const label = category === "uni" && uniCourse
    ? (rootImplied ? uniCourse : `${cat?.name ?? "Uni"} · ${uniCourse}`)
    : (cat?.name ?? "Uncategorized");
  return (
    <View style={{
      paddingHorizontal: spacing[1.5], paddingVertical: 2,
      borderRadius: 99, backgroundColor: `${color}18`,
      borderWidth: 1, borderColor: `${color}40`,
    }}>
      <Text size="xs" style={{ color }} numberOfLines={1}>{label}</Text>
    </View>
  );
});
