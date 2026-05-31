"use client";

import { PekuloSelect } from "../../primitives";

export interface CategoryOption {
  value: string;
  label: string;
}

export interface CategoryPickerProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<CategoryOption>;
  id?: string;
  placeholder?: string;
}

// Story 6-4 — shared category select. Presentation-only: takes {value,label}
// options so @pekulo/ui stays free of @pekulo/validators (the consumer builds
// the options from TRANSACTION_CATEGORY_LABELS). Composes PekuloSelect, whose
// Trigger already renders a <button> (a11y, lesson 2026-05-06). Reused by 6-4's
// override flow and future batch-categorisation surfaces.
export function CategoryPicker({
  value,
  onValueChange,
  options,
  id,
  placeholder = "Catégorie",
}: CategoryPickerProps) {
  return (
    <PekuloSelect value={value} onValueChange={onValueChange}>
      {/* aria-label gives the combobox a discernible name (AC-6 / axe
          button-name) — the displayed value alone is empty until an option
          registers, so the trigger needs an explicit label. */}
      <PekuloSelect.Trigger id={id} aria-label={placeholder}>
        <PekuloSelect.Value placeholder={placeholder} />
      </PekuloSelect.Trigger>
      <PekuloSelect.Content>
        <PekuloSelect.Group>
          {options.map((opt, i) => (
            <PekuloSelect.Item key={opt.value} value={opt.value} index={i}>
              {opt.label}
            </PekuloSelect.Item>
          ))}
        </PekuloSelect.Group>
      </PekuloSelect.Content>
    </PekuloSelect>
  );
}
