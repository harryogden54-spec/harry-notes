import React, { useState } from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, getShadow } from "@/lib/theme";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
};

type Props<T extends string | number> = {
  value: T | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Shown on the trigger while nothing is selected. */
  placeholder: string;
  /** Fixed trigger width — useful when several Selects sit in a row. */
  width?: number;
  flex?: number;
  /** Panel width when it needs to be wider than a narrow trigger. */
  panelMinWidth?: number;
  /** Controlled open state — pass both to let a parent keep sibling Selects
   *  mutually exclusive. Omit for self-managed open/close. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Minimal themed dropdown. Built from Pressable + an anchored panel rather than
 * a picker dependency (the app has no select primitive, and
 * react-native-reusables is not installed) and deliberately *not* from RN's
 * `<Modal>`: Selects are used inside existing modals, and on react-native-web a
 * dismissed nested Modal was observed lingering in the DOM instead of
 * unmounting. A conditionally-rendered panel is correct by construction —
 * closed means nothing is rendered.
 *
 * Dismissal is by picking an option or pressing the trigger again. There is no
 * outside-press backdrop, because covering the screen from here would mean
 * reintroducing the Modal this avoids.
 */
export function Select<T extends string | number>({
  value, options, onChange, placeholder, width, flex, panelMinWidth = 132,
  open: openProp, onOpenChange,
}: Props<T>) {
  const { colors, scheme } = useTheme();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };

  const selected = options.find(o => o.value === value);

  return (
    // zIndex is raised only while open so a closed Select can't shadow its
    // neighbours' panels.
    <View style={{ width, flex, position: "relative", zIndex: open ? 20 : undefined }}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={selected ? `${placeholder}: ${selected.label}` : placeholder}
        style={({ hovered }: any) => ({
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          gap: spacing[1],
          paddingHorizontal: spacing[2.5], paddingVertical: spacing[2],
          borderRadius: radius.md, borderWidth: 1,
          borderColor: open || hovered ? colors.accent : colors.bgBorder,
          backgroundColor: colors.bgTertiary,
          ...(Platform.OS === "web" ? { cursor: "pointer" } as any : {}),
        })}
      >
        <Text
          size="sm"
          numberOfLines={1}
          style={{ color: selected ? colors.textPrimary : colors.textTertiary }}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={13} color={colors.textTertiary} />
      </Pressable>

      {open && (
        <View
          style={{
            position: "absolute", top: "100%", left: 0, marginTop: spacing[1],
            minWidth: panelMinWidth, maxHeight: 208,
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.lg,
            borderWidth: 1, borderColor: colors.bgBorder,
            overflow: "hidden",
            ...getShadow("overlay", scheme),
          }}
        >
          <ScrollView>
            {options.map(opt => {
              const active = opt.value === value;
              return (
                <Pressable
                  key={String(opt.value)}
                  onPress={() => { onChange(opt.value); setOpen(false); }}
                  style={({ hovered }: any) => ({
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    gap: spacing[3],
                    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
                    backgroundColor: active
                      ? `${colors.accent}14`
                      : hovered ? colors.bgTertiary : "transparent",
                    ...(Platform.OS === "web" ? { cursor: "pointer" } as any : {}),
                  })}
                >
                  <Text size="sm" style={{ color: active ? colors.accent : colors.textPrimary }}>
                    {opt.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={14} color={colors.accent} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
