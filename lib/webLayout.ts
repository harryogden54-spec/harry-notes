import { Platform, type ViewStyle } from "react-native";

/** Max-width container for web — centers content and prevents full-width stretch */
export const webContentStyle: ViewStyle =
  Platform.OS === "web"
    ? { maxWidth: 720, width: "100%", alignSelf: "center" }
    : {};

/** Wide variant for multi-column screens (tasks board) — the 720px cap
 *  squeezes two card columns to ~340px each; the design gives them ~1100. */
export const webWideContentStyle: ViewStyle =
  Platform.OS === "web"
    ? { maxWidth: 1100, width: "100%", alignSelf: "center" }
    : {};
