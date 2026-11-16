// packages/ui/src/primitives/PekuloLabel.native.tsx
import { Text, type TextProps } from "tamagui";
import { pekuloFontSizes, pekuloFontWeights } from "../tokens";

export interface PekuloLabelProps extends TextProps {
  htmlFor?: string;
}

export function PekuloLabel({ children, htmlFor: _htmlFor, ...props }: PekuloLabelProps) {
  return (
    <Text
      fontSize={pekuloFontSizes.bodySm}
      fontWeight={pekuloFontWeights.medium}
      color="$color"
      {...props}
    >
      {children}
    </Text>
  );
}
