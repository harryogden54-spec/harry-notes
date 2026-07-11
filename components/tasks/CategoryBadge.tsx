import React from "react";
import { View } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, resolveAccentSwatch } from "@/lib/theme";
import { useCategoriesData } from "@/lib/TaskCategoriesContext";
import type { TaskCategory, UniCourse } from "@/lib/TasksContext";

type Props = { category?: TaskCategory; uniCourse?: UniCourse };

export const CategoryBadge = React.memo(function CategoryBadge({ category, uniCourse }: Props) {
  const { scheme } = useTheme();
  const { categories } = useCategoriesData();
  if (!category) return null;
  const cat   = categories.find(c => c.id === category);
  const color = resolveAccentSwatch(cat?.color ?? "slate", scheme).color;
  // The legacy "uni" category shows its course instead of the plain name —
  // custom categories the user adds have no course concept.
  const label = category === "uni" && uniCourse ? uniCourse : (cat?.name ?? "Uncategorized");
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
