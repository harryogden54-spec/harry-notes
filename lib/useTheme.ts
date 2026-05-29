import { useThemeContext } from "./ThemeContext";
import { ACCENT_OPTIONS, THEMES, getNotePastels } from "./theme";

export function useTheme() {
  const { scheme, accentId, themeId } = useThemeContext();
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

  // Theme-aware note pastels (dark = low-luminance tinted, light = bright paper)
  const notePastels = getNotePastels(scheme);

  return { scheme, colors, isDark: scheme === "dark", notePastels };
}
