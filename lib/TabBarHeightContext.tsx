import React, { createContext, useCallback, useContext, useState } from "react";
import { layout, spacing } from "./theme";

/**
 * Measured height of the mobile bottom tab bar — published by `MobileTabBar`
 * and consumed by everything that has to sit clear of it.
 *
 * The tab bar is the single owner of the bottom safe-area inset: it pads itself
 * by `Math.max(insets.bottom, …)` and then reports its total height here.
 * Nothing else reads `insets.bottom` for the bottom edge.
 *
 * Why not react-navigation's `useBottomTabBarHeight()`: that hook reads
 * `BottomTabBarHeightContext`, which `BottomTabView` only ever populates from
 * the *default* tab bar's onLayout. A custom `tabBar` never reports back, so
 * the hook returns a stale first-render estimate. It is also only available
 * inside the navigator, while the FAB stack (`app/(tabs)/_layout.tsx`) and the
 * toast container (`app/_layout.tsx`) both live outside it.
 *
 * Why this matters: bottom offsets used to be picked with
 * `Platform.OS === "ios"`, which is **false in the iOS home-screen PWA**
 * (`Platform.OS` is `"web"` there). The iPhone therefore got the shorter
 * Android offsets while still reserving a ~34px home-indicator inset, leaving
 * the FAB stack and toasts partly behind the tab bar. Deriving every offset
 * from the measured height fixes all of those surfaces at once, on every
 * platform, with no platform branching at all.
 */

const HeightContext = createContext<number>(0);
const ReportContext = createContext<(h: number) => void>(() => {});

export function TabBarHeightProvider({ children }: { children: React.ReactNode }) {
  const [height, setHeight] = useState(0);
  // onLayout fires on every rotation/resize; ignore sub-pixel jitter so the
  // whole tree doesn't re-render for a fractional change.
  const report = useCallback((h: number) => {
    setHeight(prev => (Math.abs(prev - h) < 1 ? prev : h));
  }, []);
  return (
    <ReportContext.Provider value={report}>
      <HeightContext.Provider value={height}>{children}</HeightContext.Provider>
    </ReportContext.Provider>
  );
}

/** Measured tab-bar height. 0 when there is no tab bar (desktop sidebar layout). */
export function useTabBarHeight(): number {
  return useContext(HeightContext);
}

/** Called by MobileTabBar's onLayout — nothing else should use this. */
export function useReportTabBarHeight(): (h: number) => void {
  return useContext(ReportContext);
}

/**
 * Bottom padding for a tab screen's scroll content: clears the tab bar plus a
 * gutter so the last row isn't flush against it.
 *
 * `fallback` is used on layouts with no tab bar (the desktop sidebar), where it
 * is just a bottom gutter — pass the screen's previous fixed value so desktop
 * spacing is unchanged.
 */
export function useScrollBottomPadding(fallback: number = spacing[16]): number {
  const height = useTabBarHeight();
  return height > 0 ? height + spacing[6] : fallback;
}

/**
 * Bottom offset for floating UI (FAB stack, toasts) so it clears the tab bar.
 * The fallback is the pre-measurement estimate — used for the first frame and
 * on the desktop layout.
 */
export function useFloatingBottom(): number {
  const height = useTabBarHeight();
  return height > 0 ? height + spacing[3] : layout.fabBottom.default;
}
