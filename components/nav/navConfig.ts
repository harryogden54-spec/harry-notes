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
  { name: "postits", label: "Post Its", iconOutline: "layers-outline",   iconFilled: "layers",   path: "/(tabs)/postits" },
];
