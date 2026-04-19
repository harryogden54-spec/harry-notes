import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Pressable, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { Surface } from "./Surface";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";

type Mode = "focus" | "break";

const PRESETS: Record<Mode, number> = { focus: 25 * 60, break: 5 * 60 };

function fmt(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function fireCompletionNotification(mode: Mode) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: mode === "focus" ? "Focus session complete 🎉" : "Break over — back to work!",
        body:  mode === "focus" ? "Time for a 5-minute break." : "Start your next focus session.",
        sound: true,
      },
      trigger: null,
    });
  } catch { /* notifications not permitted */ }
}

export function FocusTimer() {
  const { colors } = useTheme();
  const [mode, setMode]       = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(PRESETS.focus);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fireCompletionNotification(mode);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [running, mode]);

  const switchMode = useCallback((m: Mode) => {
    clearInterval(intervalRef.current!);
    setRunning(false);
    setMode(m);
    setRemaining(PRESETS[m]);
  }, []);

  const toggle = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRunning(r => !r);
  }, []);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current!);
    setRunning(false);
    setRemaining(PRESETS[mode]);
  }, [mode]);

  const progress = 1 - remaining / PRESETS[mode];
  const isComplete = remaining === 0;

  return (
    <Surface style={{ padding: spacing[4], gap: spacing[3] }}>
      {/* Mode tabs */}
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        {(["focus", "break"] as Mode[]).map(m => {
          const active = mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => switchMode(m)}
              style={{
                paddingHorizontal: spacing[3], paddingVertical: spacing[1],
                borderRadius: radius.xl, borderWidth: 1,
                borderColor: active ? colors.accent : colors.bgBorder,
                backgroundColor: active ? `${colors.accent}18` : "transparent",
              }}
            >
              <Text size="xs" weight={active ? "semibold" : undefined}
                style={{ color: active ? colors.accent : colors.textSecondary }}>
                {m === "focus" ? "Focus · 25m" : "Break · 5m"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Timer row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
        {/* Progress arc (simple bar) */}
        <View style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: colors.bgBorder, overflow: "hidden" }}>
          <View style={{
            height: "100%",
            width: `${Math.round(progress * 100)}%`,
            borderRadius: 99,
            backgroundColor: isComplete ? colors.success ?? colors.accent : colors.accent,
          }} />
        </View>

        {/* Time display */}
        <Text size="lg" weight="bold" style={{ fontVariant: ["tabular-nums"], minWidth: 58, textAlign: "right" }}>
          {fmt(remaining)}
        </Text>

        {/* Controls */}
        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <Pressable
            onPress={toggle}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: isComplete ? colors.bgBorder : colors.accent,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name={running ? "pause" : "play"} size={16} color="#fff" />
          </Pressable>
          {(running || remaining !== PRESETS[mode]) && (
            <Pressable
              onPress={reset}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: colors.bgTertiary,
                borderWidth: 1, borderColor: colors.bgBorder,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="refresh" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {isComplete && (
        <Text size="xs" style={{ color: colors.accent, textAlign: "center" }}>
          {mode === "focus" ? "Session complete — great work!" : "Break over — ready to focus?"}
        </Text>
      )}
    </Surface>
  );
}
