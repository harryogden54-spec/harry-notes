import React from "react";
import {
  View, ScrollView, SafeAreaView, Pressable, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext, type BgStyle } from "@/lib/ThemeContext";
import { ACCENT_OPTIONS, THEMES, type ThemeId, spacing, radius, fontFamily } from "@/lib/theme";
import { Text, GradientBackground } from "@/components/ui";
import { webContentStyle } from "@/lib/webLayout";

// ─── Theme card — simple colour swatch ────────────────────────────────────────

function ThemeCard({
  id, active, onPress, accent,
}: {
  id: ThemeId; active: boolean; onPress: () => void; accent: typeof ACCENT_OPTIONS[number];
}) {
  const { scheme } = useThemeContext();
  const def    = THEMES[id];
  const tokens = scheme === "dark" ? def.dark : def.light;
  const cardAccent = accent.color;

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: "46%" as any,
        borderRadius: radius.xl,
        borderWidth: active ? 2 : 1,
        borderColor: active ? cardAccent : tokens.bgBorder,
        overflow: "hidden",
        backgroundColor: tokens.bgSecondary,
      }}
    >
      {/* Colour swatches */}
      <View style={{ flexDirection: "row", height: 40 }}>
        <View style={{ flex: 1, backgroundColor: tokens.bgPrimary }} />
        <View style={{ flex: 1, backgroundColor: tokens.bgSecondary }} />
        <View style={{ flex: 1, backgroundColor: tokens.bgTertiary }} />
        <View style={{ flex: 0.8, backgroundColor: cardAccent }} />
      </View>
      {/* Label row */}
      <View style={{
        paddingHorizontal: spacing[2.5], paddingVertical: spacing[2],
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: active ? `${cardAccent}12` : tokens.bgSecondary,
      }}>
        <Text
          size="xs"
          weight={active ? "semibold" : "medium"}
          style={{ color: active ? cardAccent : tokens.textPrimary, fontFamily: active ? fontFamily.semibold : fontFamily.medium }}
        >
          {def.label}
        </Text>
        {active && (
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: cardAccent, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Appearance screen ────────────────────────────────────────────────────────

export default function AppearanceScreen() {
  const { colors }      = useTheme();
  const { scheme, toggle, accentId, setAccentId, themeId, setThemeId, bgStyle, setBgStyle } = useThemeContext();
  const router          = useRouter();
  const currentAccent   = ACCENT_OPTIONS.find(a => a.id === accentId) ?? ACCENT_OPTIONS[0];

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[{ padding: spacing[4], paddingBottom: spacing[16] }, webContentStyle]}>

          {/* Header */}
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5] }}>
            <Pressable onPress={() => router.back()} hitSlop={12}
              style={{ marginBottom: spacing[2], flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}>
              <Ionicons name="chevron-back" size={16} color={colors.accent} />
              <Text size="sm" style={{ color: colors.accent }}>Settings</Text>
            </Pressable>
            <Text size="2xl" weight="bold">Appearance</Text>
          </View>

          {/* ── Theme ────────────────────────────────────────────────────── */}
          <View style={{ marginBottom: spacing[5] }}>
            <SectionLabel>Theme</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
              {(Object.keys(THEMES) as ThemeId[]).map(id => (
                <ThemeCard
                  key={id}
                  id={id}
                  active={themeId === id}
                  onPress={() => setThemeId(id)}
                  accent={currentAccent}
                />
              ))}
            </View>
          </View>

          {/* ── Accent colour ─────────────────────────────────────────────── */}
          <View style={{ marginBottom: spacing[5] }}>
            <SectionLabel>Accent</SectionLabel>
            <View style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.xl,
              borderWidth: 1, borderColor: colors.bgBorder,
              padding: spacing[4],
              flexDirection: "row", alignItems: "center", gap: spacing[3], flexWrap: "wrap",
            }}>
              {ACCENT_OPTIONS.map(opt => {
                const active = accentId === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setAccentId(opt.id)}
                    style={{ alignItems: "center", gap: spacing[1] }}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: opt.color,
                      borderWidth: active ? 3 : 2,
                      borderColor: active ? colors.textPrimary : `${opt.color}40`,
                      transform: [{ scale: active ? 1.1 : 1 }],
                      alignItems: "center", justifyContent: "center",
                    }}>
                      {active && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text size="xs" style={{ color: active ? colors.textPrimary : colors.textTertiary, fontFamily: active ? fontFamily.semibold : fontFamily.regular }}>
                      {opt.label.split(" ")[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Background style ──────────────────────────────────────────── */}
          <View style={{ marginBottom: spacing[5] }}>
            <SectionLabel>Background</SectionLabel>
            <View style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.xl,
              borderWidth: 1, borderColor: colors.bgBorder,
              overflow: "hidden",
            }}>
              {([ ["solid",    "square-outline",      "Solid",    "Flat colour, no effects"],
                  ["gradient", "color-filter-outline", "Gradient", "Subtle accent gradient"],
                  ["blur",     "water-outline",        "Blur",     "Frosted glass effect"],
              ] as [BgStyle, React.ComponentProps<typeof Ionicons>["name"], string, string][]).map(([id, icon, label, desc], i, arr) => {
                const active = bgStyle === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setBgStyle(id)}
                    style={{
                      flexDirection: "row", alignItems: "center",
                      paddingHorizontal: spacing[4], paddingVertical: spacing[3],
                      borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                      borderBottomColor: colors.bgBorder,
                      backgroundColor: active ? `${colors.accent}0C` : "transparent",
                    }}
                  >
                    <Ionicons name={icon} size={18} color={active ? colors.accent : colors.textSecondary} style={{ marginRight: spacing[3] }} />
                    <View style={{ flex: 1 }}>
                      <Text size="sm" weight={active ? "semibold" : "regular"} style={{ color: active ? colors.accent : colors.textPrimary }}>{label}</Text>
                      <Text size="xs" style={{ color: colors.textTertiary }}>{desc}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Dark / Light mode ─────────────────────────────────────────── */}
          <View style={{ marginBottom: spacing[5] }}>
            <SectionLabel>Mode</SectionLabel>
            <View style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.xl,
              borderWidth: 1, borderColor: colors.bgBorder,
              overflow: "hidden",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}>
                <Ionicons
                  name={scheme === "dark" ? "moon-outline" : "sunny-outline"}
                  size={18} color={colors.textSecondary}
                  style={{ marginRight: spacing[3] }}
                />
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="medium">{scheme === "dark" ? "Dark mode" : "Light mode"}</Text>
                  <Text size="xs" style={{ color: colors.textTertiary }}>
                    {scheme === "dark" ? "Easy on the eyes at night" : "Crisp and bright"}
                  </Text>
                </View>
                <Switch
                  value={scheme === "dark"}
                  onValueChange={toggle}
                  trackColor={{ false: colors.bgBorder, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text size="xs" weight="semibold" style={{
      textTransform: "uppercase", letterSpacing: 1.2, color: colors.textTertiary,
      marginBottom: spacing[2.5], paddingHorizontal: spacing[1],
    }}>
      {children}
    </Text>
  );
}
