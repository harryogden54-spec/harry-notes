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

/**
 * Three derived surfaces the Courses screen uses beyond the base tokens:
 *  - `accentInk`: accent as small text/marks. On a dark scheme the base accent
 *    reads dim at 11px, so its hover step (one notch lighter) carries it.
 *  - `accentWash`: a translucent accent fill for the "Make a task" pill. The
 *    `accentSubtle` token is opaque and tuned for the page background; this
 *    sits on a card, where an alpha wash stays the same hue on any surface.
 *  - `tileBg`: the per-course tiles inside the rings card — raised, but
 *    see-through on dark so the card's own shadow reads through it.
 */
export function useCoursesInk() {
  const { colors, scheme } = useTheme();
  return useMemo(() => {
    const dark = scheme === "dark";
    return {
      accentInk:  dark ? colors.accentHover : colors.accent,
      accentWash: `${colors.accent}${dark ? "26" : "12"}`,
      tileBg:     dark ? `${colors.bgTertiary}AA` : colors.bgTertiary,
    };
  }, [colors, scheme]);
}
