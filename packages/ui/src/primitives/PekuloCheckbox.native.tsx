// packages/ui/src/primitives/PekuloCheckbox.native.tsx
import { Checkbox as TamaCheckbox, type CheckboxProps } from "@tamagui/checkbox";
import { Check } from "lucide-react-native";
import type { ComponentProps } from "react";
import { useTheme } from "tamagui";

function Root(props: CheckboxProps) {
  return <TamaCheckbox size="$3" backgroundColor="$backgroundMuted" borderWidth={0} {...props} />;
}

function Indicator(props: ComponentProps<typeof TamaCheckbox.Indicator>) {
  const theme = useTheme();
  return (
    <TamaCheckbox.Indicator {...props}>
      <Check size={14} color={theme.colorOnAccent.val} />
    </TamaCheckbox.Indicator>
  );
}

export const PekuloCheckbox = Object.assign(Root, { Indicator });
