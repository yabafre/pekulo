// packages/ui/src/primitives/PekuloDatePicker.native.tsx
import { Calendar as CalendarIcon } from "lucide-react-native";
import { useState } from "react";
import { Text, View, styled, useTheme } from "tamagui";
import { pekuloFontSizes, pekuloRadius } from "../tokens";
import { PekuloCalendar, type NativeDateRange } from "./PekuloCalendar.native";
import { PekuloDialog } from "./PekuloDialog";
import { PekuloDialogCloseX } from "./PekuloDialogCloseX.native";

export type DateRange = NativeDateRange;

const PickerTrigger = styled(View, {
  name: "PekuloDatePickerTrigger",
  role: "button",
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingHorizontal: 12,
  height: 32,
  backgroundColor: "$backgroundMuted",
  borderRadius: pekuloRadius.lg,
});

const dateFmtFR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function isValidDate(d?: Date): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function defaultFormatSingle(d?: Date, placeholder = "Choisir une date"): string {
  if (!isValidDate(d)) return placeholder;
  return dateFmtFR.format(d);
}

function defaultFormatRange(r?: DateRange, placeholder = "Choisir une plage"): string {
  if (!isValidDate(r?.from)) return placeholder;
  if (!isValidDate(r.to)) return dateFmtFR.format(r.from);
  return `${dateFmtFR.format(r.from)} → ${dateFmtFR.format(r.to)}`;
}

export interface PekuloDatePickerSingleProps {
  mode?: "single";
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder?: string;
  formatLabel?: (d?: Date) => string;
  width?: number | `${number}%` | "auto";
  disabled?: boolean;
  id?: string;
}

export interface PekuloDatePickerRangeProps {
  mode: "range";
  value: DateRange | undefined;
  onChange: (r: DateRange | undefined) => void;
  placeholder?: string;
  formatLabel?: (r?: DateRange) => string;
  width?: number | `${number}%` | "auto";
  disabled?: boolean;
  numberOfMonths?: number;
  id?: string;
}

export type PekuloDatePickerProps = PekuloDatePickerSingleProps | PekuloDatePickerRangeProps;

export function PekuloDatePicker(props: PekuloDatePickerProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const width = props.width ?? 280;

  const label =
    props.mode === "range"
      ? props.formatLabel
        ? props.formatLabel(props.value)
        : defaultFormatRange(props.value, props.placeholder)
      : props.formatLabel
        ? props.formatLabel(props.value)
        : defaultFormatSingle(props.value, props.placeholder);

  const handleOpenChange = (next: boolean) => {
    if (next && props.disabled) return;
    setOpen(next);
  };

  return (
    <PekuloDialog open={open} onOpenChange={handleOpenChange}>
      <PekuloDialog.Trigger asChild disabled={props.disabled}>
        <PickerTrigger
          disabled={props.disabled}
          aria-label="Sélectionner une date"
          aria-disabled={props.disabled}
          accessibilityState={{ disabled: Boolean(props.disabled) }}
          width={width}
          opacity={props.disabled ? 0.5 : 1}
        >
          <CalendarIcon size={14} color={theme.color.val} />
          <Text flex={1} color="$color" fontSize={pekuloFontSizes.bodySm} fontWeight="500">
            {label}
          </Text>
        </PickerTrigger>
      </PekuloDialog.Trigger>
      <PekuloDialog.Portal>
        <PekuloDialog.Overlay />
        <PekuloDialog.Content padding="$4">
          <PekuloDialogCloseX />
          <PekuloDialog.Title>Sélectionner une date</PekuloDialog.Title>
          {props.mode === "range" ? (
            <PekuloCalendar
              mode="range"
              selected={props.value}
              resetOnSelect
              disabled={props.disabled}
              onSelect={(r) => {
                props.onChange(r);
                if (isValidDate(r?.from) && isValidDate(r?.to)) {
                  setOpen(false);
                }
              }}
            />
          ) : (
            <PekuloCalendar
              mode="single"
              selected={props.value}
              disabled={props.disabled}
              onSelect={(d) => {
                props.onChange(d);
                setOpen(false);
              }}
            />
          )}
        </PekuloDialog.Content>
      </PekuloDialog.Portal>
    </PekuloDialog>
  );
}
