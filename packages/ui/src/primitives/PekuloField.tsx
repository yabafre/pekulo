"use client";

// PekuloField family — framework-agnostic semantic wrappers for form rows.
// Mirrors shadcn-ui's `Field`/`FieldSet`/`FieldGroup`/`FieldLabel`/
// `FieldDescription`/`FieldError`/`FieldLegend`/`FieldTitle`/
// `FieldSeparator`/`FieldContent` API surface but rendered through Tamagui
// primitives + Pekulo tokens so the TR-strict palette + RSC-safe injection
// are preserved.
//
// Composition contract (mirrors shadcn):
//
//   PekuloFieldSet
//   ├── PekuloFieldLegend
//   ├── PekuloFieldDescription
//   └── PekuloFieldGroup
//       ├── PekuloField
//       │   ├── PekuloFieldLabel
//       │   ├── (PekuloInput / PekuloTextarea / PekuloNativeSelect / ...)
//       │   ├── PekuloFieldDescription (optional)
//       │   └── PekuloFieldError (optional — accepts TanStack Form errors[])
//       └── PekuloField
//           ├── (PekuloInput)
//           └── PekuloFieldDescription
//
// Integration:
//   - TanStack Form — wrap each PekuloField with `<form.Field name="x">`
//     and pass `field.state.value` / `field.handleChange` to the input.
//     Pass `field.state.meta.errors` directly to PekuloFieldError.
//   - zapaction envelope errors — render `<PekuloFieldError>` outside any
//     field block, passing the human message as children.

import { Text, View, type ViewProps } from "tamagui";
import { useMemo, type ComponentProps, type ReactNode } from "react";

// ─── FieldSet ────────────────────────────────────────────────────────────

export interface PekuloFieldSetProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloFieldSet({ children, ...props }: PekuloFieldSetProps) {
  return (
    <View
      render="fieldset"
      data-slot="field-set"
      flexDirection="column"
      gap="$4"
      borderWidth={0}
      padding={0}
      margin={0}
      {...props}
    >
      {children}
    </View>
  );
}

// ─── FieldLegend ─────────────────────────────────────────────────────────

export interface PekuloFieldLegendProps extends ComponentProps<typeof Text> {
  variant?: "legend" | "label";
}

export function PekuloFieldLegend({ variant = "legend", ...props }: PekuloFieldLegendProps) {
  return (
    <Text
      render="legend"
      data-slot="field-legend"
      data-variant={variant}
      color="$color"
      fontWeight="500"
      fontSize={variant === "label" ? "$bodySm" : "$body"}
      marginBottom="$2"
      {...props}
    />
  );
}

// ─── FieldGroup ──────────────────────────────────────────────────────────

