// packages/ui/src/components/PekuloEmptyState/PekuloEmptyState.native.tsx
import type { ComponentType } from "react";
import { Text, View, styled, useTheme } from "tamagui";

type IconComponent = ComponentType<{ size?: number; color?: string }>;

export interface PekuloEmptyStateProps {
  icon: IconComponent;
  title: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const CtaPill = styled(View, {
  name: "PekuloEmptyStateCta",
  role: "button",
  paddingHorizontal: "$4",
  paddingVertical: "$2",
  borderRadius: "$full",
  backgroundColor: "$color",
  pressStyle: { opacity: 0.9 },
});

export function PekuloEmptyState({
  icon: Icon,
  title,
  message,
  ctaLabel,
  onCta,
}: PekuloEmptyStateProps) {
  const theme = useTheme();
  return (
    <View alignItems="center" gap="$3" paddingVertical="$8" paddingHorizontal="$6">
      <View
        width={56}
        height={56}
        borderRadius="$full"
        backgroundColor="$backgroundMuted"
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={24} color={theme.colorSecondary.val} />
      </View>
      <Text color="$color" fontSize="$h3" fontWeight="600" textAlign="center">
        {title}
      </Text>
      <Text color="$colorSecondary" fontSize="$caption" textAlign="center">
        {message}
      </Text>
      {ctaLabel && onCta && (
        <CtaPill onPress={onCta} aria-label={ctaLabel}>
          <Text color="$colorOnAccent" fontSize="$caption" fontWeight="600">
            {ctaLabel}
          </Text>
        </CtaPill>
      )}
    </View>
  );
}
