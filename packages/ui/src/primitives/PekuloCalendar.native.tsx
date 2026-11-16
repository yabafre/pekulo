// packages/ui/src/primitives/PekuloCalendar.native.tsx
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform } from "react-native";
import { Text, View, styled } from "tamagui";
import { useThemeSetting } from "../provider/index.native";
import { pekuloRadius, pekuloSpacing } from "../tokens";

const EdgeButton = styled(View, {
  name: "PekuloCalendarEdgeButton",
  role: "button",
  flex: 1,
  paddingVertical: "$2",
  borderRadius: "$md",
  alignItems: "center",
});

export interface NativeDateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

export interface PekuloCalendarSingleProps {
  mode?: "single";
  selected?: Date;
  onSelect?: (d: Date | undefined) => void;
  month?: Date;
  disabled?: boolean;
}

export interface PekuloCalendarRangeProps {
  mode: "range";
  selected?: NativeDateRange;
  onSelect?: (r: NativeDateRange | undefined) => void;
  month?: Date;
  disabled?: boolean;
  min?: number;
  resetOnSelect?: boolean;
  numberOfMonths?: number;
}

export type PekuloCalendarProps = PekuloCalendarSingleProps | PekuloCalendarRangeProps;

export function PekuloCalendar(props: PekuloCalendarProps) {
  const { resolvedTheme } = useThemeSetting();
  const themeVariant = resolvedTheme === "pekulo-light" ? "light" : "dark";
  const [activeEdge, setActiveEdge] = useState<"from" | "to">("from");

  if (props.mode === "range") {
    const fromDate = props.selected?.from ?? props.month ?? new Date();
    const toDate = props.selected?.to ?? fromDate;
    const activeValue = activeEdge === "from" ? fromDate : toDate;

    const handleRangeChange = (_event: DateTimePickerEvent, date?: Date) => {
      if (!date) return;
      if (activeEdge === "from") {
        const currentTo = props.selected?.to;
        const nextRange: NativeDateRange =
          currentTo && date > currentTo
            ? { from: date, to: undefined }
            : { from: date, to: currentTo };
        props.onSelect?.(nextRange);
        setActiveEdge("to");
      } else {
        const currentFrom = props.selected?.from ?? date;
        const nextRange: NativeDateRange =
          date < currentFrom ? { from: date, to: currentFrom } : { from: currentFrom, to: date };
        props.onSelect?.(nextRange);
      }
    };

    return (
      <View
        backgroundColor="$backgroundCard"
        borderRadius={pekuloRadius.lg}
        padding={pekuloSpacing[3]}
        gap="$3"
      >
        <View flexDirection="row" gap="$2">
          <EdgeButton
            backgroundColor={activeEdge === "from" ? "$color" : "$backgroundMuted"}
            onPress={() => setActiveEdge("from")}
          >
            <Text
              fontSize="$caption"
              fontWeight="500"
              color={activeEdge === "from" ? "$colorOnAccent" : "$color"}
            >
              Début
            </Text>
          </EdgeButton>
          <EdgeButton
            backgroundColor={activeEdge === "to" ? "$color" : "$backgroundMuted"}
            onPress={() => setActiveEdge("to")}
          >
            <Text
              fontSize="$caption"
              fontWeight="500"
              color={activeEdge === "to" ? "$colorOnAccent" : "$color"}
            >
              Fin
            </Text>
          </EdgeButton>
        </View>
        <View pointerEvents={props.disabled ? "none" : "auto"} opacity={props.disabled ? 0.5 : 1}>
          <DateTimePicker
            value={activeValue}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            locale="fr-FR"
            themeVariant={themeVariant}
            onChange={handleRangeChange}
          />
        </View>
      </View>
    );
  }

  const singleValue = props.selected ?? props.month ?? new Date();

  return (
    <View
      backgroundColor="$backgroundCard"
      borderRadius={pekuloRadius.lg}
      padding={pekuloSpacing[3]}
      pointerEvents={props.disabled ? "none" : "auto"}
      opacity={props.disabled ? 0.5 : 1}
    >
      <DateTimePicker
        value={singleValue}
        mode="date"
        display={Platform.OS === "ios" ? "inline" : "default"}
        locale="fr-FR"
        themeVariant={themeVariant}
        onChange={(_event: DateTimePickerEvent, date?: Date) => {
          if (date) props.onSelect?.(date);
        }}
      />
    </View>
  );
}
