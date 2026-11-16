// packages/ui/src/primitives/PekuloSpinner.native.tsx
// Native loading spinner using lucide-react-native Loader2 + Animated rotation.

import { Loader2 } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { View, useTheme } from "tamagui";

export interface PekuloSpinnerProps {
  size?: number;
  color?: string;
  ariaLabel?: string;
}

export function PekuloSpinner({ size = 16, color, ariaLabel = "Chargement" }: PekuloSpinnerProps) {
  const theme = useTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const resolvedColor = color && !color.startsWith("var(") ? color : theme.color.val;

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
