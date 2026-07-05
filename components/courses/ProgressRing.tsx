import React from "react";
import { View, Platform } from "react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/useTheme";

type Props = {
  ticked: number;
  total: number;
  size?: number;
};

/**
 * Circular tick-progress ring. Web renders a real SVG arc; native falls back
 * to a plain circle with the percentage centred (native builds aren't deployed,
 * so the fallback just needs to be sane, not fancy — no react-native-svg dep).
 */
export function ProgressRing({ ticked, total, size = 64 }: Props) {
  const { colors } = useTheme();
  const pct = total > 0 ? ticked / total : 0;
  const label = total > 0 ? `${Math.round(pct * 100)}%` : "—";
  const strokeWidth = Math.max(4, Math.round(size / 11));

  if (Platform.OS !== "web") {
    return (
      <View
        accessibilityLabel={`${ticked} of ${total} ticked`}
        style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth, borderColor: pct >= 1 && total > 0 ? colors.accent : colors.bgBorder,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Text size="sm" weight="semibold">{label}</Text>
      </View>
    );
  }

  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View accessibilityLabel={`${ticked} of ${total} ticked`} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.bgTertiary} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={colors.accent} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 300ms ease" }}
        />
      </svg>
      <Text size={size >= 60 ? "sm" : "xs"} weight="semibold">{label}</Text>
    </View>
  );
}
