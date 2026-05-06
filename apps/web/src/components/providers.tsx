// apps/web/src/components/providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { PekuloRootProvider } from "@pekulo/ui";
import "@/lib/zapaction/keys";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <PekuloRootProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PekuloRootProvider>
  );
}
