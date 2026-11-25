import type { Metadata } from "next";
import { Text, View } from "@pekulo/ui/client";

export const metadata: Metadata = {
  title: "Terms of Service & Accessibility — Pekulo",
  description:
    "Pekulo terms of use, non-advisory disclaimer, and EAA Annex V accessibility notice.",
};

export default function TermsPage() {
  return (
    <View gap="$5">
      <View gap="$1">
        <Text fontSize="$h1" fontWeight="600" color="$color">
          Terms of Service &amp; Accessibility
        </Text>
        <Text fontSize="$xs" color="$colorTertiary">
          Last updated: 2026-11-25
        </Text>
      </View>

      <View gap="$2">
        <Text fontSize="$h3" fontWeight="600" color="$color">
          1. Nature of the Service
        </Text>
        <Text fontSize="$bodySm" color="$colorSecondary">
          Pekulo is a personal-finance tracking and goal-planning tool. Pekulo does not hold custody
          of funds or crypto assets, does not execute orders, and does not provide regulated
          investment, legal, or tax advice.
        </Text>
      </View>

      <View gap="$2">
        <Text fontSize="$h3" fontWeight="600" color="$color">
          2. Accounts &amp; Acceptable Use
        </Text>
        <Text fontSize="$bodySm" color="$colorSecondary">
          You are responsible for safeguarding your credentials (minimum 12-character password). You
          may terminate your account and erase all stored data at any time via Settings or
          /account-deletion.
        </Text>
      </View>

      <View gap="$2">
        <Text fontSize="$h3" fontWeight="600" color="$color">
          3. Accessibility Statement (European Accessibility Act — Directive (EU) 2019/882, Annex V)
        </Text>
        <Text fontSize="$bodySm" color="$colorSecondary">
          Pekulo is designed to conform with WCAG 2.1 / 2.2 Level AA and EN 301 549 Chapter 11 for
          web and mobile interfaces: full keyboard and screen-reader (VoiceOver / TalkBack)
          navigation, light and dark themes with at least 4.5:1 body text contrast, Dynamic Type and
          system font scaling, and Reduced Motion support. Report any accessibility barrier to
          support@pekulo.app.
        </Text>
      </View>
    </View>
  );
}
