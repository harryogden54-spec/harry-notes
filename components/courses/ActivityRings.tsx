import React from "react";
import { View, Platform } from "react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/useTheme";

export type Ring = {
  /** 0…1 */
  value: number;
  color: string;
  label: string;
};

/**
 * Concentric progress rings, outermost first — the Apple Watch activity-ring
 * shape: thick rounded strokes over a faint track of their own colour, so each
 * ring reads as one object even at 0%.
 *
 * Web draws real SVG arcs; native falls back to stacked bordered circles (native
 * builds are not deployed, so the fallback only needs to be sane — there is no
 * react-native-svg dependency to lean on).
 */
export function ActivityRings({ rings, size = 132, stroke, gap = 3, center }: {
  rings: Ring[];
  size?: number;
  stroke?: number;
  gap?: number;
  /** Optional content drawn in the middle (e.g. a percentage). */
  center?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const sw = stroke ?? Math.max(6, Math.round(size / 9.5));
  const label = rings.map(r => `${r.label} ${Math.round(r.value * 100)}%`).join(", ");

  if (Platform.OS !== "web") {
    return (
      <View accessibilityLabel={label} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        {rings.map((r, i) => {
          const d = size - i * 2 * (sw + gap);
          return (
            <View
              key={i}
              style={{
                position: "absolute", width: d, height: d, borderRadius: d / 2,
                borderWidth: sw, borderColor: r.value >= 1 ? r.color : colors.bgTertiary,
              }}
            />
          );
        })}
        {center}
      </View>
    );
  }

  return (
    <View accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        {rings.map((r, i) => {
          const radius = (size - sw) / 2 - i * (sw + gap);
          if (radius <= sw / 2) return null;
          const c = 2 * Math.PI * radius;
          const v = Math.max(0, Math.min(1, r.value));
          return (
            <g key={i}>
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeOpacity={0.16} strokeWidth={sw} />
              {v > 0 && (
                <circle
                  cx={size / 2} cy={size / 2} r={radius} fill="none"
                  stroke={r.color} strokeWidth={sw} strokeLinecap="round"
                  strokeDasharray={c}
                  // A round cap on a near-zero arc still draws a full dot; that is
                  // the right reading of "started", so no minimum is imposed.
                  strokeDashoffset={c * (1 - v)}
                  style={{ transition: "stroke-dashoffset 500ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
                />
              )}
            </g>
          );
        })}
      </svg>
      {center}
    </View>
  );
}

/** A single small ring with a centred fraction — the per-course rings. */
export function MiniRing({ value, color, size = 34, caption }: { value: number; color: string; size?: number; caption?: string }) {
  return (
    <ActivityRings
      size={size}
      stroke={Math.max(3, Math.round(size / 8))}
      rings={[{ value, color, label: caption ?? "Progress" }]}
      center={caption ? <Text size="2xs" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>{caption}</Text> : undefined}
    />
  );
}
