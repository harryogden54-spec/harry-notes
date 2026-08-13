import React from "react";
import { View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { useToast, useToastState } from "@/lib/ToastContext";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, getShadow, layout } from "@/lib/theme";
import { useFloatingBottom } from "@/lib/TabBarHeightContext";

export function ToastContainer() {
  const toasts = useToastState();
  const { dismissToast } = useToast();
  const { colors, scheme, shadow } = useTheme();
  // Sits just above the FAB stack, both derived from the tab bar's measured
  // height. The old Platform.OS === "ios" branch left toasts behind the tab
  // bar in the iOS PWA, where Platform.OS is "web".
  const floatingBottom = useFloatingBottom();
  if (toasts.length === 0) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: floatingBottom + 4,
        // Desktop web: bottom-right stack (a full-width toast on a 1280px
        // window reads as a system banner, not a toast). Mobile: full width.
        ...(Platform.OS === "web"
          ? { right: spacing[5], left: undefined, width: layout.panel.toast, maxWidth: "90%" as any }
          : { left: spacing[4], right: spacing[4] }),
        gap: spacing[2],
        zIndex: 9999,
        // @ts-ignore
        pointerEvents: "box-none",
      }}
    >
      {toasts.map(toast => (
        <View
          key={toast.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.bgBorder,
            paddingVertical: spacing[3],
            paddingHorizontal: spacing[4],
            gap: spacing[3],
            ...shadow("md"),
          }}
        >
          <Text size="sm" style={{ flex: 1, color: colors.textPrimary }}>{toast.message}</Text>
          {toast.action && (
            <Pressable
              onPress={() => {
                toast.action!.onPress();
                dismissToast(toast.id);
              }}
              hitSlop={8}
            >
              <Text size="sm" weight="semibold" style={{ color: colors.accent }}>
                {toast.action.label}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={() => dismissToast(toast.id)} hitSlop={8}>
            <Ionicons name="close-outline" size={16} color={colors.textTertiary} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
