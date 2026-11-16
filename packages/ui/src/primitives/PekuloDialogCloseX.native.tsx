// packages/ui/src/primitives/PekuloDialogCloseX.native.tsx
import { X } from "lucide-react-native";
import { View, styled, useTheme } from "tamagui";
import { PekuloDialog } from "./PekuloDialog";

const CloseButton = styled(View, {
  name: "PekuloDialogCloseButton",
  role: "button",
  width: 32,
  height: 32,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "$full",
  backgroundColor: "transparent",
  pressStyle: { backgroundColor: "$backgroundMuted" },
});

export function PekuloDialogCloseX() {
  const theme = useTheme();
  return (
    <View position="absolute" top="$3" right="$3" zIndex={1}>
      <PekuloDialog.Close asChild>
        <CloseButton aria-label="Fermer">
          <X size={18} color={theme.colorTertiary.val} />
        </CloseButton>
      </PekuloDialog.Close>
    </View>
  );
}
