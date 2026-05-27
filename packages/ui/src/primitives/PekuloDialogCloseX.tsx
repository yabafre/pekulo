"use client";

// Top-right close affordance for every PekuloDialog consumer (review F8 —
// promoted from local copies in apps/web/.../mensuel/_components and
// .../immobilier/_components which were byte-identical, satisfying the
// "third consumer" trigger the comments wished for). PekuloDialog ships
// `Close asChild` but does not render a default chevron — every modal
// needs a visible close path beyond the Escape key (ui-ux-pro-max rule
// `modal-escape`).
//
// Review F11 + F13 polish:
//  - hover + focus-visible affordances (sibling pattern from the
//    Historique kebab in mensuel) so keyboard users see a focus ring.
//  - explicit `color="var(--colorTertiary)"` on the lucide X so the
//    icon doesn't rely on CSS `currentColor` inheritance through the
//    button (fragile if a future style overrides the parent color).

import { View } from "tamagui";
import { X } from "lucide-react";
import { PekuloDialog } from "./PekuloDialog";

export function PekuloDialogCloseX() {
  return (
    <View position="absolute" top="$3" right="$3" zIndex={1}>
      <PekuloDialog.Close asChild>
        <View
          render="button"
          aria-label="Fermer"
          width={32}
          height={32}
          alignItems="center"
          justifyContent="center"
          borderRadius="$full"
          backgroundColor="transparent"
          borderWidth={0}
          cursor="pointer"
          hoverStyle={{ backgroundColor: "$backgroundMuted" }}
          focusVisibleStyle={{
            outlineWidth: 2,
            outlineColor: "$color",
            outlineStyle: "solid",
            outlineOffset: 2,
          }}
        >
          <X size={18} color="var(--colorTertiary)" aria-hidden={true} />
        </View>
      </PekuloDialog.Close>
    </View>
  );
}
