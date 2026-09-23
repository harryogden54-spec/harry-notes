import React from "react";
import { View, Pressable } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, resolveAccentSwatch } from "@/lib/theme";
import type { TaskCategory, UniCourse } from "@/lib/TasksContext";
import { useCategoriesData, topLevel, childrenOf, rootCategoryId } from "@/lib/TaskCategoriesContext";

type Props = {
  category?: TaskCategory;
  uniCourse?: UniCourse;
  onChange: (category?: TaskCategory, uniCourse?: UniCourse) => void;
};

export function CategorySelector({ category, onChange }: Props) {
  const { colors, scheme } = useTheme();
  const { categories } = useCategoriesData();
  const sorted = topLevel(categories);
  // The hard-coded UNI_COURSES chip row that used to sit under "Uni" is gone
  // (2026-09-23): it listed last year's modules and ran parallel to real Uni
  // subcategories, which is where this semester's courses live (the Courses
  // tracker files its tasks there). A task that still carries a legacy
  // `uniCourse` keeps showing it via CategoryBadge; any category change here
  // clears it, since the subcategory now says the same thing.
  // Whichever top-level category is in play — either it is selected directly or
  // one of its children is. Drives which subcategory row shows.
  const activeRootId = rootCategoryId(categories, category);
  const subs = activeRootId ? childrenOf(categories, activeRootId) : [];
  const rootCat = activeRootId ? categories.find(c => c.id === activeRootId) : undefined;
  const rootSwatch = resolveAccentSwatch(rootCat?.color ?? "stone", scheme);

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: "row", gap: spacing[1.5], flexWrap: "wrap" }}>
        {sorted.map(cat => {
          // Selecting a child keeps the parent chip lit — the task IS in it.
          const active = activeRootId === cat.id;
          const swatch = resolveAccentSwatch(cat.color, scheme);
          return (
            <Pressable
              key={cat.id}
              onPress={() => onChange(active ? undefined : cat.id, undefined)}
              style={{
                paddingHorizontal: spacing[2], paddingVertical: spacing[1],
                borderRadius: 99, borderWidth: 1,
                borderColor: active ? swatch.color : colors.bgBorder,
                backgroundColor: active ? swatch.subtle : "transparent",
              }}
            >
              <Text size="xs" style={{ color: active ? swatch.color : colors.textSecondary }}>{cat.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {/* Subcategory row — a task sits in the parent or in exactly one child. */}
      {subs.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1], alignItems: "center" }}>
          <Text size="2xs" tertiary style={{ marginRight: spacing[1] }}>in</Text>
          {subs.map(sub => {
            const active = category === sub.id;
            return (
              <Pressable
                key={sub.id}
                // Tapping the active child clears back to the parent rather than
                // to no category — you chose the parent first.
                onPress={() => onChange(active ? activeRootId : sub.id, undefined)}
                style={{
                  paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
                  borderRadius: 99, borderWidth: 1,
                  borderColor: active ? rootSwatch.color : colors.bgBorder,
                  backgroundColor: active ? `${rootSwatch.color}18` : "transparent",
                }}
              >
                <Text size="xs" style={{ color: active ? rootSwatch.color : colors.textSecondary }}>{sub.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
