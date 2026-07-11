import React from "react";
import { View, Pressable } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius, resolveAccentSwatch } from "@/lib/theme";
import { UNI_COURSES, type TaskCategory, type UniCourse } from "@/lib/TasksContext";
import { useCategoriesData } from "@/lib/TaskCategoriesContext";

type Props = {
  category?: TaskCategory;
  uniCourse?: UniCourse;
  onChange: (category?: TaskCategory, uniCourse?: UniCourse) => void;
};

export function CategorySelector({ category, uniCourse, onChange }: Props) {
  const { colors, scheme } = useTheme();
  const { categories } = useCategoriesData();
  const sorted = [...categories].sort((a, b) => a.order - b.order);
  // The uni-course sub-picker only applies to the legacy "uni" seeded
  // category (custom categories the user adds have no course concept).
  const uniCat = sorted.find(c => c.id === "uni");
  const uniSwatch = resolveAccentSwatch(uniCat?.color ?? "orchid", scheme);

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: "row", gap: spacing[1.5], flexWrap: "wrap" }}>
        {sorted.map(cat => {
          const active = category === cat.id;
          const swatch = resolveAccentSwatch(cat.color, scheme);
          return (
            <Pressable
              key={cat.id}
              onPress={() => onChange(
                active ? undefined : cat.id,
                !active && cat.id === "uni" ? (uniCourse ?? "Misc") : undefined
              )}
              style={{
                paddingHorizontal: spacing[2], paddingVertical: spacing[1],
                borderRadius: radius.sm, borderWidth: 1,
                borderColor: active ? swatch.color : colors.bgBorder,
                backgroundColor: active ? swatch.subtle : "transparent",
              }}
            >
              <Text size="xs" style={{ color: active ? swatch.color : colors.textSecondary }}>{cat.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {category === "uni" && (
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
          {UNI_COURSES.map(course => (
            <Pressable
              key={course}
              onPress={() => onChange("uni", course)}
              style={{
                paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
                borderRadius: 99, borderWidth: 1,
                borderColor: uniCourse === course ? uniSwatch.color : colors.bgBorder,
                backgroundColor: uniCourse === course ? `${uniSwatch.color}18` : "transparent",
              }}
            >
              <Text size="xs" style={{ color: uniCourse === course ? uniSwatch.color : colors.textSecondary }}>
                {course}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
