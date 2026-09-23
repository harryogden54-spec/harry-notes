import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { IoniconName } from "./navConfig";

export type NavGlyph = "home" | "today" | "tasks" | "notes" | "courses" | "dump" | "settings" | "more";

/**
 * Navigation glyphs, drawn as solid shapes in ONE colour at two opacities
 * (duotone) instead of Ionicons' 32px-stroke outlines, which read as line
 * drawings at 18–20px. Each icon is a soft silhouette (the "back" layer, ~30%)
 * with a crisp foreground detail on top at full strength, so it has weight and
 * a clear focal point while staying a single hue — it takes whatever `color`
 * the nav passes (secondary text, or the accent when active).
 *
 * Active state lifts the back layer rather than swapping to a different icon,
 * so selection changes emphasis without changing shape.
 *
 * Web only — native falls back to the Ionicons pair (native builds are not
 * deployed and there is no react-native-svg dependency).
 */
const GLYPHS: Record<NavGlyph, { back: React.ReactNode; front: React.ReactNode }> = {
  home: {
    back: <path d="M10.6 3.5a2.2 2.2 0 0 1 2.8 0l6.8 5.6c.5.4.8 1 .8 1.7v8.4a2.3 2.3 0 0 1-2.3 2.3H5.3A2.3 2.3 0 0 1 3 19.2v-8.4c0-.7.3-1.3.8-1.7z" />,
    front: <rect x="9.25" y="13.5" width="5.5" height="8" rx="1.6" />,
  },
  today: {
    back: <rect x="3" y="4.5" width="18" height="17" rx="4" />,
    front: (
      <>
        <path d="M7 4.5h10a4 4 0 0 1 4 4V10H3V8.5a4 4 0 0 1 4-4z" />
        <rect x="6.6" y="2.2" width="2.3" height="5" rx="1.15" />
        <rect x="15.1" y="2.2" width="2.3" height="5" rx="1.15" />
        <rect x="13" y="13.2" width="4.6" height="4.6" rx="1.3" />
      </>
    ),
  },
  tasks: {
    back: <rect x="3" y="3" width="18" height="18" rx="5.5" />,
    front: <path d="M7.4 12.3l3.1 3.1 6.2-6.6" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />,
  },
  notes: {
    back: <rect x="4" y="2.5" width="16" height="19" rx="4" />,
    front: (
      <>
        <rect x="7.5" y="7" width="9" height="2.2" rx="1.1" />
        <rect x="7.5" y="11" width="9" height="2.2" rx="1.1" />
        <rect x="7.5" y="15" width="5.5" height="2.2" rx="1.1" />
      </>
    ),
  },
  courses: {
    back: <path d="M5.5 11.2l6.5 3.1 6.5-3.1v5.1c0 1.9-2.9 3.7-6.5 3.7s-6.5-1.8-6.5-3.7z" />,
    front: (
      <>
        <path d="M11.1 3.7a2.1 2.1 0 0 1 1.8 0l8.3 4c.9.4.9 1.7 0 2.1l-8.3 4a2.1 2.1 0 0 1-1.8 0l-8.3-4c-.9-.4-.9-1.7 0-2.1z" />
        <rect x="19.6" y="9" width="1.9" height="7" rx="0.95" />
      </>
    ),
  },
  dump: {
    back: <rect x="3" y="3.5" width="18" height="17" rx="4.5" />,
    front: <path d="M3 13.2h4.4c.6 0 1.1.3 1.3.8l.6 1.2c.3.5.8.8 1.3.8h2.8c.5 0 1-.3 1.3-.8l.6-1.2c.2-.5.7-.8 1.3-.8H21v2.8a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16z" />,
  },
  settings: {
    back: (
      <>
        <rect x="3" y="5.6" width="18" height="2.8" rx="1.4" />
        <rect x="3" y="10.6" width="18" height="2.8" rx="1.4" />
        <rect x="3" y="15.6" width="18" height="2.8" rx="1.4" />
      </>
    ),
    front: (
      <>
        <circle cx="8.5" cy="7" r="2.9" />
        <circle cx="15.5" cy="12" r="2.9" />
        <circle cx="10" cy="17" r="2.9" />
      </>
    ),
  },
  more: {
    back: <circle cx="12" cy="12" r="9.5" />,
    front: (
      <>
        <circle cx="7.6" cy="12" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="16.4" cy="12" r="1.7" />
      </>
    ),
  },
};

const FALLBACK: Record<NavGlyph, [IoniconName, IoniconName]> = {
  home: ["home-outline", "home"],
  today: ["today-outline", "today"],
  tasks: ["checkbox-outline", "checkbox"],
  notes: ["document-text-outline", "document-text"],
  courses: ["school-outline", "school"],
  dump: ["file-tray-outline", "file-tray"],
  settings: ["options-outline", "options"],
  more: ["ellipsis-horizontal-circle-outline", "ellipsis-horizontal-circle"],
};

export function NavIcon({ glyph, size = 20, color, active = false }: {
  glyph: NavGlyph;
  size?: number;
  color: string;
  active?: boolean;
}) {
  if (Platform.OS !== "web") {
    return <Ionicons name={FALLBACK[glyph][active ? 1 : 0]} size={size} color={color} />;
  }
  const g = GLYPHS[glyph];
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      style={{ color, fill: "currentColor", flexShrink: 0, display: "block" }}
    >
      <g style={{ opacity: active ? 0.38 : 0.3, transition: "opacity 150ms" }}>{g.back}</g>
      <g>{g.front}</g>
    </svg>
  );
}
