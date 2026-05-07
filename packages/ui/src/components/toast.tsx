// packages/ui/src/components/toast.tsx
// Lightweight toast hook + viewport. No external dep.
"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Text, View } from "tamagui";

export type ToastIntent = "success" | "info" | "warning" | "danger";

export interface ToastEntry {
  id: number;
  title: string;
  description?: string;
  intent: ToastIntent;
  durationMs: number;
}

interface ToastContextValue {
  show: (e: Omit<ToastEntry, "id" | "durationMs"> & { durationMs?: number }) => void;
  entries: ToastEntry[];
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);

  const show = useCallback<ToastContextValue["show"]>((e) => {
    const id = ++toastSeq;
    const entry: ToastEntry = {
      id,
      intent: e.intent,
      title: e.title,
      description: e.description,
      durationMs: e.durationMs ?? 4000,
    };
    setEntries((prev) => [...prev, entry]);
    const t = setTimeout(() => {
      setEntries((prev) => prev.filter((x) => x.id !== id));
    }, entry.durationMs);
    return () => clearTimeout(t);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show, entries }), [show, entries]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx)
    throw new Error(
      "useToast must be used inside <ToastProvider> (mounted by PekuloRootProvider).",
    );
  const { show } = ctx;
  return useMemo(
    () => ({
      success: (title: string, description?: string, durationMs?: number) =>
        show({ intent: "success", title, description, durationMs }),
      info: (title: string, description?: string, durationMs?: number) =>
        show({ intent: "info", title, description, durationMs }),
      warning: (title: string, description?: string, durationMs?: number) =>
        show({ intent: "warning", title, description, durationMs }),
      danger: (title: string, description?: string, durationMs?: number) =>
        show({ intent: "danger", title, description, durationMs }),
    }),
    [show],
  );
}

function intentColor(intent: ToastIntent): string {
  return intent === "success"
    ? "$success"
    : intent === "danger"
      ? "$danger"
      : intent === "warning"
        ? "$warning"
        : "$info";
}

export function PekuloToast({ entry }: { entry: ToastEntry }) {
  return (
    <View
      backgroundColor="$backgroundElevated"
      borderRadius="$lg"
      padding="$3"
      minWidth={280}
      role="status"
      aria-live="polite"
    >
      <View flexDirection="row" alignItems="flex-start" gap="$2">
        <View
          width={6}
          height={6}
          borderRadius="$full"
          marginTop={6}
          backgroundColor={intentColor(entry.intent) as never}
        />
        <View flex={1}>
          <Text color="$color" fontSize="$caption" fontWeight="600">
            {entry.title}
          </Text>
          {entry.description && (
            <Text color="$colorSecondary" fontSize="$xs" marginTop={2}>
              {entry.description}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export function PekuloToastViewport() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  return (
    <View position="fixed" bottom="$4" right="$4" flexDirection="column" gap="$2" zIndex={1000}>
      {ctx.entries.map((e) => (
        <PekuloToast key={e.id} entry={e} />
      ))}
    </View>
  );
}
