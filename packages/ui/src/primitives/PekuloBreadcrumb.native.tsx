// packages/ui/src/primitives/PekuloBreadcrumb.native.tsx
import { ChevronRight, MoreHorizontal } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View, styled, useTheme, type TextProps, type ViewProps } from "tamagui";
import { pekuloFontSizes } from "../tokens";

const BreadcrumbNav = styled(View, {
  name: "PekuloBreadcrumbNav",
  role: "navigation",
});

const BreadcrumbLinkText = styled(Text, {
  name: "PekuloBreadcrumbLinkText",
  role: "link",
  // Story 10-8: config.defaultProps is keyed by componentName, so this named
  // Text never receives the global `Text` font default — set it here.
  fontFamily: "$body",
  color: "$colorTertiary",
  fontSize: pekuloFontSizes.bodySm,
});

export interface PekuloBreadcrumbProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloBreadcrumb({ children, ...props }: PekuloBreadcrumbProps) {
  return (
    <BreadcrumbNav aria-label="breadcrumb" {...props}>
      {children}
    </BreadcrumbNav>
  );
}

export interface PekuloBreadcrumbListProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloBreadcrumbList({ children, ...props }: PekuloBreadcrumbListProps) {
  return (
    <View flexDirection="row" flexWrap="wrap" alignItems="center" gap="$2" {...props}>
      {children}
    </View>
  );
}

export interface PekuloBreadcrumbItemProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloBreadcrumbItem({ children, ...props }: PekuloBreadcrumbItemProps) {
  return (
    <View flexDirection="row" alignItems="center" gap="$2" {...props}>
      {children}
    </View>
  );
}

export interface PekuloBreadcrumbLinkProps extends TextProps {
  href?: string;
  children?: ReactNode;
}

export function PekuloBreadcrumbLink({
  children,
  href: _href,
  ...props
}: PekuloBreadcrumbLinkProps) {
  return <BreadcrumbLinkText {...props}>{children}</BreadcrumbLinkText>;
}

export function PekuloBreadcrumbPage(props: TextProps) {
  return <Text color="$color" fontSize="$bodySm" fontWeight="400" {...props} />;
}

export interface PekuloBreadcrumbSeparatorProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloBreadcrumbSeparator({ children, ...props }: PekuloBreadcrumbSeparatorProps) {
  const theme = useTheme();
  return (
    <View accessibilityElementsHidden flexDirection="row" alignItems="center" {...props}>
      {children ?? <ChevronRight size={14} color={theme.colorTertiary.val} />}
    </View>
  );
}

export function PekuloBreadcrumbEllipsis(props: Omit<ViewProps, "children">) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      width={36}
      height={36}
      {...props}
    >
      <MoreHorizontal size={16} color={theme.colorTertiary.val} />
    </View>
  );
}
