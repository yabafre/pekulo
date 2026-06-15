"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { signOut } from "@/app/(auth)/_actions/auth-actions";

export function SignOutButton() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await signOut();
      if (!result.ok) {
        toast.danger("Déconnexion", result.message);
        return;
      }
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      render="button"
      onPress={handleSignOut}
      aria-label="Se déconnecter"
      cursor="pointer"
      alignSelf="flex-start"
      flexDirection="row"
      alignItems="center"
      gap="$2"
      backgroundColor="$backgroundMuted"
      borderRadius="$full"
      borderWidth={0}
      paddingHorizontal="$4"
      paddingVertical={10}
      pressStyle={{ scale: 0.98 }}
    >
      {loading && <Loader2 size={16} color="var(--color)" />}
      <Text color="$color" fontSize="$bodySm" fontWeight="600">
        Se déconnecter
      </Text>
    </View>
  );
}
