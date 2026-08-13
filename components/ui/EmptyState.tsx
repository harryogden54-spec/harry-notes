import React from "react";
import { View, Pressable, Platform } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, getShadow, transition } from "@/lib/theme";

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

/** Courses: the tickbox rows of a progress table. */
function CoursesIllustration({ accent, tertiary }: { accent: string; tertiary: string }) {
  return (
    <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 52, height: 52, borderRadius: 10, borderWidth: 2, borderColor: `${accent}50`, padding: 10, gap: spacing[1.5] }}>
        {[0.9, 0.7, 0.8].map((w, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
            <View style={{ width: 8, height: 8, borderRadius: 99, borderWidth: 1.5, borderColor: i === 0 ? accent : `${tertiary}60`, backgroundColor: i === 0 ? `${accent}40` : "transparent" }} />
            <View style={{ height: 2, width: `${w * 100}%` as any, backgroundColor: i === 0 ? `${accent}60` : `${tertiary}40`, borderRadius: 99 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Dump: an open tray with items settling into it. */
function DumpIllustration({ accent, tertiary }: { accent: string; tertiary: string }) {
  return (
    <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
      {[0.55, 0.75].map((w, i) => (
        <View key={i} style={{
          position: "absolute", top: 10 + i * 9, height: 2.5, width: `${w * 44}%` as any,
          backgroundColor: i === 0 ? `${tertiary}40` : `${accent}55`, borderRadius: 99,
        }} />
      ))}
      <View style={{
        position: "absolute", bottom: 14, width: 46, height: 24,
        borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2,
        borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
        borderColor: `${accent}60`,
      }} />
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
  notes:    NotesIllustration,
  dump:     DumpIllustration,
  courses:  CoursesIllustration,
  search:   SearchIllustration,
} as const;

interface EmptyStateProps {
  type: keyof typeof ILLUSTRATIONS;
  title: string;
  subtitle?: string;
  /**
   * The thing the subtitle is telling you to do. An empty state that says "tap
   * the field above" and offers nothing to tap is a dead end — if there is one
   * obvious next step, put it here and let the state perform it.
   */
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ type, title, subtitle, action }: EmptyStateProps) {
  const { colors, scheme, shadow } = useTheme();
  const Illustration = ILLUSTRATIONS[type] ?? ILLUSTRATIONS.notes;

  return (
    <View style={{
      alignItems: "center",
      paddingVertical: spacing[10],
      paddingHorizontal: spacing[6],
      gap: spacing[2],
    }}>
      {/* Quiet holder: the fill used to be accentSubtle behind a dashed ring,
          which made the emptiest screen the most colourful thing in the app. */}
      <View style={{
        backgroundColor: colors.bgSecondary,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.bgBorder,
        width: 96,
        height: 96,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing[2],
      }}>
        <Illustration accent={colors.accent} tertiary={colors.textTertiary} />
      </View>
      <Text size="lg" weight="semibold">{title}</Text>
      {subtitle && (
        <Text size="sm" secondary style={{ textAlign: "center", maxWidth: 280 }}>
          {subtitle}
        </Text>
      )}
      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          style={({ hovered, pressed }: any) => ({
            marginTop: spacing[2],
            paddingHorizontal: spacing[4], paddingVertical: spacing[2],
            borderRadius: 999,
            borderWidth: 1, borderColor: colors.bgBorder,
            backgroundColor: hovered ? colors.bgTertiary : colors.bgSecondary,
            ...shadow("xs"),
            ...(Platform.OS === "web" ? {
              ...transition("background-color, border-color, transform"),
              transform: [{ scale: pressed ? 0.97 : 1 }],
              cursor: "pointer",
            } : {}),
          })}
        >
          <Text size="sm" weight="medium">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
