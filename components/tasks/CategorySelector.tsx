import React from "react";
import { View, Pressable } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, radius, categoryColors } from "@/lib/theme";
import { UNI_COURSES, type TaskCategory, type UniCourse } from "@/lib/TasksContext";

type Props = {
  category?: TaskCategory;
  uniCourse?: UniCourse;
  onChange: (category?: TaskCategory, uniCourse?: UniCourse) => void;
};

export function CategorySelector({ category, uniCourse, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: "row", gap: spacing[1.5] }}>
        <Pressable
          onPress={() => onChange(category === "personal" ? undefined : "personal", undefined)}
          style={{
            paddingHorizontal: spacing[2], paddingVertical: spacing[1],
            borderRadius: radius.sm, borderWidth: 1,
            borderColor: category === "personal" ? colors.accent : colors.bgBorder,
            backgroundColor: category === "personal" ? colors.bgTertiary : "transparent",
          }}
        >
          <Text size="xs" style={{ color: category === "personal" ? colors.accent : colors.textSecondary }}>Personal</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange(category === "uni" ? undefined : "uni", uniCourse ?? "Misc")}
          style={{
            paddingHorizontal: spacing[2], paddingVertical: spacing[1],
            borderRadius: radius.sm, borderWidth: 1,
            borderColor: category === "uni" ? colors.accent : colors.bgBorder,
            backgroundColor: category === "uni" ? colors.bgTertiary : "transparent",
          }}
        >
          <Text size="xs" style={{ color: category === "uni" ? colors.accent : colors.textSecondary }}>Uni</Text>
        </Pressable>
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
                borderColor: uniCourse === course ? categoryColors.uni : colors.bgBorder,
                backgroundColor: uniCourse === course ? `${categoryColors.uni}18` : "transparent",
              }}
            >
              <Text size="xs" style={{ color: uniCourse === course ? categoryColors.uni : colors.textSecondary }}>
                {course}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
