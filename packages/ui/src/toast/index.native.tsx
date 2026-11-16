// packages/ui/src/toast/index.native.tsx
// React Native toast provider, hook, and viewport (uses position="absolute"
// instead of web CSS position="fixed").

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

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
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      setEntries((prev) => prev.filter((x) => x.id !== id));
    }, entry.durationMs);
    timersRef.current.add(timer);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show, entries }), [show, entries]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useToast must be used inside <ToastProvider> (mounted by PekuloRootProvider).",
    );
  }
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
      role="alert"
      accessibilityLiveRegion="polite"
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
  if (!ctx || ctx.entries.length === 0) return null;
  return (
    <View
      position="absolute"
      bottom="$6"
      left="$4"
      right="$4"
      flexDirection="column"
      gap="$2"
      zIndex={1000}
      pointerEvents="box-none"
    >
      {ctx.entries.map((e) => (
        <PekuloToast key={e.id} entry={e} />
      ))}
    </View>
  );
}
