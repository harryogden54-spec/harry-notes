/**
 * Colour-space utilities for deriving accent palette variants.
 * Used to expand ACCENT_OPTIONS (lib/theme.ts) from a base hex into the
 * hover/subtle/lightSubtle shades every accent needs, so new swatches don't
 * require hand-authoring four hex values each.
 */

export type Hsl = { h: number; s: number; l: number };

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  return { h: h * 60, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

export type AccentSwatch = {
  id: string;
  label: string;
  color: string;
  hover: string;
  subtle: string;
  lightSubtle: string;
};

/** Derive the hover/subtle/lightSubtle triad for an accent from its base HSL. */
function deriveShades(h: number, s: number, l: number) {
  return {
    hover: hslToHex(h, s, Math.min(l + 0.08, 0.92)),
    subtle: hslToHex(h, Math.min(s * 0.45, 1), 0.16),
    lightSubtle: hslToHex(h, Math.min(s * 0.55, 1), 0.95),
  };
}

/** Derive a full accent swatch from a base hex colour. */
export function deriveAccent(id: string, label: string, hex: string): AccentSwatch {
  const { h, s, l } = hexToHsl(hex);
  return { id, label, color: hex.toUpperCase(), ...deriveShades(h, s, l) };
}

/** Derive a full accent swatch from base HSL values (h in degrees, s/l 0–1). */
export function deriveAccentFromHsl(id: string, label: string, h: number, s: number, l: number): AccentSwatch {
  return { id, label, color: hslToHex(h, s, l), ...deriveShades(h, s, l) };
}
