import React, { ReactNode } from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/Text";
import { spacing, radius } from "@/lib/theme";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    // Surface the real error instead of swallowing it — a silent boundary makes
    // crashes like this impossible to diagnose from a screenshot. Logged in all
    // environments; the message is also shown in the fallback UI below.
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], padding: spacing[6] }}>
          <Text size="base" weight="semibold">Something went wrong</Text>
          <Text size="sm" secondary style={{ textAlign: "center" }}>
            An unexpected error occurred in this section.
          </Text>
          {!!this.state.message && (
            <Text size="xs" secondary style={{ textAlign: "center", opacity: 0.7 }}>
              {this.state.message}
            </Text>
          )}
          <Pressable
            onPress={() => this.setState({ hasError: false, message: undefined })}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            style={({ pressed }) => ({
              paddingHorizontal: spacing[5],
              paddingVertical: spacing[2],
              borderRadius: radius.xl,
              opacity: pressed ? 0.7 : 1,
              borderWidth: 1,
              borderColor: "rgba(128,128,128,0.3)",
            })}
          >
            <Text size="sm" weight="medium">Tap to retry</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
