// packages/ui/src/primitives/PekuloSwitch.native.tsx
// Native switch wrapping @tamagui/switch without web CSS transition properties.

import { Switch as TamaSwitch, type SwitchProps } from "@tamagui/switch";

export function PekuloSwitch({ checked, ...props }: SwitchProps) {
  return (
    <TamaSwitch
      checked={checked}
      width={52}
      height={30}
      padding={3}
      borderWidth={0}
      borderRadius={1000}
      backgroundColor="$backgroundMuted"
      activeStyle={{ backgroundColor: "$color" }}
      {...props}
    >
      <TamaSwitch.Thumb
        width={24}
        height={24}
        borderRadius={1000}
        backgroundColor="$color"
        activeStyle={{ backgroundColor: "$background" }}
      />
    </TamaSwitch>
  );
}
