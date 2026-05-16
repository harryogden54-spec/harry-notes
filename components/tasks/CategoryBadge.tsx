import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { spacing, categoryColors } from "@/lib/theme";
import type { TaskCategory, UniCourse } from "@/lib/TasksContext";

type Props = { category?: TaskCategory; uniCourse?: UniCourse };

export const CategoryBadge = React.memo(function CategoryBadge({ category, uniCourse }: Props) {
  if (!category) return null;
  const isUni  = category === "uni";
  const color  = isUni ? categoryColors.uni : categoryColors.personal;
  const label  = isUni ? (uniCourse ?? "Uni") : "Personal";
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
