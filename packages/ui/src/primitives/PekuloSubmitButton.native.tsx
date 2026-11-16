// packages/ui/src/primitives/PekuloSubmitButton.native.tsx
import type { ReactNode } from "react";
import { pekuloRadius } from "../tokens";
import {
  PekuloButton,
  type PekuloButtonProps,
  type PekuloButtonVariant,
} from "./PekuloButton.native";

export interface PekuloSubmitButtonProps extends Omit<PekuloButtonProps, "variant" | "size"> {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: ReactNode;
  variant?: "primary" | "danger";
  fullWidth?: boolean;
  type?: "submit" | "button" | "reset";
}

const VARIANT_MAP: Record<NonNullable<PekuloSubmitButtonProps["variant"]>, PekuloButtonVariant> = {
  primary: "default",
  danger: "destructive",
};

export function PekuloSubmitButton({
  children,
  loading = false,
  loadingLabel,
  variant = "primary",
  fullWidth = true,
  type = "submit",
  style,
  ...props
}: PekuloSubmitButtonProps) {
  return (
    <PekuloButton
      variant={VARIANT_MAP[variant]}
      size="lg"
      type={type}
      loading={loading}
      loadingLabel={loadingLabel}
      style={{
        height: 44,
        alignSelf: fullWidth ? "stretch" : "flex-start",
        width: fullWidth ? "100%" : undefined,
        borderRadius: pekuloRadius.full,
        ...style,
      }}
      {...props}
    >
      {children}
    </PekuloButton>
  );
}
