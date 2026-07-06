import React from "react";
import { View, ScrollView, SafeAreaView, Pressable, Switch } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";
import { ACCENT_OPTIONS, THEMES, getThemeKit, type ThemeId, spacing, radius, fontFamily } from "@/lib/theme";
import { Text, GradientBackground } from "@/components/ui";
import { webContentStyle } from "@/lib/webLayout";

// ─── Theme card ───────────────────────────────────────────────────────────────

function ThemeCard({
  id, active, onPress, accent,
}: {
  id: ThemeId; active: boolean; onPress: () => void; accent: typeof ACCENT_OPTIONS[number];
}) {
  const { scheme } = useThemeContext();
  const def    = THEMES[id];
  const tokens = scheme === "dark" ? def.dark : def.light;
  const kit    = getThemeKit(id, scheme);
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
      {/* Live miniature dashboard — the theme's actual personality, not just swatches */}
      <View style={{ height: 86, backgroundColor: tokens.bgPrimary, padding: spacing[2.5], gap: 4 }}>
        <View style={{ width: "55%", height: 6, borderRadius: 99, backgroundColor: tokens.textPrimary, opacity: 0.85 }} />
        <View style={{ width: "32%", height: 4, borderRadius: 99, backgroundColor: tokens.textTertiary }} />
        <View style={{ marginTop: 3, backgroundColor: tokens.bgSecondary, borderRadius: 6, borderWidth: 1, borderColor: tokens.bgBorder, padding: 5, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 99, borderWidth: 1, borderColor: cardAccent }} />
            <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: tokens.danger }} />
            <View style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: tokens.textSecondary, opacity: 0.5 }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: cardAccent }} />
            <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: tokens.warning }} />
            <View style={{ flex: 0.7, height: 4, borderRadius: 99, backgroundColor: tokens.textTertiary, opacity: 0.6 }} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 4, marginTop: "auto" as any }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ flex: 1, height: 13, borderRadius: 4, backgroundColor: kit.pastels.bg[i], borderWidth: 1, borderColor: kit.pastels.border[i] }} />
          ))}
        </View>
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
          style={{
            color: active ? cardAccent : tokens.textPrimary,
            fontFamily: active ? fontFamily.semibold : fontFamily.medium,
          }}
        >
          {def.label}
        </Text>
        {active && (
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: cardAccent, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark" size={10} color={tokens.textInverse} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Appearance screen ────────────────────────────────────────────────────────

export default function AppearanceScreen() {
  const { colors }      = useTheme();
  const { scheme, toggle, accentId, setAccentId, themeId, setThemeId } = useThemeContext();
  const router          = useRouter();
  const currentAccent   = ACCENT_OPTIONS.find(a => a.id === accentId) ?? ACCENT_OPTIONS[0];

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
              <Ionicons name="chevron-back" size={16} color={colors.accent} />
              <Text size="sm" style={{ color: colors.accent }}>Settings</Text>
            </Pressable>
            <Text size="2xl" weight="bold">Appearance</Text>
          </View>

          {/* ── Theme ────────────────────────────────────────────────────── */}
          <SectionLabel>Theme</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3], marginBottom: spacing[5] }}>
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

          {/* ── Accent colour ─────────────────────────────────────────────── */}
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: spacing[1] }}>
            <SectionLabel>Accent</SectionLabel>
            <Text size="xs" weight="medium" style={{ color: colors.textSecondary, marginBottom: spacing[2.5] }}>
              {currentAccent.label}
            </Text>
          </View>
          <View style={{
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.xl,
            borderWidth: 1, borderColor: colors.bgBorder,
            padding: spacing[4],
            flexDirection: "row", flexWrap: "wrap", gap: spacing[2.5],
            marginBottom: spacing[5],
          }}>
            {ACCENT_OPTIONS.map(opt => {
              const active = accentId === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setAccentId(opt.id)}
                  hitSlop={4}
                  accessibilityLabel={opt.label}
                  style={{
                    width: 30, height: 30, borderRadius: 15,
                    backgroundColor: opt.color,
                    borderWidth: active ? 3 : 2,
                    borderColor: active ? colors.textPrimary : `${opt.color}40`,
                    transform: [{ scale: active ? 1.1 : 1 }],
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {active && <Ionicons name="checkmark" size={13} color={colors.textInverse} />}
                </Pressable>
              );
            })}
          </View>

          {/* ── Dark / Light mode ─────────────────────────────────────────── */}
          <SectionLabel>Mode</SectionLabel>
          <View style={{
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.xl,
            borderWidth: 1, borderColor: colors.bgBorder,
            overflow: "hidden",
            marginBottom: spacing[5],
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
