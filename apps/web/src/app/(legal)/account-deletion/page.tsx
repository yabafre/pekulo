import type { Metadata } from "next";
import Link from "next/link";
import { Text, View } from "@pekulo/ui/client";

export const metadata: Metadata = {
  title: "Account & Data Deletion — Pekulo",
  description: "How to permanently delete your Pekulo account and all associated financial data.",
};

export default function AccountDeletionPage() {
  return (
    <View gap="$5">
      <View gap="$1">
        <Text fontSize="$h1" fontWeight="600" color="$color">
          Account &amp; Data Deletion
        </Text>
        <Text fontSize="$xs" color="$colorTertiary">
          GDPR Right to Erasure · Apple 5.1.1(v) · Google Play Data Safety
        </Text>
      </View>

      <View gap="$2">
        <Text fontSize="$h3" fontWeight="600" color="$color">
          1. Delete Directly in the App (iOS, Android, Web)
        </Text>
        <Text fontSize="$bodySm" color="$colorSecondary">
          Open Pekulo → Settings (Paramètres) → Delete my account (Supprimer mon compte). Enter your
          account email address to confirm. Deletion runs immediately (within 60 seconds).
        </Text>
      </View>

      <View gap="$2">
        <Text fontSize="$h3" fontWeight="600" color="$color">
          2. Delete via Web After Uninstalling the Mobile App
        </Text>
        <Text fontSize="$bodySm" color="$colorSecondary">
          Sign in on the web dashboard, open Settings (/dashboard/parametres), and trigger permanent
          account deletion. If you cannot access your account, email privacy@pekulo.app from your
          registered email address and your account will be erased within 72 hours.
        </Text>
        <Link href="/login" style={{ textDecoration: "underline", color: "inherit" }}>
          <Text fontSize="$bodySm" color="$color">
            Sign in to manage or delete your account (/login)
          </Text>
        </Link>
      </View>

      <View gap="$2">
        <Text fontSize="$h3" fontWeight="600" color="$color">
          3. What Is Deleted
        </Text>
        <Text fontSize="$bodySm" color="$colorSecondary">
          Every user-scoped record is permanently erased in a single transaction across all 21
          database tables (compass, milestones, accounts, balance history, transactions, holdings,
          lots, real estate, mortgages, rentals, monthly tracking, preferences, AI opt-in &amp;
          activity logs), any connected Bridge bank user is revoked and deleted first, and your
          Supabase Auth identity is permanently removed. No personal financial data is retained.
        </Text>
      </View>
    </View>
  );
}
