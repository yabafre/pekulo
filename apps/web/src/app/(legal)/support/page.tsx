import type { Metadata } from "next";
import Link from "next/link";
import { Text, View } from "@pekulo/ui/client";

export const metadata: Metadata = {
  title: "Support — Pekulo",
  description: "Contact Pekulo support and report issues.",
};

export default function SupportPage() {
  return (
    <View gap="$5">
      <View gap="$1">
        <Text fontSize="$h1" fontWeight="600" color="$color">
          Pekulo Support
        </Text>
        <Text fontSize="$xs" color="$colorTertiary">
          App Store &amp; Google Play Support Center
        </Text>
      </View>

      <View gap="$2">
        <Text fontSize="$h3" fontWeight="600" color="$color">
          Contact
        </Text>
        <Text fontSize="$bodySm" color="$colorSecondary">
          For help with your account, data export, bug reports, or accessibility requests, email
          support@pekulo.app or open an issue on https://github.com/yabafre/pekulo/issues.
        </Text>
      </View>

      <View gap="$2">
        <Text fontSize="$h3" fontWeight="600" color="$color">
          Account &amp; Privacy Resources
        </Text>
        <View gap="$2">
          <Link href="/privacy" style={{ textDecoration: "underline", color: "inherit" }}>
            <Text fontSize="$bodySm" color="$color">
              Read the Privacy Policy (/privacy)
            </Text>
          </Link>
          <Link href="/account-deletion" style={{ textDecoration: "underline", color: "inherit" }}>
            <Text fontSize="$bodySm" color="$color">
              Delete your account and all data (/account-deletion)
            </Text>
          </Link>
        </View>
      </View>
    </View>
  );
}
