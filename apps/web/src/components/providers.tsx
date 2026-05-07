// apps/web/src/components/providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ErrorInfo, type ReactNode } from "react";
import { PekuloErrorBoundary, PekuloRootProvider } from "@pekulo/ui";
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
  return (
    <PekuloRootProvider>
      <PekuloErrorBoundary onError={reportClientError}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </PekuloErrorBoundary>
    </PekuloRootProvider>
  );
}
