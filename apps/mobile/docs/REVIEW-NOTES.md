# Pekulo — App Store & Google Play Review Notes

Copy the block below into App Store Connect (**App Review Information → Notes**) and Google Play Console (**App content → App access**) before submitting a release build, after filling in the demo credentials and device screen-recording URL.

```text
1. SCREEN RECORDING
Demo video URL: <paste link to a screen recording captured on a physical device>
The recording shows:
- App launch and sign-in with the demo account (and localization in FR/EN)
- Navigation across all 5 tabs: Cap (net worth & milestones), Transactions, Mensuel, Portefeuille, Immobilier
- Creating/editing an item via native form sheets (e.g., adding a transaction or updating the Cap goal)
- Settings: theme & language switching, explicit third-party AI opt-in consent modal (Apple 5.1.2(i)), and legal links (/privacy, /terms, /support)
- In-app permanent account deletion flow (Settings → Delete my account)

2. APP PURPOSE
Problem it solves: Individual savers often hold cash accounts, investment holdings, and real estate across multiple institutions with no single view of their progress toward a long-term net-worth target ("Cap").
Value it provides: Pekulo is a personal-finance tracker and goal planner that aggregates user-entered accounts, holdings, real estate equity, and monthly savings against a personal wealth target and milestones.

3. ACCESS INSTRUCTIONS AND TEST CREDENTIALS
Steps to reach the core features:
1. Launch Pekulo and sign in on the Login screen using the test account credentials below.
2. Cap tab (default): view total net worth, Cap progress donut, milestones, and cash accounts. Tap the profile/settings button to open Settings; tap "+" to add a milestone or account.
3. Transactions tab: browse monthly income/spending totals, review pending AI category suggestions (including the one-time AI transparency notice), search transactions, or tap "+" to record a transaction.
4. Mensuel tab: review monthly aggregates and sign-off status.
5. Portefeuille tab: inspect holdings and unrealized P&L; tap "+" to add a holding or lot.
6. Immobilier tab: inspect properties, mortgages, rental cash flow, and net equity; tap "+" to record a property or valuation.
7. Settings (top button on Cap): switch theme (System/Dark/Light) and language (FR/EN), edit the Cap objective, review third-party AI opt-in (off by default — toggling on displays an explicit consent dialog naming the configured provider and transmitted fields), open Privacy Policy / Terms & Accessibility / Support links, sign out, or permanently delete the account (Settings → Delete my account → type account email to confirm).

Test account username: <demo_reviewer_email@pekulo.app>
Test account password: <demo_reviewer_password_min_12_chars>
Note: This account is pre-populated with realistic net-worth data, stays active and free of 2FA for at least 30 days after submission. If you test Account Deletion, please do so last (or contact support@pekulo.app to reset the demo account).

4. EXTERNAL SERVICES & DATA HANDLING
Service / Purpose:
- Supabase (PostgreSQL + Auth) / User authentication and row-level-security isolated financial data storage (encrypted at rest and TLS in transit).
- Pekulo API (self-hosted EU VPS) / Domain API for accounts, transactions, holdings quotes, real estate, and monthly tracking.
- Optional AI transaction categorisation / Runs locally (on-device or self-hosted Ollama) by default. Third-party AI models are OFF by default and gated behind an explicit in-app consent dialog (Apple Guideline 5.1.2(i)); when enabled, only transaction label, amount, currency, and date are sent (zero personal identifiers or account numbers).
- Public legal & deletion URLs:
  - Privacy Policy: https://pekulo.app/privacy
  - Terms & EAA Annex V Accessibility Statement: https://pekulo.app/terms
  - Support: https://pekulo.app/support
  - Web Account Deletion: https://pekulo.app/account-deletion

5. ENCRYPTION & EXPORT COMPLIANCE
Pekulo uses only standard OS-provided HTTPS/TLS transport encryption and iOS Keychain / Android Keystore secure storage (ITSAppUsesNonExemptEncryption = false). No custom or non-exempt cryptography is implemented.

6. REGIONAL DIFFERENCES & FINANCIAL POSITIONING
Pekulo works the same in every supported region (French and English UI).
Important positioning note: Pekulo is strictly a personal-finance tracking and goal-planning tool. It does NOT hold custody of fiat funds or crypto assets, does NOT execute trades or orders, does NOT offer brokerage, lending, payments, or regulated financial/tax/investment advice, and includes NO in-app purchases or subscriptions. Optional EU open-banking aggregation (Bridge, an ACPR-regulated AISP) is available only on the Pekulo web app and is not present in the mobile app.
```
