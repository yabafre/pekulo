"use client";

// packages/ui/src/components/PekuloErrorBoundary.tsx
// React 19 error boundary using a class component (still the only way to
// catch render errors). No external dep.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Text, View } from "tamagui";

export interface PekuloErrorBoundaryProps {
  fallback?: ReactNode;
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
      return (
        <View
          backgroundColor="$backgroundCard"
          borderRadius="$lg"
          padding="$5"
          role="alert"
          aria-live="polite"
        >
          <Text color="$danger" fontSize="$bodySm" fontWeight="600">
            Une erreur s'est produite.
          </Text>
          <Text color="$colorSecondary" fontSize="$caption" marginTop="$1">
            {this.state.error?.message ?? "Détails indisponibles."}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}
