import type { Metadata } from "next";
import Link from "next/link";
import { Text, View } from "@pekulo/ui/client";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Pekulo collects, processes, protects, and deletes personal and financial data.",
};

export default function PrivacyPage() {
  return (
    <View gap="$5">
      <View gap="$1">
        <Text render="h1" fontSize="$h1" fontWeight="600" color="$color">
          Privacy Policy / Politique de confidentialité
        </Text>
        <Text render="p" fontSize="$xs" color="$colorTertiary">
          Last updated: 2026-11-25
        </Text>
      </View>

      <View render="section" gap="$2">
        <Text render="h2" fontSize="$h3" fontWeight="600" color="$color">
          1. Data Controller &amp; Scope
        </Text>
        <Text render="p" fontSize="$bodySm" color="$colorSecondary">
          Pekulo is a goal-based personal finance tracker and planner. Personal data is processed
          strictly to deliver your account, net-worth tracking, and optional integrations under GDPR
          (EU 2016/679) and French CNIL guidance. Pekulo never sells user data and does not run
          cross-app advertising trackers.
        </Text>
      </View>

      <View render="section" gap="$2">
        <Text render="h2" fontSize="$h3" fontWeight="600" color="$color">
          2. Data Collected &amp; Purpose
        </Text>
        <Text render="p" fontSize="$bodySm" color="$colorSecondary">
          Account identity (email address, password hash managed by Supabase Auth) and financial
          records you enter or connect (accounts, balances, transactions, holdings, real estate,
          compass targets, and monthly aggregates). Used solely for app functionality, linked to
          your account, and isolated via PostgreSQL Row Level Security.
        </Text>
      </View>

      <View render="section" gap="$2">
        <Text render="h2" fontSize="$h3" fontWeight="600" color="$color">
          3. Sub-processors &amp; AI Categorisation
        </Text>
        <Text render="p" fontSize="$bodySm" color="$colorSecondary">
          Infrastructure and authentication: Supabase (encrypted at rest and TLS in transit).
          Optional bank aggregation (web, explicit consent): Bridge (ACPR-regulated AISP).
          Transaction categorisation runs locally (Apple FoundationModels or self-hosted Ollama) by
          default; third-party AI APIs (Mistral AI by default) are disabled by default and require
          explicit opt-in consent naming the provider, receiving only transaction label, amount,
          currency, and date (zero user identifiers or account numbers).
        </Text>
      </View>

      <View render="section" gap="$2">
        <Text render="h2" fontSize="$h3" fontWeight="600" color="$color">
          4. Retention &amp; Your Rights (GDPR)
        </Text>
        <Text render="p" fontSize="$bodySm" color="$colorSecondary">
          Your data is retained while your account remains active. You may export all your data as
          JSON or permanently delete your account and every associated record at any time from
          Settings on web or mobile, or by following the instructions on{" "}
          <Link href="/account-deletion" className={styles.inlineLink}>
            /account-deletion
          </Link>
          . Contact:{" "}
          <a href="mailto:privacy@pekulo.app" className={styles.inlineLink}>
            privacy@pekulo.app
          </a>
          .
        </Text>
      </View>
    </View>
  );
}
