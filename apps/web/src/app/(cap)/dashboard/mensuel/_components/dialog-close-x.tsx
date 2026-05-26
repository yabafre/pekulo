"use client";

// Top-right close affordance for every Mensuel PekuloDialog (5-5).
// Mirrors the immobilier version — promote to @pekulo/ui in a follow-up
// when a third consumer surfaces. ui-ux-pro-max rule `modal-escape`:
// every modal MUST offer a visible close path beyond the Escape key.

import { View } from "@pekulo/ui/client";
import { PekuloDialog, pekuloRadius } from "@pekulo/ui";
import { X } from "lucide-react";
import type { CSSProperties } from "react";

const closeBtnStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--colorTertiary)",
  width: 32,
  height: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: pekuloRadius.full,
};

export function DialogCloseX() {
  return (
    <View position="absolute" top="$3" right="$3" zIndex={1}>
      <PekuloDialog.Close asChild>
        <button type="button" aria-label="Fermer" style={closeBtnStyle}>
          <X size={18} aria-hidden={true} />
        </button>
      </PekuloDialog.Close>
    </View>
  );
}
