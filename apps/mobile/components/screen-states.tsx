// apps/mobile/components/screen-states.tsx
// Shared loading skeleton and inline error recovery views for mobile screens.
// Ensures authenticated screens never flash fake preview balances while loading
// and always offer a clear retry path on network/API failure.

import { PekuloEmptyState, PekuloSkeleton } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { AlertCircle } from "lucide-react-native";

export function ScreenLoadingSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <View gap="$5" testID="screen-loading-skeleton">
      <View gap="$2">
        <PekuloSkeleton lines={1} height={14} width="35%" />
        <PekuloSkeleton lines={1} height={36} width="65%" />
        <PekuloSkeleton lines={1} height={16} width="45%" />
      </View>
      <View flexDirection="row" gap="$3">
        <View flex={1}>
          <PekuloSkeleton block height={84} />
        </View>
        <View flex={1}>
          <PekuloSkeleton block height={84} />
        </View>
      </View>
      {Array.from({ length: sections }, (_, i) => (
        <View
          key={`section-skeleton-${i === 0 ? "primary" : i === 1 ? "secondary" : "extra"}`}
          gap="$3"
        >
          <PekuloSkeleton lines={1} height={18} width="40%" />
          <PekuloSkeleton lines={3} height={16} />
        </View>
      ))}
    </View>
  );
}

export function ScreenErrorState({
  title = "Chargement impossible",
  message = "Vérifiez votre connexion et réessayez.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <PekuloEmptyState
      icon={AlertCircle}
      title={title}
      message={message}
      ctaLabel="Réessayer"
      onCta={onRetry}
    />
  );
}
