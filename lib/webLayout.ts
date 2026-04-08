import { Platform, type ViewStyle } from "react-native";

/** Max-width container for web — centers content and prevents full-width stretch */
export const webContentStyle: ViewStyle =
  Platform.OS === "web"
    ? { maxWidth: 720, width: "100%", alignSelf: "center" }
    : {};
