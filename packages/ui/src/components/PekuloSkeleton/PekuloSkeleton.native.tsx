// packages/ui/src/components/PekuloSkeleton/PekuloSkeleton.native.tsx
// Native skeleton placeholder with Animated opacity pulse (no <style> keyframes).

import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { View, useTheme } from "tamagui";
import { usePrefersReducedMotion } from "../../animations/use-stagger.native";

export interface PekuloSkeletonProps {
  lines?: number;
  height?: number;
  block?: boolean;
  width?: number | `${number}%`;
}

export function PekuloSkeleton({ lines = 1, height = 16, block, width }: PekuloSkeletonProps) {
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.6);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 750, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reducedMotion]);

  if (block) {
    return (
      <Animated.View
        accessibilityElementsHidden
        style={{
          width: width ?? "100%",
          height,
          borderRadius: 8,
          backgroundColor: theme.backgroundMuted.val,
          opacity,
        }}
      />
    );
  }

  const lineCount = Math.max(0, Math.trunc(Number.isFinite(lines) ? lines : 1));

  return (
    <View flexDirection="column" gap={6} accessibilityElementsHidden>
      {Array.from({ length: lineCount }, (_, i) => (
        <Animated.View
          key={`skeleton-line-${i}`}
          style={{
            height,
            width: width ?? `${Math.max(20, 100 - i * 12)}%`,
            borderRadius: 6,
            backgroundColor: theme.backgroundMuted.val,
            opacity,
          }}
        />
      ))}
    </View>
  );
}
