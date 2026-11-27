// apps/mobile/lib/haptics.ts
// Best-effort tactile feedback helpers (Apple HIG Accessibility). Never throws
// synchronously or asynchronously on simulators, web, or devices without a
// haptic engine.
import * as Haptics from "expo-haptics";

function runSafeHaptic(trigger: () => Promise<void> | void): void {
  try {
    void Promise.resolve(trigger()).catch(() => {});
  } catch {
    // Non-throwing contract: ignore missing/unsupported haptic engines.
  }
}

export function hapticSuccess(): void {
  runSafeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticError(): void {
  runSafeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

export function hapticWarning(): void {
  runSafeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function hapticSelection(): void {
  runSafeHaptic(() => Haptics.selectionAsync());
}
