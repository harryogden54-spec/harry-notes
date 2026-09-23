import type React from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { NavGlyph } from "./NavIcon";

export type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export type NavItem = {
  name: string;
  label: string;
  /** Duotone glyph drawn by NavIcon (native falls back to an Ionicons pair). */
  glyph: NavGlyph;
  path: string;
};

export const NAV_ITEMS: NavItem[] = [
  { name: "index",   label: "Home",     glyph: "home", path: "/(tabs)/" },
  { name: "today",   label: "Today",    glyph: "today", path: "/(tabs)/today" },
  { name: "tasks",   label: "Tasks",    glyph: "tasks", path: "/(tabs)/tasks" },
  { name: "notes",   label: "Notes",    glyph: "notes", path: "/(tabs)/notes" },
  { name: "courses", label: "Courses",  glyph: "courses", path: "/(tabs)/courses" },
  { name: "dump",    label: "Dump",     glyph: "dump", path: "/(tabs)/dump" },
];

// Mobile bottom bar shows only these four (six tabs was too cluttered);
// every other NAV_ITEM lives in the "More" sheet. The desktop sidebar
// always shows everything.
export const MOBILE_BAR_NAMES: readonly string[] = ["index", "today", "tasks", "notes"];
