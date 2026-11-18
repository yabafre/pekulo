// packages/ui/src/primitives/PekuloCalendar.native.tsx
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { Text, View, styled } from "tamagui";
import { useThemeSetting } from "../provider/index.native";
import { pekuloRadius, pekuloSpacing } from "../tokens";

const EdgeButton = styled(View, {
  name: "PekuloCalendarEdgeButton",
  role: "button",
  flex: 1,
  flexBasis: 0,
  minWidth: 0,
  paddingVertical: "$2",
  borderRadius: "$md",
  alignItems: "center",
});

const AndroidPickerTrigger = styled(View, {
  name: "PekuloCalendarAndroidTrigger",
  role: "button",
  paddingVertical: "$3",
  paddingHorizontal: "$3",
  borderRadius: "$md",
  backgroundColor: "$backgroundMuted",
  alignItems: "center",
});

const dateFmtFR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function isValidDate(d?: Date): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function safeDate(primary?: Date, fallback?: Date): Date {
  if (isValidDate(primary)) return primary;
  if (isValidDate(fallback)) return fallback;
  return new Date();
}

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

  const isRange = props.mode === "range";
  const rangeSelected = isRange ? props.selected : undefined;
  const rangeResetOnSelect = isRange ? Boolean(props.resetOnSelect) : false;
  const rangeOnSelect = isRange ? props.onSelect : undefined;
  const singleOnSelect = !isRange ? props.onSelect : undefined;

  const commitDate = useCallback(
    (_event: DateTimePickerChangeEvent, date: Date) => {
      if (props.disabled || !isValidDate(date)) return;
      if (isRange) {
        if (activeEdge === "from") {
          const currentTo = isValidDate(rangeSelected?.to) ? rangeSelected.to : undefined;
          const shouldReset =
            rangeResetOnSelect && isValidDate(rangeSelected?.from) && currentTo !== undefined;
          const nextRange: NativeDateRange =
            shouldReset || (currentTo && date > currentTo)
              ? { from: date, to: undefined }
              : { from: date, to: currentTo };
          rangeOnSelect?.(nextRange);
          setActiveEdge("to");
        } else {
          const currentFrom = isValidDate(rangeSelected?.from) ? rangeSelected.from : date;
          const nextRange: NativeDateRange =
            date < currentFrom ? { from: date, to: currentFrom } : { from: currentFrom, to: date };
          rangeOnSelect?.(nextRange);
        }
      } else {
        singleOnSelect?.(date);
      }
    },
    [
      activeEdge,
      isRange,
      props.disabled,
      rangeOnSelect,
      rangeResetOnSelect,
      rangeSelected,
      singleOnSelect,
    ],
  );

  const openAndroidDialog = useCallback(
    (value: Date) => {
      if (props.disabled) return;
      DateTimePickerAndroid.open({
        value,
        mode: "date",
        onValueChange: commitDate,
        onDismiss: () => {},
      });
    },
    [commitDate, props.disabled],
  );

  if (props.mode === "range") {
    const fromDate = safeDate(props.selected?.from, props.month);
    const toDate = safeDate(props.selected?.to, fromDate);
    const activeValue = activeEdge === "from" ? fromDate : toDate;

    return (
      <View
        backgroundColor="$backgroundCard"
        borderRadius={pekuloRadius.lg}
        padding={pekuloSpacing[3]}
        gap="$3"
      >
        <View flexDirection="row" gap="$2">
          <EdgeButton
            disabled={props.disabled}
            backgroundColor={activeEdge === "from" ? "$color" : "$backgroundMuted"}
            onPress={() => {
              if (!props.disabled) setActiveEdge("from");
            }}
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
            disabled={props.disabled}
            backgroundColor={activeEdge === "to" ? "$color" : "$backgroundMuted"}
            onPress={() => {
              if (!props.disabled) setActiveEdge("to");
            }}
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
        {Platform.OS === "android" ? (
          <AndroidPickerTrigger
            testID="native-android-date-trigger"
            disabled={props.disabled}
            opacity={props.disabled ? 0.5 : 1}
            onPress={() => openAndroidDialog(activeValue)}
          >
            <Text fontSize="$bodySm" color="$color" fontWeight="500">
              {dateFmtFR.format(activeValue)}
            </Text>
          </AndroidPickerTrigger>
        ) : (
          <View pointerEvents={props.disabled ? "none" : "auto"} opacity={props.disabled ? 0.5 : 1}>
            <DateTimePicker
              value={activeValue}
              mode="date"
              display="inline"
              locale="fr-FR"
              themeVariant={themeVariant}
              disabled={props.disabled}
              onValueChange={commitDate}
              onDismiss={() => {}}
            />
          </View>
        )}
      </View>
    );
  }

  const singleValue = safeDate(props.selected, props.month);

  return (
    <View
      backgroundColor="$backgroundCard"
      borderRadius={pekuloRadius.lg}
      padding={pekuloSpacing[3]}
      pointerEvents={props.disabled ? "none" : "auto"}
      opacity={props.disabled ? 0.5 : 1}
    >
      {Platform.OS === "android" ? (
        <AndroidPickerTrigger
          testID="native-android-date-trigger"
          disabled={props.disabled}
          onPress={() => openAndroidDialog(singleValue)}
        >
          <Text fontSize="$bodySm" color="$color" fontWeight="500">
            {dateFmtFR.format(singleValue)}
          </Text>
        </AndroidPickerTrigger>
      ) : (
        <DateTimePicker
          value={singleValue}
          mode="date"
          display="inline"
          locale="fr-FR"
          themeVariant={themeVariant}
          disabled={props.disabled}
          onValueChange={commitDate}
          onDismiss={() => {}}
        />
      )}
    </View>
  );
}
