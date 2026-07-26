/**
 * SafeAreaView that pads **only** the side notches.
 *
 * Tab screens must not pad top or bottom: PersistentHeader owns the top inset and
 * MobileTabBar owns the bottom one (see lib/TabBarHeightContext.tsx). Only the
 * left/right notches are the screen's business, and then only in landscape.
 *
 * Why this exists rather than `edges={["left", "right"]}` — the array form does
 * NOT mean "only these edges" on web. react-native-safe-area-context@5.6.2
 * disagrees with itself:
 *
 *   - SafeAreaView.tsx (native) fills missing edges with `'off'`.
 *   - SafeAreaView.web.tsx leaves them `undefined`, and getEdgeValue's
 *     `default:` branch is `'additive'` — so the inset is still added.
 *
 * So on web, `edges={["left","right"]}` quietly padded top and bottom by the
 * insets, on top of the header and tab bar that already reserve them. In a
 * browser tab the insets are 0 so nothing showed; in the iOS home-screen PWA it
 * produced a ~47px band below the header and a ~34px band above the tab bar.
 *
 * The explicit object form is honoured identically by both implementations, so
 * that is what this passes. Use this component for anything under the app
 * chrome; full-window modals still want a plain SafeAreaView with all edges.
 */
import React from "react";
import type { ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Sides on, top/bottom explicitly off — do not shorten this to an array. */
const SIDE_EDGES = {
  top: "off",
  bottom: "off",
  left: "additive",
  right: "additive",
} as const;

export function SideSafeArea({ children, ...rest }: ViewProps) {
  return (
    <SafeAreaView edges={SIDE_EDGES} {...rest}>
      {children}
    </SafeAreaView>
  );
}
