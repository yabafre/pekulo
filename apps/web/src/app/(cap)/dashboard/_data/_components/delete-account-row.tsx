"use client";

// apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-row.tsx
// Story 11-2 (FR-50 / AC-8). The second row of « Vos données ». Copy and
// shape come verbatim from the ux-preview SSOT
// (docs/ux-preview/src/App.tsx:1799-1809), which the 2026-05-17 lesson makes
// authoritative over story prose: label « Supprimer mon compte », sub
// « Cascade sur toutes les tables · irréversible », `destructive`, action
// `<Trash2 size={14} strokeWidth={2} aria-hidden /> Supprimer`.
//
// The icon lives INSIDE the <Text> so it inherits the row's colour through
// currentColor. As a sibling it inherits nothing: reset.css sets
// `a { color: inherit }`, nothing up the tree declares a colour, and lucide's
// stroke="currentColor" then resolves to the UA default black on the #0a0a0a
// card — about 1.03:1. Found in story 11-1's review on the export row; the
// same trap applies here.
//
// The dialog is not opened through PekuloDialog.Trigger (it lives in its own
// component, outside the dialog root), so focus is handed back here by hand
// when the dialog closes — otherwise a keyboard user lands on <body>.
import { useRef, useState, type ComponentRef } from "react";
import { Trash2 } from "lucide-react";
import { PekuloSettingRow } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { DeleteAccountConfirm } from "./delete-account-confirm";

export interface DeleteAccountRowProps {
  label: string;
  sub: string;
  action: string;
  /** The signed-in account's email — retyped in the dialog to confirm. */
  email: string;
}

// Identical values to PekuloDialogCloseX so the atomic classes already exist
// in the pre-generated Tamagui CSS (lesson 2026-05-24).
const FOCUS_RING = {
  outlineWidth: 2,
  outlineColor: "$color",
  outlineStyle: "solid",
  outlineOffset: 2,
} as const;

export function DeleteAccountRow({ label, sub, action, email }: DeleteAccountRowProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<ComponentRef<typeof View>>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // After the dialog unmounts its focus trap; the frame after is the first
    // moment the button is focusable again.
    if (!next) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <PekuloSettingRow
        label={label}
        sub={sub}
        destructive
        action={
          <View
            ref={triggerRef}
            render="button"
            onPress={() => setOpen(true)}
            // The visible word is « Supprimer ». Out of context — a
            // screen-reader controls rotor, or beside story 11-1's identically
            // shaped « Exporter » row directly above — that says nothing. The
            // full row label carries the meaning and contains the visible
            // text, so WCAG 2.5.3 (Label in Name) holds. Same reasoning as
            // export-data-row.tsx.
            aria-label={label}
            cursor="pointer"
            backgroundColor="transparent"
            borderWidth={0}
            padding={0}
            // 24 px minimum target (WCAG 2.5.8); the text alone is 15 px.
            style={{ minHeight: 24 }}
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.6 }}
            focusVisibleStyle={FOCUS_RING}
          >
            <Text
              display="flex"
              flexDirection="row"
              alignItems="center"
              gap="$2"
              color={"$danger" as never}
              fontSize="$caption"
            >
              <Trash2 size={14} strokeWidth={2} color="currentColor" aria-hidden />
              {action}
            </Text>
          </View>
        }
      />
      <DeleteAccountConfirm email={email} open={open} onOpenChange={handleOpenChange} />
    </>
  );
}
