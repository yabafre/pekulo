"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToast } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { signOut } from "@/app/(auth)/_actions/auth-actions";
import { purgeOfflineCache } from "@/lib/offline/cache-db";

export function SignOutButton() {
  const t = useTranslations("auth.signOut");
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await signOut();
      if (!result.ok) {
        toast.danger(t("title"), result.message);
        return;
      }
      // AC-4 — the session is gone; the decrypted-at-rest snapshot must go with
      // it before we leave the page. `onAuthStateChange('SIGNED_OUT')` (ADR-0003)
      // never fires here: auth runs server-side under httpOnly cookies.
      // `purgeOfflineCache` is exception-safe, and the catch keeps it that way
      // from this side too: the server session is ALREADY destroyed by now, so
      // a storage failure must never cost the user the navigation below.
      await purgeOfflineCache().catch(() => undefined);
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  // Destructive emphasis (red): sign-out is the page's exit action, so it reads
  // in $danger rather than grayscale — but stays a compact text+icon link, NOT
  // the oversized filled pill. The icon lives INSIDE the Text so it inherits
  // its colour (currentColor). Hover dims slightly for affordance.
  return (
    <View
      render="button"
      onPress={handleSignOut}
      aria-label={t("label")}
      aria-busy={loading}
      cursor="pointer"
      alignSelf="flex-start"
      backgroundColor="transparent"
      borderWidth={0}
      padding={0}
      hoverStyle={{ opacity: 0.8 }}
      pressStyle={{ opacity: 0.6 }}
    >
      <Text
        display="flex"
        flexDirection="row"
        alignItems="center"
        gap="$2"
        color={"$danger" as never}
        fontSize="$bodySm"
        fontWeight="600"
      >
        {loading ? (
          <Loader2 size={14} color="currentColor" />
        ) : (
          <LogOut size={14} color="currentColor" />
        )}
        {t("label")}
      </Text>
    </View>
  );
}
