import { useThemeContext } from "./ThemeContext";
import { ACCENT_OPTIONS, THEMES } from "./theme";

export function useTheme() {
  const { scheme, accentId, themeId } = useThemeContext();
  const theme = THEMES[themeId] ?? THEMES.default;
  const base  = scheme === "dark" ? theme.dark : theme.light;

  // For the default (Linear) theme, allow per-accent override via ACCENT_OPTIONS.
  // Named themes (nord, warmEarth, slate) use their built-in accent.
  let colors = base;
  if (themeId === "default") {
    const accentOpt = ACCENT_OPTIONS.find(a => a.id === accentId) ?? ACCENT_OPTIONS[0];
    colors = {
      ...base,
      accent:       accentOpt.color,
      accentHover:  accentOpt.hover,
      accentSubtle: scheme === "dark" ? accentOpt.subtle : accentOpt.lightSubtle,
    };
  }

  return { scheme, colors, isDark: scheme === "dark" };
}
