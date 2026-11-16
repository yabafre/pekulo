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

function defaultFormatSingle(d?: Date): string {
  if (!d) return "Choisir une date";
  return dateFmtFR.format(d);
}

function defaultFormatRange(r?: DateRange): string {
  if (!r?.from) return "Choisir une plage";
  if (!r.to) return dateFmtFR.format(r.from);
  return `${dateFmtFR.format(r.from)} → ${dateFmtFR.format(r.to)}`;
}

export interface PekuloDatePickerSingleProps {
  mode?: "single";
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder?: string;
  formatLabel?: (d?: Date) => string;
  width?: number | `${number}%`;
  disabled?: boolean;
  id?: string;
}

export interface PekuloDatePickerRangeProps {
  mode: "range";
  value: DateRange | undefined;
  onChange: (r: DateRange | undefined) => void;
  placeholder?: string;
  formatLabel?: (r?: DateRange) => string;
  width?: number | `${number}%`;
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
      ? (props.formatLabel ?? defaultFormatRange)(props.value)
      : (props.formatLabel ?? defaultFormatSingle)(props.value);

  return (
    <PekuloDialog open={open} onOpenChange={setOpen}>
      <PekuloDialog.Trigger asChild>
        <PickerTrigger
          aria-label="Sélectionner une date"
          aria-disabled={props.disabled}
          onPress={() => {
            if (!props.disabled) setOpen(true);
          }}
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
              onSelect={(r) => {
                props.onChange(r);
                if (r?.from && r?.to) {
                  setOpen(false);
                }
              }}
            />
          ) : (
            <PekuloCalendar
              mode="single"
              selected={props.value}
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
