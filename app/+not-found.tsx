import { Link, Stack } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { spacing } from "@/lib/theme";

export default function NotFoundScreen() {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bgPrimary,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing[5],
        }}
      >
        <Text size="xl" weight="semibold">Page not found</Text>
        <Link href="/" style={{ marginTop: spacing[4] }}>
          <Text size="sm" color={colors.accent}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}
