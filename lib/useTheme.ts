import { useThemeContext } from "./ThemeContext";
import { getColors, ACCENT_OPTIONS } from "./theme";

export function useTheme() {
  const { scheme, accentId } = useThemeContext();
  const base = getColors(scheme);
  const accentOpt = ACCENT_OPTIONS.find(a => a.id === accentId) ?? ACCENT_OPTIONS[0];
  const colors = {
    ...base,
    accent:       accentOpt.color,
    accentHover:  accentOpt.hover,
    accentSubtle: scheme === "dark" ? accentOpt.subtle : accentOpt.lightSubtle,
  };
  return { scheme, colors, isDark: scheme === "dark" };
}
