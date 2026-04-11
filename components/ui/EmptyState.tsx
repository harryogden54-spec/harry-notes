import React from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";

// Geometric M3-style SVG-like illustrations rendered with View primitives
function TasksIllustration({ accent, tertiary }: { accent: string; tertiary: string }) {
  return (
    <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
      {/* Checkbox outline */}
      <View style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 2, borderColor: `${accent}60`, alignItems: "center", justifyContent: "center" }}>
        {/* Tick mark */}
        <View style={{ width: 22, height: 12, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: `${accent}80`, transform: [{ rotate: "-45deg" }, { translateY: -2 }] }} />
      </View>
      {/* Lines below */}
      <View style={{ position: "absolute", bottom: 4, left: 4, right: 4, gap: 4 }}>
        <View style={{ height: 2, width: "70%", backgroundColor: `${tertiary}40`, borderRadius: 99, alignSelf: "flex-end" }} />
        <View style={{ height: 2, width: "50%", backgroundColor: `${tertiary}30`, borderRadius: 99, alignSelf: "flex-end" }} />
      </View>
    </View>
  );
}

function CalendarIllustration({ accent, tertiary }: { accent: string; tertiary: string }) {
  return (
    <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 52, height: 50, borderRadius: 10, borderWidth: 2, borderColor: `${accent}60`, overflow: "hidden" }}>
        {/* Header band */}
        <View style={{ height: 14, backgroundColor: `${accent}30`, width: "100%", borderBottomWidth: 1, borderBottomColor: `${accent}40` }} />
        {/* Dot grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 6, gap: 4 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: i === 2 ? accent : `${tertiary}40` }} />
          ))}
        </View>
      </View>
    </View>
  );
}

function NotesIllustration({ accent, tertiary }: { accent: string; tertiary: string }) {
  return (
    <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
      {/* Stack of cards */}
      <View style={{ width: 44, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: `${tertiary}40`, backgroundColor: `${tertiary}15`, position: "absolute", top: 8, left: 10, transform: [{ rotate: "6deg" }] }} />
      <View style={{ width: 44, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: `${accent}40`, backgroundColor: `${accent}12`, position: "absolute", top: 14, left: 14, transform: [{ rotate: "-3deg" }] }} />
      <View style={{ width: 44, height: 36, borderRadius: 8, borderWidth: 2, borderColor: `${accent}60`, backgroundColor: `${accent}18`, position: "absolute", top: 20, left: 14 }}>
        <View style={{ margin: 6, gap: 4 }}>
          <View style={{ height: 2, width: "80%", backgroundColor: `${accent}60`, borderRadius: 99 }} />
          <View style={{ height: 2, width: "60%", backgroundColor: `${accent}40`, borderRadius: 99 }} />
        </View>
      </View>
    </View>
  );
}

function ListsIllustration({ accent, tertiary }: { accent: string; tertiary: string }) {
  return (
    <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 52, height: 52, borderRadius: 10, borderWidth: 2, borderColor: `${accent}50`, padding: 10, gap: 6 }}>
        {[0.9, 0.7, 0.8].map((w, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 99, borderWidth: 1.5, borderColor: i === 0 ? accent : `${tertiary}60`, backgroundColor: i === 0 ? `${accent}40` : "transparent" }} />
            <View style={{ height: 2, width: `${w * 100}%` as any, backgroundColor: i === 0 ? `${accent}60` : `${tertiary}40`, borderRadius: 99 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

function SearchIllustration({ accent, tertiary }: { accent: string; tertiary: string }) {
  return (
    <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
      {/* Magnifier circle */}
      <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, borderColor: `${accent}70`, position: "absolute", top: 8, left: 8 }} />
      {/* Handle */}
      <View style={{ width: 14, height: 2.5, backgroundColor: `${accent}70`, borderRadius: 99, position: "absolute", bottom: 12, right: 10, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

const ILLUSTRATIONS = {
  tasks:    TasksIllustration,
  calendar: CalendarIllustration,
  notes:    NotesIllustration,
  sticky:   NotesIllustration,
  lists:    ListsIllustration,
  search:   SearchIllustration,
} as const;

interface EmptyStateProps {
  type: keyof typeof ILLUSTRATIONS;
  title: string;
  subtitle?: string;
}

export function EmptyState({ type, title, subtitle }: EmptyStateProps) {
  const { colors } = useTheme();
  const Illustration = ILLUSTRATIONS[type] ?? ILLUSTRATIONS.notes;

  return (
    <View style={{
      alignItems: "center",
      paddingVertical: spacing[10],
      paddingHorizontal: spacing[6],
      gap: spacing[3],
    }}>
      <View style={{
        backgroundColor: colors.bgTertiary,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.bgBorder,
        width: 96,
        height: 96,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing[1],
      }}>
        <Illustration accent={colors.accent} tertiary={colors.textTertiary} />
      </View>
      <Text size="base" weight="semibold" style={{ color: colors.textPrimary }}>
        {title}
      </Text>
      {subtitle && (
        <Text size="sm" secondary style={{ textAlign: "center", lineHeight: 20 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}
