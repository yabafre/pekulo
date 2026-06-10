"use client";

// packages/ui/src/components/PekuloErrorBoundary.tsx
// React 19 error boundary using a class component (still the only way to
// catch render errors). No external dep.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Text, View } from "tamagui";

export interface PekuloErrorBoundaryProps {
  fallback?: ReactNode;
  /**
   * Render the default fallback as a dark, full-viewport, centered error
   * screen instead of an inline card. Set this on the TOP-LEVEL boundary (it
   * replaces the whole app on a bubbled error); leave it off for inline
   * boundaries that wrap a single widget. Ignored when `fallback` is provided.
   */
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
      // Top-level boundary: a bubbled error replaces the whole app (including
      // the dark shell that paints the page background), so the inline card
      // alone would sit on the browser-default white body. Wrap it in a dark,
      // full-viewport, centered container so the error screen stays on-brand.
      if (this.props.fullScreen) {
        return (
          <View
            backgroundColor="$background"
            flex={1}
            alignItems="center"
            justifyContent="center"
            padding="$5"
            style={{ minHeight: "100dvh" }}
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
