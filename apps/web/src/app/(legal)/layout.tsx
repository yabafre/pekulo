import Link from "next/link";
import type { ReactNode } from "react";
import { Text, View } from "@pekulo/ui/client";

const NAV_ITEMS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Accessibility" },
  { href: "/support", label: "Support" },
  { href: "/account-deletion", label: "Account Deletion" },
] as const;

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <View
      minHeight="100vh"
      backgroundColor="$background"
      paddingHorizontal="$6"
      paddingVertical="$8"
      alignItems="center"
    >
      <View width="100%" maxWidth={760} gap="$6">
        <View
          flexDirection="row"
          flexWrap="wrap"
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
        >
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <Text fontSize="$h2" fontWeight="600" color="$color">
              Pekulo
            </Text>
          </Link>
          <View flexDirection="row" flexWrap="wrap" gap="$4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{ textDecoration: "underline", color: "inherit" }}
              >
                <Text fontSize="$xs" color="$colorSecondary">
                  {item.label}
                </Text>
              </Link>
            ))}
          </View>
        </View>
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$6" gap="$5">
          {children}
        </View>
      </View>
    </View>
  );
}
