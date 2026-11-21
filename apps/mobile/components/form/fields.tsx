// apps/mobile/components/form/fields.tsx
// Native form building blocks for the mobile sheets, following the iOS grouped
// form pattern: labelled text inputs, French decimal amount entry, the native
// compact date picker, an action-sheet-backed select and the native UISwitch.
// Values stay strings while typing; sheets parse them on save.

import { PekuloInput } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, Switch, type KeyboardTypeOptions } from "react-native";
import { useTheme } from "tamagui";

import { showActions } from "../../lib/actions";
import { useI18n } from "../../lib/i18n";

export function FormSection({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <View gap="$2">
      {title ? (
        <Text color="$colorSecondary" fontSize="$xs" letterSpacing={0.5} paddingHorizontal="$1">
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View
        backgroundColor="$backgroundCard"
        borderRadius="$xl"
        padding="$4"
        gap="$4"
        style={{ borderCurve: "continuous" }}
      >
        {children}
      </View>
      {footer ? (
        <Text color="$colorTertiary" fontSize="$xs" paddingHorizontal="$1">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Text color="$danger" fontSize="$xs" accessibilityRole="alert" selectable>
      {message}
    </Text>
  );
}

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  testID?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  maxLength?: number;
  suffix?: string;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  testID,
  keyboardType,
  autoCapitalize = "sentences",
  multiline,
  maxLength,
  suffix,
}: TextFieldProps) {
  return (
    <View gap="$2">
      <Text color="$colorSecondary" fontSize="$xs">
        {label}
      </Text>
      <View flexDirection="row" alignItems="center" gap="$2">
        <View flex={1}>
          <PekuloInput
            testID={testID}
            aria-label={label}
            value={value}
            placeholder={placeholder}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            multiline={multiline}
            maxLength={maxLength}
            invalid={Boolean(error)}
            onChange={(event) => onChange(event.target.value)}
          />
        </View>
        {suffix ? (
          <Text color="$colorTertiary" fontSize="$bodySm">
            {suffix}
          </Text>
        ) : null}
      </View>
      <FieldError message={error} />
    </View>
  );
}

/** Euro amount typed with the decimal pad; accepts `1 234,50`. */
export function AmountField(props: Omit<TextFieldProps, "keyboardType" | "autoCapitalize">) {
  return (
    <TextField
      placeholder="0"
      suffix="€"
      {...props}
      keyboardType="decimal-pad"
      autoCapitalize="none"
    />
  );
}

export function NumberField(
  props: Omit<TextFieldProps, "keyboardType" | "autoCapitalize"> & { decimal?: boolean },
) {
  const { decimal, ...rest } = props;
  return (
    <TextField
      {...rest}
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      autoCapitalize="none"
    />
  );
}

function RowShell({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string | null;
}) {
  return (
    <View gap="$1">
      <View
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        gap="$3"
        minHeight={44}
      >
        <Text color="$color" fontSize="$body" flexShrink={1}>
          {label}
        </Text>
        {children}
      </View>
      <FieldError message={error} />
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  maximumDate,
  testID,
}: {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  maximumDate?: Date;
  testID?: string;
}) {
  return (
    <RowShell label={label}>
      <DateTimePicker
        testID={testID}
        accessibilityLabel={label}
        value={value}
        mode="date"
        display="compact"
        locale="fr-FR"
        maximumDate={maximumDate}
        onChange={(_event, next) => {
          if (next) onChange(next);
        }}
      />
    </RowShell>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  testID,
  error,
  placeholder,
}: {
  label: string;
  value: T | "";
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  testID?: string;
  error?: string | null;
  placeholder?: string;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const emptyLabel = placeholder ?? t("common.fields.choose");
  const selected = options.find((o) => o.value === value);
  return (
    <RowShell label={label} error={error}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${selected?.label ?? emptyLabel}`}
        accessibilityHint={t("common.fields.chooseHint")}
        hitSlop={8}
        onPress={() =>
          showActions(
            label,
            options.map((option) => ({
              label: option.label,
              onPress: () => onChange(option.value),
            })),
          )
        }
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          minHeight: 44,
          opacity: pressed ? 0.6 : 1,
          flexShrink: 1,
        })}
      >
        <Text
          color={selected ? "$color" : "$colorTertiary"}
          fontSize="$body"
          numberOfLines={1}
          flexShrink={1}
        >
          {selected?.label ?? emptyLabel}
        </Text>
        <SymbolView
          name="chevron.up.chevron.down"
          size={13}
          tintColor={theme.colorTertiary.val}
          fallback={null}
        />
      </Pressable>
    </RowShell>
  );
}

export function SwitchField({
  label,
  value,
  onChange,
  testID,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <RowShell label={label}>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: theme.color.val, false: theme.backgroundMuted.val }}
      />
    </RowShell>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Text
      color="$danger"
      fontSize="$bodySm"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      selectable
      testID="form-error"
    >
      {message}
    </Text>
  );
}

/** iOS-style destructive cell: full-width, 44pt, red label on the card surface. */
export function DestructiveButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <View
        backgroundColor="$backgroundCard"
        borderRadius="$xl"
        minHeight={44}
        alignItems="center"
        justifyContent="center"
        style={{ borderCurve: "continuous" }}
      >
        <Text color="$danger" fontSize="$body" fontWeight="500">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
