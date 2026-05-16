import React from "react";
import { Platform, View } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";
import { THEMES } from "@/lib/theme";

// ─── Per-theme background definitions (web CSS only) ─────────────────────────

function getWebBackground(
  value: string,
  type: string,
  bgPrimary: string,
  accent: string,
  scheme: "dark" | "light",
): React.CSSProperties {
  const a = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  };

  if (type === "gradient") {
    const configs: Record<string, React.CSSProperties> = {
      linear: {
        background: `radial-gradient(ellipse 80% 60% at 20% 0%, ${a(accent, 0.12)} 0%, transparent 60%),
                     radial-gradient(ellipse 60% 50% at 80% 100%, ${a(accent, 0.08)} 0%, transparent 60%),
                     ${bgPrimary}`,
      },
      nord: {
        background: `radial-gradient(ellipse 90% 70% at 10% 10%, ${a(accent, 0.18)} 0%, transparent 55%),
                     radial-gradient(ellipse 70% 60% at 90% 90%, ${a(accent, 0.10)} 0%, transparent 55%),
                     ${bgPrimary}`,
      },
      warmEarth: {
        background: `radial-gradient(ellipse 100% 80% at 0% 0%, ${a(accent, 0.20)} 0%, transparent 50%),
                     radial-gradient(ellipse 80% 60% at 100% 100%, ${a(accent, 0.12)} 0%, transparent 50%),
                     ${bgPrimary}`,
      },
      dusk: {
        background: `radial-gradient(ellipse 90% 70% at 50% 0%, ${a(accent, 0.22)} 0%, transparent 60%),
                     radial-gradient(ellipse 60% 50% at 100% 100%, rgba(200,100,180,${scheme === "dark" ? 0.10 : 0.06}) 0%, transparent 50%),
                     ${bgPrimary}`,
      },
    };
    return configs[value] ?? { backgroundColor: bgPrimary };
  }

  if (type === "noise") {
    // Grain SVG as data URL, layered over a subtle tinted background
    const tint = a(accent, scheme === "dark" ? 0.06 : 0.04);
    const grainOpacity = scheme === "dark" ? 0.55 : 0.35;
    const grainSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#n)' opacity='${grainOpacity}'/></svg>`;
    const grainUrl = `url("data:image/svg+xml,${encodeURIComponent(grainSvg)}")`;
    return {
      background: `${grainUrl}, linear-gradient(135deg, ${tint}, transparent), ${bgPrimary}`,
    };
  }

  if (type === "geometric") {
    const lineColor = a(accent, scheme === "dark" ? 0.12 : 0.08);

    if (value === "hexagons") {
      // Hexagon grid via SVG pattern
      const hex = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='100'><path d='M28 0 L56 16 L56 50 L28 66 L0 50 L0 16 Z' fill='none' stroke='${accent.replace('#', '%23')}' stroke-width='0.8' stroke-opacity='${scheme === "dark" ? 0.18 : 0.12}'/><path d='M28 66 L56 50 L56 84 L28 100 L0 84 L0 50 Z' fill='none' stroke='${accent.replace('#', '%23')}' stroke-width='0.8' stroke-opacity='${scheme === "dark" ? 0.18 : 0.12}'/></svg>`;
      return {
        background: `url("data:image/svg+xml,${encodeURIComponent(hex)}"), ${bgPrimary}`,
      };
    }

    if (value === "grid") {
      // Dot grid
      const dot = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='0.9' fill='${accent.replace('#', '%23')}' fill-opacity='${scheme === "dark" ? 0.25 : 0.15}'/></svg>`;
      return {
        background: `url("data:image/svg+xml,${encodeURIComponent(dot)}"), ${bgPrimary}`,
      };
    }
  }

  return { backgroundColor: bgPrimary };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GradientBackground({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { themeId, scheme } = useThemeContext();

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        {children}
      </View>
    );
  }

  const themeDef = THEMES[themeId];
  const bg = themeDef?.background;

  const webStyle = bg
    ? getWebBackground(bg.value, bg.type, colors.bgPrimary, colors.accent, scheme)
    : { backgroundColor: colors.bgPrimary };

  return (
    <View style={[{ flex: 1 }, webStyle as any]}>
      {children}
    </View>
  );
}
