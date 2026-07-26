/**
 * Row primitives for the Settings screen.
 *
 * Extracted from app/settings.tsx, which had ~115 lines of layout primitives
 * sitting above a 440-line screen component. Note this does NOT reduce what the
 * browser parses when you open Settings — on web the route is already its own
 * lazy chunk, and moving a component to a sibling module puts it in the same
 * chunk. The win is navigability and reuse, not load time.
 */
import React from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius } from "@/lib/theme";

export function SectionLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text size="xs" weight="semibold" style={{
      textTransform: "uppercase", letterSpacing: 1.2,
      color: colors.textTertiary,
      paddingHorizontal: spacing[1],
      marginBottom: spacing[1.5], marginTop: spacing[1],
    }}>
      {children}
    </Text>
  );
}

export function RowGroup({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.bgSecondary,
      borderRadius: radius.xl,
      borderWidth: 1, borderColor: colors.bgBorder,
      overflow: "hidden",
      marginBottom: spacing[5],
    }}>
      {children}
    </View>
  );
}

export function Row({
  icon, label, subtitle, right, onPress, chevron = false, danger = false, isLast = false,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
  isLast?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <View style={{
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing[4], paddingVertical: spacing[3],
      gap: spacing[3],
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: colors.bgBorder,
    }}>
      {icon && (
        <View style={{
          width: 30, height: 30, borderRadius: radius.md,
          backgroundColor: `${colors.accent}18`,
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name={icon} size={16} color={colors.accent} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text size="sm" weight="medium" style={{ color: danger ? colors.danger : colors.textPrimary }}>
          {label}
        </Text>
        {subtitle && (
          <Text size="xs" style={{ color: colors.textTertiary }}>{subtitle}</Text>
        )}
      </View>
      {right}
      {chevron && (
        <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

export function SyncDot({ status }: { status: string }) {
  const { colors } = useTheme();
  const statusColor: Record<string, string> = {
    idle:    colors.textSecondary,
    syncing: colors.warning,
    synced:  colors.success,
    error:   colors.danger,
  };
  const label: Record<string, string> = {
    idle: "Not synced yet", syncing: "Syncing…", synced: "Up to date", error: "Sync error",
  };
  const color = statusColor[status] ?? statusColor.idle;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}>
      <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: color }} />
      <Text size="xs" style={{ color }}>{label[status] ?? status}</Text>
    </View>
  );
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)    return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
