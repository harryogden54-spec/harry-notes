import React from "react";
import { View, ScrollView, SafeAreaView, Pressable, Switch } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";
import {
  ACCENT_OPTIONS, THEMES, getShadow, getThemeKit, shape, iconSize,
  type ThemeId, type ThemeTokens, type ThemeMaterial, type AccentId,
  spacing, radius, transition,
} from "@/lib/theme";
import { Text, GradientBackground } from "@/components/ui";
import { webContentStyle } from "@/lib/webLayout";

/**
 * Live preview of a theme — a real card, a real task row, real type at real
 * sizes, drawn with the previewed theme's own tokens and material.
 *
 * The old picker showed grey bars in a 86px thumbnail, which could only ever
 * communicate hue. Half of what a theme now decides is material — whether
 * separation comes from a hairline or a cast shadow, how warm the shadow is,
 * how far apart the surface steps sit — and none of that survives at thumbnail
 * scale. This is deliberately close to full size.
 */
function ThemePreview({ tokens, material, accent, scheme }: {
  tokens: ThemeTokens;
  material: ThemeMaterial;
  accent: typeof ACCENT_OPTIONS[number];
  scheme: "dark" | "light";
}) {
  const cardShadow = getShadow("sm", scheme, { material });
  const border = material.separation === "shadow" ? `${tokens.bgBorder}66` : tokens.bgBorder;

  return (
    <View style={{
      backgroundColor: tokens.bgPrimary,
      borderRadius: radius.xl,
      padding: spacing[4],
      gap: spacing[3],
      borderWidth: 1,
      borderColor: tokens.bgBorder,
      overflow: "hidden",
    }}>
      {/* Page heading + meta, at the real type roles */}
      <View style={{ gap: 2 }}>
        <Text size="lg" weight="bold" color={tokens.textPrimary}>Tasks</Text>
        <Text size="meta" color={tokens.textTertiary}>3 open · 1 due this week</Text>
      </View>

      {/* A task card in this theme's material */}
      <View style={{
        backgroundColor: tokens.bgSecondary,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: border,
        padding: spacing[3],
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing[3],
        ...cardShadow,
      }}>
        <View style={{
          width: 18, height: 18, borderRadius: 99,
          borderWidth: 1.5, borderColor: accent.color, marginTop: 1,
        }} />
        <View style={{ flex: 1, gap: spacing[2] }}>
          <Text size="cardTitle" weight="medium" color={tokens.textPrimary} numberOfLines={1}>
            Finish the lab report
          </Text>
          <View style={{ flexDirection: "row", gap: spacing[1.5], alignItems: "center" }}>
            <View style={{ ...shape.pill, backgroundColor: `${tokens.danger}1A` }}>
              <Text size="meta" weight="semibold" color={tokens.danger}>Tomorrow</Text>
            </View>
            <View style={{ ...shape.pill, backgroundColor: tokens.bgTertiary }}>
              <Text size="meta" weight="medium" color={tokens.textSecondary}>Uni</Text>
            </View>
          </View>
        </View>
      </View>

      {/* A quieter secondary row, to show the tertiary surface and text ramp */}
      <View style={{
        backgroundColor: tokens.bgTertiary,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: border,
        paddingHorizontal: spacing[3], paddingVertical: spacing[2.5],
        flexDirection: "row", alignItems: "center", gap: spacing[2],
      }}>
        <Ionicons name="documents-outline" size={iconSize.xs} color={tokens.textTertiary} />
        <Text size="meta" color={tokens.textTertiary} style={{ flex: 1 }}>Lecture notes · 2 pages</Text>
        <View style={{
          paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
          borderRadius: 999, backgroundColor: accent.color,
        }}>
          <Text size="meta" weight="semibold" color={tokens.bgPrimary}>Open</Text>
        </View>
      </View>
    </View>
  );
}

