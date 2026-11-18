// packages/ui/src/primitives/PekuloCard.native.tsx
// Native PekuloCard replacing CSS Grid in CardHeader / CardAction with RN flexbox.

import { Children, createContext, isValidElement, useContext, type ReactNode } from "react";
import { Text, View, type TextProps, type ViewProps } from "tamagui";

export type PekuloCardSize = "default" | "sm";

const PekuloCardSizeContext = createContext<PekuloCardSize>("default");

const PAD: Record<PekuloCardSize, "$3" | "$4"> = {
  default: "$4",
  sm: "$3",
};

const GAP: Record<PekuloCardSize, "$3" | "$4"> = {
  default: "$4",
  sm: "$3",
};

const TITLE_FONT_SIZE: Record<PekuloCardSize, "$bodySm" | "$body"> = {
  default: "$body",
  sm: "$bodySm",
};

export interface PekuloCardProps extends Omit<ViewProps, "children"> {
  size?: PekuloCardSize;
  children?: ReactNode;
}

export function PekuloCard({ size = "default", children, ...props }: PekuloCardProps) {
  const hasFooter = Children.toArray(children).some(
    (c) => isValidElement(c) && c.type === PekuloCardFooter,
  );

  return (
    <PekuloCardSizeContext.Provider value={size}>
      <View
        flexDirection="column"
        gap={GAP[size]}
        paddingTop={PAD[size]}
        paddingBottom={hasFooter ? 0 : PAD[size]}
        backgroundColor="$backgroundCard"
        borderRadius="$xl"
        overflow="hidden"
        {...props}
      >
        {children}
      </View>
    </PekuloCardSizeContext.Provider>
  );
}

export interface PekuloCardHeaderProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloCardHeader({ children, ...props }: PekuloCardHeaderProps) {
  const size = useContext(PekuloCardSizeContext);
  const items = Children.toArray(children);
  const actionChildren = items.filter((c) => isValidElement(c) && c.type === PekuloCardAction);
  const bodyChildren = items.filter((c) => !(isValidElement(c) && c.type === PekuloCardAction));

  return (
    <View
      flexDirection="row"
      alignItems="flex-start"
      justifyContent="space-between"
      gap="$3"
      paddingHorizontal={PAD[size]}
      {...props}
    >
      <View flex={1} flexDirection="column" gap="$1">
        {bodyChildren}
      </View>
      {actionChildren.length > 0 ? actionChildren : null}
    </View>
  );
}

export function PekuloCardTitle(props: TextProps) {
  const size = useContext(PekuloCardSizeContext);
  return (
    <Text
      color="$color"
      fontSize={TITLE_FONT_SIZE[size]}
      fontWeight="500"
      lineHeight={TITLE_FONT_SIZE[size]}
      {...props}
    />
  );
}

export function PekuloCardDescription(props: TextProps) {
  return <Text color="$colorTertiary" fontSize="$caption" {...props} />;
}

export interface PekuloCardActionProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloCardAction({ children, ...props }: PekuloCardActionProps) {
  return (
    <View alignSelf="flex-start" flexShrink={0} {...props}>
      {children}
    </View>
  );
}

export interface PekuloCardContentProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloCardContent({ children, ...props }: PekuloCardContentProps) {
  const size = useContext(PekuloCardSizeContext);
  return (
    <View paddingHorizontal={PAD[size]} {...props}>
      {children}
    </View>
  );
}

export interface PekuloCardFooterProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloCardFooter({ children, ...props }: PekuloCardFooterProps) {
  const size = useContext(PekuloCardSizeContext);
  return (
    <View
      flexDirection="row"
      alignItems="center"
      gap="$3"
      padding={PAD[size]}
      borderTopWidth={1}
      borderTopColor="$borderDefault"
      backgroundColor="$backgroundMuted"
      {...props}
    >
      {children}
    </View>
  );
}
