import { useMemo } from "react";
import { useTheme } from "@/lib/useTheme";
import { resolveAccentSwatch } from "@/lib/theme";
import { SEMESTER_COURSES, type CourseKey } from "@/lib/semester";

export type CourseSwatch = { color: string; hover: string; subtle: string };

/** Each course's identity colour for the active scheme (per-scheme accent
 *  variants, so the colour clears contrast as text on both backgrounds). */
export function useCourseColors(): Record<CourseKey, CourseSwatch> {
  const { scheme } = useTheme();
  return useMemo(() => Object.fromEntries(
    SEMESTER_COURSES.map(c => [c.key, resolveAccentSwatch(c.accent, scheme)])
  ) as Record<CourseKey, CourseSwatch>, [scheme]);
}