/** Compact row in the theme list — swatch, name, one-line description. */
function ThemeRow({ id, active, onPress }: { id: ThemeId; active: boolean; onPress: () => void }) {
  const { colors, shadow } = useTheme();
  const { scheme, accentId } = useThemeContext();
  const def = THEMES[id];
  const tokens = (scheme === "dark" ? def.dark : def.light).tokens;
  // The row previews the theme's OWN accent — that is what selecting it gives
  // you unless an explicit accent is already set.
  const swatchAccent = ACCENT_OPTIONS.find(a => a.id === (accentId ?? def.defaultAccent)) ?? ACCENT_OPTIONS[0];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ hovered, pressed }: any) => ({
        flexDirection: "row", alignItems: "center", gap: spacing[3],
        paddingHorizontal: spacing[3], paddingVertical: spacing[3],
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.bgBorder,
        backgroundColor: active ? `${colors.accent}0C` : hovered ? colors.bgTertiary : colors.bgSecondary,
        ...shadow("xs"),
        ...transition("background-color, border-color, transform"),
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      {/* Three-step surface ramp + accent — the theme in miniature */}
      <View style={{
        flexDirection: "row", width: 46, height: 30, borderRadius: 8,
        overflow: "hidden", borderWidth: 1, borderColor: tokens.bgBorder,
      }}>
        <View style={{ flex: 1, backgroundColor: tokens.bgPrimary }} />
        <View style={{ flex: 1, backgroundColor: tokens.bgSecondary }} />
        <View style={{ flex: 1, backgroundColor: tokens.bgTertiary }} />
        <View style={{ width: 8, backgroundColor: swatchAccent.color }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text size="cardTitle" weight={active ? "semibold" : "medium"}>{def.label}</Text>
        <Text size="meta" tertiary numberOfLines={1}>{def.blurb}</Text>
      </View>
      {active && <Ionicons name="checkmark" size={iconSize.md} color={colors.accent} />}
    </Pressable>
  );
}

export default function AppearanceScreen() {
  const { colors, shadow } = useTheme();
  const {
    scheme, toggle, accentId, setAccentId, resetAccent, themeId, setThemeId,
  } = useThemeContext();
  const router = useRouter();

  const def = THEMES[themeId] ?? THEMES.obsidian;
  const activeScheme = scheme === "dark" ? def.dark : def.light;
  const effectiveAccentId: AccentId = accentId ?? def.defaultAccent;
  const currentAccent = ACCENT_OPTIONS.find(a => a.id === effectiveAccentId) ?? ACCENT_OPTIONS[0];

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[{ padding: spacing[4], paddingBottom: spacing[16] }, webContentStyle]}>

          {/* Header */}
          <View style={{ paddingTop: spacing[4], paddingBottom: spacing[5] }}>
            <Pressable
              onPress={() => router.back()} hitSlop={12}
              style={{ marginBottom: spacing[2], flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
            >
              <Ionicons name="chevron-back" size={iconSize.md} color={colors.accent} />
              <Text size="sm" color={colors.accent}>Settings</Text>
            </Pressable>
            <Text size="2xl" weight="bold">Appearance</Text>
          </View>

          {/* ── Live preview ───────────────────────────────────────────────── */}
          <View style={{ marginBottom: spacing[5] }}>
            <ThemePreview
              tokens={activeScheme.tokens}
              material={activeScheme.material}
              accent={currentAccent}
              scheme={scheme}
            />
          </View>

          {/* ── Theme ──────────────────────────────────────────────────────── */}
          <SectionLabel>Theme</SectionLabel>
          <View style={{ gap: spacing[2], marginBottom: spacing[5] }}>
            {(Object.keys(THEMES) as ThemeId[]).map(id => (
              <ThemeRow key={id} id={id} active={themeId === id} onPress={() => setThemeId(id)} />
            ))}
          </View>

          {/* ── Accent ─────────────────────────────────────────────────────── */}
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: spacing[1] }}>
            <SectionLabel>Accent</SectionLabel>
            <Text size="meta" weight="medium" secondary style={{ marginBottom: spacing[2.5] }}>
              {currentAccent.label}{accentId === null ? " · from theme" : ""}
            </Text>
          </View>
          <View style={{
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.xl,
            borderWidth: 1, borderColor: colors.bgBorder,
            padding: spacing[4],
            gap: spacing[3],
            marginBottom: spacing[5],
            ...shadow("xs"),
          }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2.5] }}>
              {ACCENT_OPTIONS.map(opt => {
                // Lit when it is what you are actually looking at, whether that
                // came from an explicit pick or from the theme's own default.
                const active = effectiveAccentId === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setAccentId(opt.id)}
                    hitSlop={4}
                    accessibilityLabel={opt.label}
                    accessibilityState={{ selected: active }}
                    style={{
                      width: 30, height: 30, borderRadius: 15,
                      backgroundColor: opt.color,
                      borderWidth: active ? 3 : 2,
                      borderColor: active ? colors.textPrimary : `${opt.color}40`,
                      transform: [{ scale: active ? 1.1 : 1 }],
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {active && <Ionicons name="checkmark" size={iconSize.xs} color={colors.textInverse} />}
                  </Pressable>
                );
              })}
            </View>
            {/* Only offered once there is something to undo. */}
            {accentId !== null && accentId !== def.defaultAccent && (
              <Pressable onPress={resetAccent} hitSlop={8} style={{ alignSelf: "flex-start" }}>
                <Text size="meta" color={colors.accent}>
                  Use {THEMES[themeId].label}&apos;s own accent
                </Text>
              </Pressable>
            )}
          </View>

          {/* ── Dark / Light mode ──────────────────────────────────────────── */}
          <SectionLabel>Mode</SectionLabel>
          <View style={{
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.xl,
            borderWidth: 1, borderColor: colors.bgBorder,
            overflow: "hidden",
            marginBottom: spacing[5],
            ...shadow("xs"),
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}>
              <Ionicons
                name={scheme === "dark" ? "moon-outline" : "sunny-outline"}
                size={iconSize.md} color={colors.textSecondary}
                style={{ marginRight: spacing[3] }}
              />
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="medium">{scheme === "dark" ? "Dark mode" : "Light mode"}</Text>
                <Text size="meta" tertiary>
                  {scheme === "dark" ? "Easy on the eyes at night" : "Crisp and bright"}
                </Text>
              </View>
              <Switch
                value={scheme === "dark"}
                onValueChange={toggle}
                trackColor={{ false: colors.bgBorder, true: colors.accent }}
                thumbColor={colors.textInverse}
              />
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="label" weight="semibold" tertiary style={{
      textTransform: "uppercase",
      marginBottom: spacing[2.5], paddingHorizontal: spacing[1],
    }}>
      {children}
    </Text>
  );
}
