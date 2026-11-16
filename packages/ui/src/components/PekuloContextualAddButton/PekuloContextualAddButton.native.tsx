// packages/ui/src/components/PekuloContextualAddButton/PekuloContextualAddButton.native.tsx
import { Plus } from "lucide-react-native";
import { View, styled, useTheme } from "tamagui";

const FAB = styled(View, {
  name: "PekuloContextualAddFab",
  role: "button",
  width: 44,
  height: 44,
  borderRadius: "$full",
  backgroundColor: "$color",
  alignItems: "center",
  justifyContent: "center",
  pressStyle: { scale: 0.95 },
});

export interface PekuloContextualAddButtonProps {
  label: string;
  onPress: () => void;
}

export function PekuloContextualAddButton({ label, onPress }: PekuloContextualAddButtonProps) {
  const theme = useTheme();
  return (
    <FAB onPress={onPress} aria-label={label}>
      <Plus size={22} color={theme.background.val} />
    </FAB>
  );
}
