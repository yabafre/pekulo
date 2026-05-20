"use client";

// TanStack Form scaffold per architecture.md Phase 3 — Communication Patterns
// "TanStack Form orchestrator pattern" is the canonical form layer for the
// CSV-import + multi-step flows landing in Epic 5+. The hook contexts are
// created once at app boot ; per-feature forms compose `useAppForm` with
// their own field/form components.
//
// Removed in PR #86 audit then restored — the hook is a forward-pointer
// scaffold owned by the architecture, not orphan dead code. Re-deletion
// without an ADR amendment is a review fail.

import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {},
  formComponents: {},
});
