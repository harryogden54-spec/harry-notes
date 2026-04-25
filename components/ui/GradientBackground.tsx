import React from "react";
import { View, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext, type BgGraphic } from "@/lib/ThemeContext";

// ─── Geometric tile pattern ────────────────────────────────────────────────────
// Web: SVG data-URL background-image tile. Native: simple dot grid fallback.

function GeometricPattern({ accent }: { accent: string }) {
  if (Platform.OS === "web") {
    const enc = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">` +
      `<path d="M20,2 L38,20 L20,38 L2,20 Z" fill="none" stroke="${accent}" stroke-width="0.9"/>` +
      `<circle cx="20" cy="20" r="2" fill="${accent}"/>` +
      `<line x1="20" y1="2" x2="20" y2="38" stroke="${accent}" stroke-width="0.4"/>` +
      `<line x1="2" y1="20" x2="38" y2="20" stroke="${accent}" stroke-width="0.4"/>` +
      `</svg>`
    );
    return (
      <View
        pointerEvents="none"
        style={[
          { position: "absolute", inset: 0, opacity: 0.045 } as any,
          // @ts-ignore web-only
          { backgroundImage: `url("data:image/svg+xml,${enc}")`, backgroundSize: "40px 40px" },
        ]}
      />
    );
  }

  // Native fallback: 6×10 grid of tiny diamond Views
  const cells = Array.from({ length: 60 });
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04, flexWrap: "wrap", flexDirection: "row" }}
    >
      {cells.map((_, i) => (
        <View key={i} style={{ width: "16.66%", height: 60, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 10, height: 10, transform: [{ rotate: "45deg" }], borderWidth: 1, borderColor: accent }} />
        </View>
      ))}
    </View>
  );
}

// ─── Codex corner glyph ────────────────────────────────────────────────────────
// Concentric rings + radial spokes in the bottom-right corner.

function CodexGraphic({ accent }: { accent: string }) {
  const SIZE = 220;
  const rings = [0, 28, 56, 84, 108];
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", bottom: -30, right: -30, width: SIZE, height: SIZE, opacity: 0.07 }}
    >
      {rings.map((inset, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: inset, left: inset,
            width: SIZE - inset * 2, height: SIZE - inset * 2,
            borderRadius: (SIZE - inset * 2) / 2,
            borderWidth: i === rings.length - 1 ? 0 : 1.5,
            borderColor: accent,
            backgroundColor: i === rings.length - 1 ? accent : "transparent",
          }}
        />
      ))}
      {/* Cardinal + diagonal spokes */}
      {[0, 45, 90, 135].map(deg => (
        <View
          key={deg}
          style={{
            position: "absolute",
            top: 0, left: SIZE / 2 - 1,
            width: 1.5, height: SIZE,
            backgroundColor: accent,
            transform: [{ rotate: `${deg}deg` }, { translateX: 0 }],
            transformOrigin: `center center`,
          } as any}
        />
      ))}
    </View>
  );
}

// ─── GradientBackground ────────────────────────────────────────────────────────

export function GradientBackground({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { bgStyle, bgGraphic } = useThemeContext();

  const accent = colors.accent;
  const bg     = colors.bgPrimary;

  const graphic = bgGraphic === "geometric" ? <GeometricPattern accent={accent} />
                : bgGraphic === "codex"      ? <CodexGraphic accent={accent} />
                : null;

  if (bgStyle === "gradient") {
    return (
      <LinearGradient
        colors={[`${accent}10`, bg, bg]}
        style={{ flex: 1 }}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {graphic}
        {children}
      </LinearGradient>
    );
  }

  if (bgStyle === "blur") {
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        {/* Faint accent wash so cards "float" */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", inset: 0, backgroundColor: `${accent}07` } as any}
        />
        {graphic}
        {children}
      </View>
    );
  }

  // Solid (default)
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {graphic}
      {children}
    </View>
  );
}
