"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Text, View } from "@pekulo/ui/client";
import { PekuloButton } from "@pekulo/ui";
import { Sparkles } from "lucide-react";
import { useAiNotice, useMarkAiNotice } from "../_hooks/use-ai-notice";

// Story 6-4 (DR-12 / AC-3) + 6-7 (FR-33 amended / AC-2) + 11-5 (EU AI Act
// transparency notice lifecycle & opt-out → opt-in re-trigger).
// Shown when the user first encounters AI categorisation (or after an
// opt-out → opt-in transition resets ai_notice_seen_at to null).
// Marks itself seen server-side on first appearance so reloads do not re-show
// it, while latching visibility locally until the user clicks the dismiss
// button (preventing the post-markAiNotice cache refetch from unmounting the
// banner before the user reads or dismisses it). A local suppression ref keeps
// the banner hidden after a dismiss even if the seen cache still says false,
// re-arming only once the server reports seen=true — so a later opt-out →
// opt-in reset re-triggers the notice.
export function AiTransparencyNotice() {
  const t = useTranslations("llm");
  const { data, isLoading } = useAiNotice();
  const markSeen = useMarkAiNotice();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const suppressedRef = useRef(false);
  const markedCycleRef = useRef(false);

  useEffect(() => setIsHydrated(true), []);

  // Default to seen until the read resolves → no flash for returning users.
  const unseen = isHydrated && !isLoading && data?.seen === false;

  useEffect(() => {
    if (!unseen) {
      // Re-arm only when the server explicitly confirms seen=true: a future
      // opt-out → opt-in transition that flips seen back to false will then
      // re-show the notice, while a fast dismiss before the markAiNotice
      // refetch settles stays suppressed across intermediate renders.
      if (data?.seen === true) {
        suppressedRef.current = false;
      }
      markedCycleRef.current = false;
      return;
    }
    if (!suppressedRef.current) {
      if (!isVisible) {
        setIsVisible(true);
      }
      if (!markedCycleRef.current && !markSeen.isPending) {
        markedCycleRef.current = true;
        markSeen.mutate(undefined);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseen, data?.seen, isVisible]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    suppressedRef.current = true;
  };

  return (
    <View
      role="note"
      aria-label={t("aiNotice.ariaLabel")}
      flexDirection="row"
      gap="$3"
      alignItems="flex-start"
      justifyContent="space-between"
      padding="$3"
      marginBottom="$2"
      borderRadius="$md"
      backgroundColor="$backgroundMuted"
    >
      <View flexDirection="row" gap="$2" alignItems="flex-start" flex={1}>
        <Sparkles size={14} color="var(--colorSecondary)" aria-hidden />
        <Text color="$colorSecondary" fontSize="$xs" flex={1}>
          {t("aiNotice.body")}
        </Text>
      </View>
      <PekuloButton
        variant="ghost"
        size="xs"
        className="font_body"
        data-testid="ai-transparency-notice-dismiss"
        aria-label={t("aiNotice.dismissAriaLabel")}
        onClick={handleDismiss}
      >
        {t("aiNotice.dismiss")}
      </PekuloButton>
    </View>
  );
}
