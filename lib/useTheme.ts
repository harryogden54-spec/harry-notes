import { useMemo } from "react";
import { useThemeContext } from "./ThemeContext";
import { ACCENT_OPTIONS, THEMES, getThemeKit } from "./theme";

export function useTheme() {
  const { scheme, accentId, themeId } = useThemeContext();

  // Memoized per (theme, scheme, accent) so the returned object is
  // referentially stable — components can pass `colors` to React.memo children
  // without defeating the memo.
  return useMemo(() => {
    const theme = THEMES[themeId] ?? THEMES.obsidian;
    const base  = scheme === "dark" ? theme.dark : theme.light;

    // Per-accent override applies to all themes.
    const accentOpt = ACCENT_OPTIONS.find(a => a.id === accentId) ?? ACCENT_OPTIONS[0];
    const colors = {
      ...base,
      accent:       accentOpt.color,
      accentHover:  accentOpt.hover,
      accentSubtle: scheme === "dark" ? accentOpt.subtle : accentOpt.lightSubtle,
    };

    // Per-theme personality kit: note pastels, background wash, hero gradient.
    const kit = getThemeKit(themeId in THEMES ? themeId : "obsidian", scheme);

    return { scheme, colors, isDark: scheme === "dark", notePastels: kit.pastels, kit };
  }, [scheme, accentId, themeId]);
}
