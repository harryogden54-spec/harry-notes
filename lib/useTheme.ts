import { useMemo } from "react";
import { useThemeContext } from "./ThemeContext";
import { ACCENT_OPTIONS, THEMES, getThemeKit, getShadow, type ShadowLevel } from "./theme";

export function useTheme() {
  const { scheme, accentId, themeId } = useThemeContext();

  // Memoized per (theme, scheme, accent) so the returned object is
  // referentially stable — components can pass `colors` to React.memo children
  // without defeating the memo.
  return useMemo(() => {
    const theme  = THEMES[themeId] ?? THEMES.obsidian;
    const scheme_ = scheme === "dark" ? theme.dark : theme.light;
    const base    = scheme_.tokens;
    const material = scheme_.material;

    // `accentId === null` means "whatever this theme was authored around", so a
    // theme can ship a finished look while an explicit choice still wins.
    const effectiveAccentId = accentId ?? theme.defaultAccent;
    const accentOpt = ACCENT_OPTIONS.find(a => a.id === effectiveAccentId) ?? ACCENT_OPTIONS[0];
    // Each accent carries a deeper light-scheme variant: one hex cannot clear
    // 4.5:1 as text on both #0D0D0D and #FFFFFF, and trying made every accent
    // look washed out in light mode.
    const isDark = scheme === "dark";
    const colors = {
      ...base,
      accent:       isDark ? accentOpt.color : accentOpt.light,
      accentHover:  isDark ? accentOpt.hover : accentOpt.lightHover,
      accentSubtle: isDark ? accentOpt.subtle : accentOpt.lightSubtle,
    };

    // Per-theme personality kit: note pastels, background wash, hero gradient.
    const kit = getThemeKit(themeId in THEMES ? themeId : "obsidian", scheme);

    /**
     * Shadow for the active theme's material. Prefer this over calling
     * `getShadow(level, scheme)` directly — that form can't know whether the
     * theme casts warm shadows, or suppresses them in favour of hairlines.
     */
    const shadow = (level: ShadowLevel) => getShadow(level, scheme, { material });

    return {
      scheme, colors, isDark: scheme === "dark",
      notePastels: kit.pastels, kit,
      material, shadow,
    };
  }, [scheme, accentId, themeId]);
}
