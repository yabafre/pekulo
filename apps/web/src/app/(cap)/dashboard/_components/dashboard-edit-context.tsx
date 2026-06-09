"use client";
// apps/web/src/app/(cap)/dashboard/_components/dashboard-edit-context.tsx
// Story 7-2 (D1) — one boolean shared between the shell's "Personnaliser"
// toggle and the widget grid (under CapView, the shell's children). Lifted to
// context so the button and the grid don't have to coordinate through search
// params for a single flag. Outside the provider it degrades to a no-op so a
// widget rendered standalone (tests, off-shell) never throws.
import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

interface DashboardEditValue {
  editing: boolean;
  setEditing: Dispatch<SetStateAction<boolean>>;
}

const DashboardEditContext = createContext<DashboardEditValue | null>(null);

const NOOP_EDIT: DashboardEditValue = { editing: false, setEditing: () => {} };

export function DashboardEditProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  return (
    <DashboardEditContext.Provider value={{ editing, setEditing }}>
      {children}
    </DashboardEditContext.Provider>
  );
}

export function useDashboardEdit(): DashboardEditValue {
  return useContext(DashboardEditContext) ?? NOOP_EDIT;
}
