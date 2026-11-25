import type { Metadata } from "next";
import Link from "next/link";
import { Text, View } from "@pekulo/ui/client";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Account & Data Deletion",
  description: "How to permanently delete your Pekulo account and all associated financial data.",
};

export default function AccountDeletionPage() {
  return (
    <View gap="$5">
      <View gap="$1">
        <Text render="h1" fontSize="$h1" fontWeight="600" color="$color">
          Account &amp; Data Deletion
        </Text>
        <Text render="p" fontSize="$xs" color="$colorTertiary">
          GDPR Right to Erasure · Apple 5.1.1(v) · Google Play Data Safety
        </Text>
      </View>

      <View render="section" gap="$2">
        <Text render="h2" fontSize="$h3" fontWeight="600" color="$color">
          1. Delete Directly in the App (iOS &amp; Web)
        </Text>
        <Text render="p" fontSize="$bodySm" color="$colorSecondary">
          Open Pekulo → Settings (Paramètres) → Delete my account (Supprimer mon compte). Enter your
          account email address to confirm. Deletion runs immediately (within 60 seconds). On
          Android, Settings guides you directly to the web deletion flow below until the native
          Android confirmation modal ships.
        </Text>
      </View>

      <View render="section" gap="$2">
        <Text render="h2" fontSize="$h3" fontWeight="600" color="$color">
          2. Delete via Web (or After Uninstalling the Mobile App)
        </Text>
        <Text render="p" fontSize="$bodySm" color="$colorSecondary">
          Sign in on the web dashboard, open Settings (/dashboard/parametres), and trigger permanent
          account deletion. If you cannot access your account, email{" "}
          <a href="mailto:privacy@pekulo.app" className={styles.inlineLink}>
            privacy@pekulo.app
          </a>{" "}
          from your registered email address and your account will be erased within 72 hours.
        </Text>
        <Link href="/login" className={styles.inlineLink}>
          <Text fontSize="$bodySm" color="$color">
            Sign in to manage or delete your account (/login)
          </Text>
        </Link>
      </View>

      <View render="section" gap="$2">
        <Text render="h2" fontSize="$h3" fontWeight="600" color="$color">
          3. What Is Deleted
        </Text>
        <Text render="p" fontSize="$bodySm" color="$colorSecondary">
          Every user-scoped record is permanently erased in a single transaction across all 23
          database tables (compass, milestones, accounts, balance history, transactions, holdings,
          lots, real estate, mortgages, rentals, monthly tracking, dashboard layout, preferences, AI
          opt-in &amp; activity logs, and advisory records), any connected Bridge bank user is
          revoked and deleted first, and your Supabase Auth identity is permanently removed. No
          personal financial data is retained.
        </Text>
      </View>
    </View>
  );
}
