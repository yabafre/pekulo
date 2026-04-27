"use client"

import * as React from "react"
import { useStore } from "@tanstack/react-form"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useFieldContext } from "@/hooks/form-hook"

type FieldItemContextValue = { id: string }
const FieldItemContext = React.createContext<FieldItemContextValue | null>(null)

function useFieldItem(): FieldItemContextValue {
  const ctx = React.useContext(FieldItemContext)
  if (!ctx) throw new Error("Field* components must be used inside <Field>")
  return ctx
}

export function Form({ className, ...props }: React.ComponentProps<"form">) {
  return <form className={cn("space-y-4", className)} {...props} />
}

export function Field({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId()
  return (
    <FieldItemContext.Provider value={{ id }}>
      <div className={cn("space-y-1.5", className)} {...props} />
    </FieldItemContext.Provider>
  )
}

export function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { id } = useFieldItem()
  const field = useFieldContext()
  const hasError = (field.state.meta.errors?.length ?? 0) > 0
  return (
    <Label
      htmlFor={id}
      data-error={hasError || undefined}
      className={cn("text-xs data-[error]:text-destructive", className)}
      {...props}
    />
  )
}

export function FieldControl({ children }: { children: React.ReactElement }) {
  const { id } = useFieldItem()
  const field = useFieldContext()
  const hasError = (field.state.meta.errors?.length ?? 0) > 0
  return React.cloneElement(
    children as React.ReactElement<Record<string, unknown>>,
    {
      id,
      "aria-invalid": hasError || undefined,
      "aria-describedby": hasError ? `${id}-error` : `${id}-description`,
    }
  )
}

export function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { id } = useFieldItem()
  return (
    <p
      id={`${id}-description`}
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export function FieldError({ className, ...props }: React.ComponentProps<"p">) {
  const { id } = useFieldItem()
  const field = useFieldContext()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const first = errors?.[0]
  if (!first) return null
  const text =
    typeof first === "string"
      ? first
      : (first as { message?: string })?.message ?? String(first)
  return (
    <p
      id={`${id}-error`}
      className={cn("text-xs text-destructive", className)}
      {...props}
    >
      {text}
    </p>
  )
}
