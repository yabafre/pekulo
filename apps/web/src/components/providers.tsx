// apps/web/src/components/providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ErrorInfo, type ReactNode } from "react";
import { PekuloErrorBoundary, PekuloRootProvider } from "@pekulo/ui";
import { useOfflinePersistence } from "@/lib/offline/use-offline-persistence";
import { OfflineBanner } from "@/components/offline-banner";
import "@/lib/zapaction/keys";

// V1 (a) personal-use phase — log to the console; epic 11 wires GlitchTip
// via OTel (NFR-26) and turns this into a real reporter.
function reportClientError(error: Error, info: ErrorInfo) {
  // eslint-disable-next-line no-console
  console.error("[pekulo] client error", error, info);
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  );
  // Story 9-2 (FR-54) — restores the encrypted snapshot into this client and
  // keeps persisting it. Imperative rather than <PersistQueryClientProvider>:
  // the userId arrives asynchronously from a Server Action, and gating the whole
  // tree on that round-trip would delay first paint for every online visit.
  useOfflinePersistence(queryClient);
  return (
    <PekuloRootProvider>
      <PekuloErrorBoundary onError={reportClientError} fullScreen>
        <QueryClientProvider client={queryClient}>
          {children}
          {/* Inside the provider — the banner reads the snapshot age from the
              query cache. */}
          <OfflineBanner />
        </QueryClientProvider>
      </PekuloErrorBoundary>
    </PekuloRootProvider>
  );
}
