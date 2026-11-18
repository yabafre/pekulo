// packages/ui/src/primitives/PekuloSpinner.native.tsx
// Native loading spinner using lucide-react-native Loader2 + Animated rotation.

import { Loader2 } from "lucide-react-native";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";
import { View, useTheme } from "tamagui";
import { usePrefersReducedMotion } from "../animations/use-stagger.native";

export interface PekuloSpinnerProps {
  size?: number;
  color?: string;
  ariaLabel?: string;
}

export function PekuloSpinner({ size = 16, color, ariaLabel = "Chargement" }: PekuloSpinnerProps) {
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin, reducedMotion]);

  const rotate = useMemo(
    () =>
      spin.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      }),
    [spin],
  );

  const resolvedColor =
    color && !color.startsWith("var(") && color !== "currentColor" ? color : theme.color.val;

  return (
    <View
      alignItems="center"
      justifyContent="center"
      accessibilityRole={ariaLabel.length > 0 ? "progressbar" : undefined}
      accessibilityLabel={ariaLabel.length > 0 ? ariaLabel : undefined}
      accessibilityElementsHidden={ariaLabel.length === 0}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Loader2 size={size} color={resolvedColor} />
      </Animated.View>
    </View>
  );
}
