// apps/mobile/lib/haptics.ts
// Best-effort tactile feedback helpers (Apple HIG Accessibility). Never throws
// on simulators, web, or devices without a haptic engine.
import * as Haptics from "expo-haptics";

export function hapticSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticError(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export function hapticWarning(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

export function hapticSelection(): void {
  void Haptics.selectionAsync().catch(() => {});
}
