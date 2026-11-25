// apps/mobile/components/ai-transparency-notice.tsx
// Mobile port of story 11-5 (EU AI Act Art. 50 / DR-12): displays once when
// AI suggestions appear and `llmClient.getAiNotice()` returns `seen: false`,
// marks seen server-side, and latches visible until explicitly dismissed.
import { PekuloButton } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { Sparkles } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "tamagui";

import { useAuth } from "../lib/auth/auth-context";
import { useAiNotice } from "../lib/hooks/use-mobile-mutations";
import { useI18n } from "../lib/i18n";

export function AiTransparencyNotice() {
  const { isAuthenticated } = useAuth();
  const { seen, isLoading, markSeen, isMarking } = useAiNotice();
  const theme = useTheme();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const suppressedRef = useRef(false);
  const markedRef = useRef(false);

  const unseen = isAuthenticated && !isLoading && seen === false;

  useEffect(() => {
    if (!isAuthenticated) {
      setVisible(false);
      suppressedRef.current = false;
      markedRef.current = false;
      return;
    }
    if (!unseen) {
      if (seen === true) suppressedRef.current = false;
      markedRef.current = false;
      return;
    }
    if (!suppressedRef.current) {
      if (!visible) setVisible(true);
      if (!markedRef.current && !isMarking) {
        markedRef.current = true;
        markSeen();
      }
    }
  }, [isAuthenticated, unseen, seen, visible, isMarking, markSeen]);

  if (!visible) return null;

  return (
    <View
      testID="ai-transparency-notice"
      accessibilityLabel={t("transactions.suggestions.aiNoticeAria")}
      backgroundColor="$backgroundMuted"
      borderRadius="$md"
      marginBottom="$2"
      padding="$3"
      gap="$3"
      style={{ borderCurve: "continuous" }}
    >
      <View flexDirection="row" alignItems="flex-start" gap="$2">
        <Sparkles
          size={14}
          color={theme.colorSecondary.val}
          style={{ marginTop: 2 }}
          accessible={false}
          importantForAccessibility="no"
        />
        <Text color="$colorSecondary" fontSize="$xs" flex={1}>
          {t("transactions.suggestions.aiNoticeBody")}
        </Text>
      </View>
      <View alignItems="flex-end">
        <PekuloButton
          variant="ghost"
          size="sm"
          style={{ minHeight: 44 }}
          hitSlop={8}
          accessibilityLabel={t("transactions.suggestions.aiNoticeDismissAria")}
          testID="ai-transparency-notice-dismiss"
          onPress={() => {
            setVisible(false);
            suppressedRef.current = true;
          }}
        >
          {t("transactions.suggestions.aiNoticeDismiss")}
        </PekuloButton>
      </View>
    </View>
  );
}
