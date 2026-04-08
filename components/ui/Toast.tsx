import React from "react";
import { View, Pressable, Platform } from "react-native";
import { Text } from "./Text";
import { useToast } from "@/lib/ToastContext";
import { spacing, radius } from "@/lib/theme";

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();
  if (toasts.length === 0) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: Platform.OS === "ios" ? 104 : 72,
        left: spacing[4],
        right: spacing[4],
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
            backgroundColor: "#222",
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: "#333",
            paddingVertical: spacing[3],
            paddingHorizontal: spacing[4],
            gap: spacing[3],
            shadowColor: "#000",
            shadowOpacity: 0.35,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Text size="sm" style={{ flex: 1, color: "#F0F0F0" }}>{toast.message}</Text>
          {toast.action && (
            <Pressable
              onPress={() => {
                toast.action!.onPress();
                dismissToast(toast.id);
              }}
              hitSlop={8}
            >
              <Text size="sm" weight="semibold" style={{ color: "#5B6AD0" }}>
                {toast.action.label}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={() => dismissToast(toast.id)} hitSlop={8}>
            <Text size="xs" style={{ color: "#666" }}>✕</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
