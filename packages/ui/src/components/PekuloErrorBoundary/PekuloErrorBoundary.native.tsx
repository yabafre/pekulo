// packages/ui/src/components/PekuloErrorBoundary/PekuloErrorBoundary.native.tsx
// Native error boundary using flex={1} instead of web CSS minHeight: "100dvh".

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Text, View } from "tamagui";

export interface PekuloErrorBoundaryProps {
  fallback?: ReactNode;
  fullScreen?: boolean;
  onError?: (error: Error, info: ErrorInfo) => void;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PekuloErrorBoundary extends Component<PekuloErrorBoundaryProps, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const card = (
        <View
          backgroundColor="$backgroundCard"
          borderRadius="$lg"
          padding="$5"
          role="alert"
          accessibilityLiveRegion="polite"
        >
          <Text color="$danger" fontSize="$bodySm" fontWeight="600">
            Une erreur s'est produite.
          </Text>
          <Text color="$colorSecondary" fontSize="$caption" marginTop="$1">
            {this.state.error?.message || "Détails indisponibles."}
          </Text>
        </View>
      );
      if (this.props.fullScreen) {
        return (
          <View
            backgroundColor="$background"
            flex={1}
            alignItems="center"
            justifyContent="center"
            padding="$5"
          >
            {card}
          </View>
        );
      }
      return card;
    }
    return this.props.children;
  }
}
