import React, { useState } from "react";
import {
  View, ScrollView, SafeAreaView, Pressable,
  Switch, Platform, useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext, type BgStyle } from "@/lib/ThemeContext";
import { ACCENT_OPTIONS, THEMES, type ThemeId, spacing, radius, fontFamily } from "@/lib/theme";
import { Text, GradientBackground } from "@/components/ui";
import { webContentStyle } from "@/lib/webLayout";

// ─── Mini app mockup — one card per theme ─────────────────────────────────────

function ThemeCard({
  id, active, onPress, accent,
}: {
  id: ThemeId; active: boolean; onPress: () => void; accent: typeof ACCENT_OPTIONS[number];
}) {
  const { scheme } = useThemeContext();
  const def    = THEMES[id];
  const tokens = scheme === "dark" ? def.dark : def.light;
  // Apply user accent override so the card reflects the chosen accent
  const cardAccent = accent.color;
  const cardAccentSubtle = scheme === "dark" ? accent.subtle : accent.lightSubtle;

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: "46%" as any,
        borderRadius: radius.xl,
        borderWidth: active ? 2 : 1,
        borderColor: active ? cardAccent : tokens.bgBorder,
        overflow: "hidden",
      }}
    >
      {/* Mini UI mockup */}
      <View style={{ backgroundColor: tokens.bgPrimary, padding: spacing[2], gap: spacing[1.5] }}>
        {/* Simulated header bar */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
          <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: cardAccent }} />
          <View style={{ height: 3, width: "40%", borderRadius: 99, backgroundColor: tokens.textPrimary, opacity: 0.6 }} />
        </View>
        {/* Simulated card */}
        <View style={{
          backgroundColor: tokens.bgSecondary,
          borderRadius: radius.md,
          borderWidth: 1, borderColor: tokens.bgBorder,
          padding: spacing[1.5], gap: spacing[1],
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: cardAccent }} />
            <View style={{ height: 3, flex: 1, borderRadius: 99, backgroundColor: tokens.textPrimary, opacity: 0.55 }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: tokens.bgBorder }} />
            <View style={{ height: 3, width: "60%", borderRadius: 99, backgroundColor: tokens.textSecondary, opacity: 0.4 }} />
          </View>
          {/* Accent badge */}
          <View style={{ alignSelf: "flex-start", backgroundColor: cardAccentSubtle, borderRadius: 99, paddingHorizontal: spacing[1], paddingVertical: 1 }}>
            <View style={{ height: 3, width: 20, borderRadius: 99, backgroundColor: cardAccent, opacity: 0.8 }} />
          </View>
        </View>
        {/* Bottom colour strip */}
        <View style={{ flexDirection: "row", height: 3, borderRadius: 99, overflow: "hidden", gap: 1 }}>
          <View style={{ flex: 1, backgroundColor: tokens.bgTertiary }} />
          <View style={{ flex: 1, backgroundColor: tokens.bgBorder }} />
          <View style={{ flex: 1, backgroundColor: cardAccent }} />
        </View>
      </View>
      {/* Label */}
      <View style={{
        paddingHorizontal: spacing[2.5], paddingVertical: spacing[2],
        backgroundColor: active ? `${cardAccent}12` : tokens.bgSecondary,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      }}>
        <View style={{ gap: 2 }}>
          <Text size="xs" weight={active ? "semibold" : "medium"}
            style={{ color: active ? cardAccent : tokens.textPrimary, fontFamily: active ? fontFamily.semibold : fontFamily.medium }}>
            {def.label}
          </Text>
          <Text style={{ fontSize: 10, fontFamily: fontFamily.regular, color: tokens.textTertiary, textTransform: "capitalize" }}>
            {def.background?.type ?? "gradient"}
          </Text>
        </View>
        {active && (
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: cardAccent, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Live preview card ─────────────────────────────────────────────────────────

function LivePreview({
  themeId, accent, bgStyle,
}: {
  themeId: ThemeId;
  accent: typeof ACCENT_OPTIONS[number];
  bgStyle: BgStyle;
}) {
  const { scheme } = useThemeContext();
  const def    = THEMES[themeId];
  const tokens = scheme === "dark" ? def.dark : def.light;
  const ac     = accent.color;
  const acSub  = scheme === "dark" ? accent.subtle : accent.lightSubtle;

  const cardBg = bgStyle === "blur"
    ? `${tokens.bgSecondary}D0`
    : tokens.bgSecondary;

  const mockTasks = [
    { label: "Design new dashboard layout", done: false, priority: ac },
    { label: "Fix sync race condition",     done: true,  priority: undefined },
    { label: "Add recurring tasks",         done: false, priority: undefined },
  ];

  return (
    <View style={{
      borderRadius: radius.xl,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: tokens.bgBorder,
      backgroundColor: tokens.bgPrimary,
    }}>
      {/* Gradient tint on bg */}
      {bgStyle === "gradient" && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          // @ts-ignore — web-only
          ...(Platform.OS === "web"
            ? { background: `linear-gradient(135deg, ${ac}14 0%, ${tokens.bgPrimary} 55%)` }
            : { backgroundColor: `${ac}0C` }),
        } as any} />
      )}

      {/* App header bar */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: spacing[4], paddingVertical: spacing[2],
        borderBottomWidth: 1, borderBottomColor: tokens.bgBorder,
        backgroundColor: `${tokens.bgSecondary}CC`,
      }}>
        <Text style={{ fontFamily: fontFamily.bold, fontSize: 13, color: tokens.textPrimary, letterSpacing: -0.3 }}>
          harry.
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: ac }} />
          <Text style={{ fontSize: 10, fontFamily: fontFamily.regular, color: ac }}>Just synced</Text>
        </View>
        <View style={{
          paddingHorizontal: spacing[1.5], paddingVertical: 2,
          borderRadius: radius.sm, borderWidth: 1, borderColor: tokens.bgBorder,
        }}>
          <Text style={{ fontSize: 9, fontFamily: fontFamily.medium, color: tokens.textSecondary }}>
            {def.label}
          </Text>
        </View>
      </View>

      {/* Screen content */}
      <View style={{ padding: spacing[3], gap: spacing[2] }}>
        {/* Page title + overdue banner */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: 18, color: tokens.textPrimary }}>Tasks</Text>
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: tokens.danger }} />
            <Text style={{ fontSize: 10, fontFamily: fontFamily.medium, color: tokens.danger }}>1 overdue</Text>
          </View>
        </View>

        {/* Task card */}
        <View style={{
          backgroundColor: cardBg,
          borderRadius: radius.lg, borderWidth: 1, borderColor: tokens.bgBorder,
          overflow: "hidden",
          // @ts-ignore
          ...(bgStyle === "blur" && Platform.OS === "web"
            ? { backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }
            : {}),
        }}>
          {mockTasks.map((t, i) => (
            <View key={i} style={{
              flexDirection: "row", alignItems: "center", gap: spacing[2],
              paddingHorizontal: spacing[3], paddingVertical: spacing[2],
              borderBottomWidth: i < mockTasks.length - 1 ? 1 : 0,
              borderBottomColor: tokens.bgBorder,
            }}>
              {/* Priority stripe */}
              {t.priority && !t.done && (
                <View style={{ width: 2, position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: t.priority }} />
              )}
              {/* Checkbox */}
              <View style={{
                width: 14, height: 14, borderRadius: 7,
                borderWidth: 1.5,
                borderColor: t.done ? ac : tokens.bgBorder,
                backgroundColor: t.done ? ac : "transparent",
                alignItems: "center", justifyContent: "center",
                marginLeft: t.priority && !t.done ? 4 : 0,
              }}>
                {t.done && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" }} />}
              </View>
              {/* Label */}
              <Text style={{
                flex: 1, fontSize: 11, fontFamily: fontFamily.regular,
                color: t.done ? tokens.textTertiary : tokens.textPrimary,
                textDecorationLine: t.done ? "line-through" : "none",
                opacity: t.done ? 0.6 : 1,
              }}>
                {t.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Bottom accent action row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", gap: spacing[1.5] }}>
            <View style={{ paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: 99, backgroundColor: acSub, borderWidth: 1, borderColor: `${ac}30` }}>
              <Text style={{ fontSize: 9, fontFamily: fontFamily.medium, color: ac }}>Priority</Text>
            </View>
            <View style={{ paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: 99, backgroundColor: tokens.bgTertiary, borderWidth: 1, borderColor: tokens.bgBorder }}>
              <Text style={{ fontSize: 9, fontFamily: fontFamily.medium, color: tokens.textSecondary }}>Date</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: spacing[2.5], paddingVertical: spacing[1], borderRadius: radius.md, backgroundColor: ac }}>
            <Text style={{ fontSize: 10, fontFamily: fontFamily.semibold, color: "#fff" }}>+ Add</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Appearance screen ────────────────────────────────────────────────────────

export default function AppearanceScreen() {
  const { colors }      = useTheme();
  const { scheme, toggle, accentId, setAccentId, themeId, setThemeId, bgStyle, setBgStyle } = useThemeContext();
  const router          = useRouter();
  const { width }       = useWindowDimensions();
  const isWide          = width >= 768;

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

          {/* ── Live Preview ─────────────────────────────────────────────── */}
          <View style={{ marginBottom: spacing[5] }}>
            <SectionLabel>Preview</SectionLabel>
            <LivePreview themeId={themeId} accent={currentAccent} bgStyle={bgStyle} />
          </View>

          {/* ── Theme grid ───────────────────────────────────────────────── */}
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

          {/* ── Accent colour ────────────────────────────────────────────── */}
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

          {/* ── Background style ─────────────────────────────────────────── */}
          <View style={{ marginBottom: spacing[5] }}>
            <SectionLabel>Background</SectionLabel>
            <View style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.xl,
              borderWidth: 1, borderColor: colors.bgBorder,
              overflow: "hidden",
            }}>
              {([ ["solid", "⬛", "Solid", "Flat colour, no effects"],
                  ["gradient", "🌅", "Gradient", "Subtle accent gradient"],
                  ["blur", "🫧",   "Blur",     "Frosted glass effect"],
              ] as [BgStyle, string, string, string][]).map(([id, icon, label, desc], i, arr) => {
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
                    <Text style={{ fontSize: 18, marginRight: spacing[3] }}>{icon}</Text>
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

          {/* ── Dark / Light mode ────────────────────────────────────────── */}
          <View style={{ marginBottom: spacing[5] }}>
            <SectionLabel>Mode</SectionLabel>
            <View style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.xl,
              borderWidth: 1, borderColor: colors.bgBorder,
              overflow: "hidden",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}>
                <Text style={{ fontSize: 18, marginRight: spacing[3] }}>
                  {scheme === "dark" ? "🌙" : "☀️"}
                </Text>
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
