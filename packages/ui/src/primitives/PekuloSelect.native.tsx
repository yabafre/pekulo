// packages/ui/src/primitives/PekuloSelect.native.tsx
import {
  Select as TamaSelect,
  SelectSeparator as TamaSelectSeparator,
  type SelectProps,
} from "@tamagui/select";
import { Sheet as TamaSheet } from "@tamagui/sheet";
import { Check, ChevronDown, ChevronUp } from "lucide-react-native";
import type { ComponentProps, ReactNode } from "react";
import { useTheme } from "tamagui";

function Root<Value extends string = string>(props: SelectProps<Value>) {
  return (
    <TamaSelect {...props}>
      {props.children}
      <TamaSelect.Adapt when="max-md" platform="touch">
        <TamaSheet modal dismissOnSnapToBottom snapPointsMode="fit">
          <TamaSheet.Frame backgroundColor="$backgroundElevated" padding="$3">
            <TamaSheet.ScrollView>
              <TamaSelect.Adapt.Contents />
            </TamaSheet.ScrollView>
          </TamaSheet.Frame>
          <TamaSheet.Overlay backgroundColor="$backgroundOverlay" />
        </TamaSheet>
      </TamaSelect.Adapt>
    </TamaSelect>
  );
}

function Group({
  children,
  ...props
}: ComponentProps<typeof TamaSelect.Group> & { children: ReactNode }) {
  return (
    <TamaSelect.Group padding="$1" {...props}>
      {children}
    </TamaSelect.Group>
  );
}

const Value = TamaSelect.Value;

function Trigger({
  children,
  controlSize = "md",
  ...props
}: ComponentProps<typeof TamaSelect.Trigger> & {
  children: ReactNode;
  controlSize?: "sm" | "md";
}) {
  const theme = useTheme();
  return (
    <TamaSelect.Trigger
      backgroundColor="$backgroundMuted"
      borderRadius="$lg"
      borderWidth={0}
      paddingHorizontal="$3"
      height={controlSize === "sm" ? 32 : 40}
      gap="$2"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      width="100%"
      {...props}
    >
      {children}
      <TamaSelect.Icon>
        <ChevronDown size={16} color={theme.colorTertiary.val} />
      </TamaSelect.Icon>
    </TamaSelect.Trigger>
  );
}

function Content({
  children,
  ...props
}: ComponentProps<typeof TamaSelect.Content> & { children: ReactNode }) {
  const theme = useTheme();
  return (
    <TamaSelect.Content {...props}>
      <TamaSelect.ScrollUpButton
        alignItems="center"
        justifyContent="center"
        width="100%"
        height="$3"
        backgroundColor="$backgroundElevated"
      >
        <ChevronUp size={14} color={theme.colorTertiary.val} />
      </TamaSelect.ScrollUpButton>
      <TamaSelect.Viewport
        backgroundColor="$backgroundElevated"
        borderRadius="$lg"
        padding="$1"
        minWidth={200}
      >
        {children}
      </TamaSelect.Viewport>
      <TamaSelect.ScrollDownButton
        alignItems="center"
        justifyContent="center"
        width="100%"
        height="$3"
        backgroundColor="$backgroundElevated"
      >
        <ChevronDown size={14} color={theme.colorTertiary.val} />
      </TamaSelect.ScrollDownButton>
    </TamaSelect.Content>
  );
}

function Label(props: ComponentProps<typeof TamaSelect.Label>) {
  return (
    <TamaSelect.Label
      color="$colorTertiary"
      fontSize="$xs"
      fontWeight="500"
      letterSpacing={0.4}
      textTransform="uppercase"
      paddingHorizontal="$2"
      paddingVertical="$1"
      {...props}
    />
  );
}

function Item({
  children,
  icon,
  ...props
}: ComponentProps<typeof TamaSelect.Item> & { children: ReactNode; icon?: ReactNode }) {
  const theme = useTheme();
  return (
    <TamaSelect.Item
      paddingHorizontal="$2"
      paddingVertical="$2"
      paddingRight={28}
      borderRadius="$md"
      flexDirection="row"
      alignItems="center"
      gap="$2"
      {...props}
    >
      {icon}
      <TamaSelect.ItemText color="$color" fontSize="$bodySm">
        {children}
      </TamaSelect.ItemText>
      <TamaSelect.ItemIndicator marginLeft="auto">
        <Check size={14} color={theme.color.val} />
      </TamaSelect.ItemIndicator>
    </TamaSelect.Item>
  );
}

function Separator(props: ComponentProps<typeof TamaSelectSeparator>) {
  return (
    <TamaSelectSeparator
      height={1}
      backgroundColor="$borderDefault"
      marginVertical="$1"
      marginHorizontal={-4}
      {...props}
    />
  );
}

export const PekuloSelect = Object.assign(Root, {
  Group,
  Value,
  Trigger,
  Content,
  Label,
  Item,
  Separator,
});
