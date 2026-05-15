import React, { ReactNode } from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/Text";
import { spacing, radius } from "@/lib/theme";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], padding: spacing[6] }}>
          <Text size="base" weight="semibold">Something went wrong</Text>
          <Text size="sm" secondary style={{ textAlign: "center" }}>
            An unexpected error occurred in this section.
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false })}
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