export interface PekuloFieldGroupProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloFieldGroup({ children, ...props }: PekuloFieldGroupProps) {
  return (
    <View data-slot="field-group" flexDirection="column" gap="$4" width="100%" {...props}>
      {children}
    </View>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────

export type PekuloFieldOrientation = "vertical" | "horizontal" | "responsive";

export interface PekuloFieldProps extends Omit<ViewProps, "children"> {
  orientation?: PekuloFieldOrientation;
  invalid?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

export function PekuloField({
  orientation = "vertical",
  invalid = false,
  disabled = false,
  children,
  ...props
}: PekuloFieldProps) {
  const isHorizontal = orientation === "horizontal";
  const isResponsive = orientation === "responsive";
  return (
    <View
      role="group"
      data-slot="field"
      data-orientation={orientation}
      data-invalid={invalid ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
      flexDirection={isHorizontal ? "row" : "column"}
      alignItems={isHorizontal ? "center" : undefined}
      gap="$2"
      width="100%"
      opacity={disabled ? 0.6 : 1}
      {...(isResponsive
        ? {
            $lg: { flexDirection: "row", alignItems: "center" },
          }
        : {})}
      {...props}
    >
      {children}
    </View>
  );
}

// ─── FieldContent ────────────────────────────────────────────────────────

export interface PekuloFieldContentProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloFieldContent({ children, ...props }: PekuloFieldContentProps) {
  // No `flex: 1` by default — in a vertical Field, flex-grow makes the
  // content area try to fill the column height and the natural-height
  // children overflow visually outside the parent (reported on
  // /dev/primitives showcase). Consumers needing the horizontal
  // "fill remaining space" behaviour can pass `flex={1}` explicitly.
  return (
    <View data-slot="field-content" flexDirection="column" gap="$1" width="100%" {...props}>
      {children}
    </View>
  );
}

// ─── FieldLabel ──────────────────────────────────────────────────────────

export interface PekuloFieldLabelProps extends ComponentProps<typeof Text> {
  htmlFor: string;
}

export function PekuloFieldLabel({ htmlFor, ...props }: PekuloFieldLabelProps) {
  return (
    <Text
      render="label"
      htmlFor={htmlFor}
      data-slot="field-label"
      color="$colorSecondary"
      fontSize="$caption"
      fontWeight="500"
      letterSpacing={0.3}
      {...props}
    />
  );
}

// ─── FieldTitle ──────────────────────────────────────────────────────────

export interface PekuloFieldTitleProps extends ComponentProps<typeof Text> {}

export function PekuloFieldTitle(props: PekuloFieldTitleProps) {
  return (
    <Text data-slot="field-title" color="$color" fontSize="$bodySm" fontWeight="500" {...props} />
  );
}

// ─── FieldDescription ────────────────────────────────────────────────────

export interface PekuloFieldDescriptionProps extends ComponentProps<typeof Text> {}

export function PekuloFieldDescription(props: PekuloFieldDescriptionProps) {
  return (
    <Text
      render="p"
      data-slot="field-description"
      color="$colorTertiary"
      fontSize="$caption"
      {...props}
    />
  );
}

// ─── FieldSeparator ──────────────────────────────────────────────────────

export interface PekuloFieldSeparatorProps extends Omit<ViewProps, "children"> {
  /** Centered label rendered over the separator line. */
  children?: ReactNode;
}

export function PekuloFieldSeparator({ children, ...props }: PekuloFieldSeparatorProps) {
  return (
    <View
      data-slot="field-separator"
      data-content={children ? "true" : "false"}
      position="relative"
      height={20}
      marginVertical="$2"
      {...props}
    >
      <View
        position="absolute"
        top="50%"
        left={0}
        right={0}
        height={1}
        backgroundColor="$borderDefault"
      />
      {children && (
        <View
          alignSelf="center"
          paddingHorizontal="$2"
          backgroundColor="$background"
          position="relative"
        >
          <Text color="$colorTertiary" fontSize="$caption">
            {children}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── FieldError ──────────────────────────────────────────────────────────

export interface PekuloFieldErrorProps extends Omit<ViewProps, "children"> {
  /**
   * Manual error content (e.g. a zapaction envelope's FR-localised message).
   * Overrides `errors` when both are provided.
   */
  children?: ReactNode;
  /**
   * TanStack Form `field.state.meta.errors` — array of error objects with
   * `.message` strings. Duplicates are deduped. When the list has > 1 item,
   * it renders as a bulleted `<ul>`; single items render as plain text.
   */
  errors?: Array<{ message?: string } | string | undefined>;
}

export function PekuloFieldError({ children, errors, ...props }: PekuloFieldErrorProps) {
  const content = useMemo<ReactNode>(() => {
    if (children !== undefined && children !== null && children !== false) {
      return children;
    }
    if (!errors || errors.length === 0) {
      return null;
    }
    const messages = errors
      .map((e) => (typeof e === "string" ? e : (e?.message ?? "")))
      .filter((m): m is string => m.length > 0);
    const unique = Array.from(new Set(messages));
    if (unique.length === 0) {
      return null;
    }
    if (unique.length === 1) {
      return unique[0];
    }
    return (
      <View render="ul" flexDirection="column" gap="$1" paddingLeft="$4" margin={0}>
        {unique.map((m) => (
          <Text render="li" key={m} color="$danger" fontSize="$caption">
            {m}
          </Text>
        ))}
      </View>
    );
  }, [children, errors]);

  if (content === null) {
    return null;
  }
  return (
    <View role="alert" data-slot="field-error" {...props}>
      {typeof content === "string" ? (
        <Text color="$danger" fontSize="$caption">
          {content}
        </Text>
      ) : (
        content
      )}
    </View>
  );
}
