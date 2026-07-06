import type React from "react";
import type { Ionicons } from "@expo/vector-icons";

export type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export type NavItem = {
  name: string;
  label: string;
  iconOutline: IoniconName;
  iconFilled: IoniconName;
  path: string;
};

export const NAV_ITEMS: NavItem[] = [
  { name: "index",   label: "Home",     iconOutline: "home-outline",     iconFilled: "home",     path: "/(tabs)/" },
  { name: "today",   label: "Today",    iconOutline: "today-outline",    iconFilled: "today",    path: "/(tabs)/today" },
  { name: "tasks",   label: "Tasks",    iconOutline: "checkbox-outline", iconFilled: "checkbox", path: "/(tabs)/tasks" },
  { name: "notes",   label: "Notes",    iconOutline: "albums-outline",   iconFilled: "albums",   path: "/(tabs)/notes" },
  { name: "courses", label: "Courses",  iconOutline: "school-outline",   iconFilled: "school",   path: "/(tabs)/courses" },
  { name: "dump",    label: "Dump",     iconOutline: "cloud-upload-outline", iconFilled: "cloud-upload",  path: "/(tabs)/dump" },
];

// Mobile bottom bar shows only these four (six tabs was too cluttered);
// every other NAV_ITEM lives in the "More" sheet. The desktop sidebar
// always shows everything.
export const MOBILE_BAR_NAMES: readonly string[] = ["index", "today", "tasks", "notes"];
