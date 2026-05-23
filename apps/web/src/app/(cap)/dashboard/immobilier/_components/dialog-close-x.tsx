"use client";

import { View } from "@pekulo/ui/client";
import { PekuloDialog, pekuloRadius } from "@pekulo/ui";
import { X } from "lucide-react";
import type { CSSProperties } from "react";

// Top-right close affordance for every Immobilier PekuloDialog. The DS
// primitive ships PekuloDialog.Close (an asChild slot) but does not render
// a default chevron — each consumer must wire its own visible affordance.
// Bug fix (post-T23 review): users had no visible way to close the
// attach/update/valuation/history dialogs apart from the Escape key.

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
