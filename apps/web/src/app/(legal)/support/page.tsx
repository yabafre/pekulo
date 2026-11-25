import type { Metadata } from "next";
import Link from "next/link";
import { Text, View } from "@pekulo/ui/client";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Support",
  description: "Contact Pekulo support and report issues.",
};

export default function SupportPage() {
  return (
    <View gap="$5">
      <View gap="$1">
        <Text render="h1" fontSize="$h1" fontWeight="600" color="$color">
          Pekulo Support
        </Text>
        <Text render="p" fontSize="$xs" color="$colorTertiary">
          App Store &amp; Google Play Support Center
        </Text>
      </View>

      <View render="section" gap="$2">
        <Text render="h2" fontSize="$h3" fontWeight="600" color="$color">
          Contact
        </Text>
        <Text render="p" fontSize="$bodySm" color="$colorSecondary">
          For help with your account, data export, bug reports, or accessibility requests, email{" "}
          <a href="mailto:support@pekulo.app" className={styles.inlineLink}>
            support@pekulo.app
          </a>{" "}
          or open an issue on{" "}
          <a
            href="https://github.com/yabafre/pekulo/issues"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.inlineLink}
          >
            github.com/yabafre/pekulo/issues
          </a>
          .
        </Text>
      </View>

      <View render="section" gap="$2">
        <Text render="h2" fontSize="$h3" fontWeight="600" color="$color">
          Account &amp; Privacy Resources
        </Text>
        <View gap="$2">
          <Link href="/privacy" className={styles.inlineLink}>
            <Text fontSize="$bodySm" color="$color">
              Read the Privacy Policy (/privacy)
            </Text>
          </Link>
          <Link href="/account-deletion" className={styles.inlineLink}>
            <Text fontSize="$bodySm" color="$color">
              Delete your account and all data (/account-deletion)
            </Text>
          </Link>
        </View>
      </View>
    </View>
  );
}
