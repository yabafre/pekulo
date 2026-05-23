"use client";

// PekuloBreadcrumb family — shadcn-`Breadcrumb` parity for the Pekulo DS.
// Renders semantic HTML (`<nav aria-label="breadcrumb">` > `<ol>` > `<li>`)
// styled via Tamagui Text/View + Pekulo tokens. No new deps.

import { Text, View, type TextProps, type ViewProps } from "tamagui";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { pekuloFontSizes } from "../tokens";

// ─── Breadcrumb (nav root) ───────────────────────────────────────────────

export interface PekuloBreadcrumbProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

export function PekuloBreadcrumb({ children, ...props }: PekuloBreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props}>
      {children}
    </nav>
  );
}

// ─── BreadcrumbList ──────────────────────────────────────────────────────

export interface PekuloBreadcrumbListProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloBreadcrumbList({ children, ...props }: PekuloBreadcrumbListProps) {
  return (
    <View
      render="ol"
      data-slot="breadcrumb-list"
      flexDirection="row"
      flexWrap="wrap"
      alignItems="center"
      gap="$2"
      margin={0}
      padding={0}
      {...props}
    >
      {children}
    </View>
  );
}

// ─── BreadcrumbItem ──────────────────────────────────────────────────────

export interface PekuloBreadcrumbItemProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloBreadcrumbItem({ children, ...props }: PekuloBreadcrumbItemProps) {
  return (
    <View
      render="li"
      data-slot="breadcrumb-item"
      flexDirection="row"
      alignItems="center"
      gap="$2"
      {...props}
    >
      {children}
    </View>
  );
}

// ─── BreadcrumbLink ──────────────────────────────────────────────────────

export interface PekuloBreadcrumbLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: ReactNode;
}

export function PekuloBreadcrumbLink({ children, style, ...props }: PekuloBreadcrumbLinkProps) {
  return (
    <a
      data-slot="breadcrumb-link"
      style={{
        color: "var(--colorTertiary)",
        textDecoration: "none",
        fontSize: pekuloFontSizes.bodySm,
        transition: "color 150ms ease-out",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--color)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--colorTertiary)";
      }}
      {...props}
    >
      {children}
    </a>
  );
}

// ─── BreadcrumbPage ──────────────────────────────────────────────────────

export function PekuloBreadcrumbPage(props: TextProps) {
  return (
    <Text
      aria-current="page"
      data-slot="breadcrumb-page"
      color="$color"
      fontSize="$bodySm"
      fontWeight="400"
      {...props}
    />
  );
}

// ─── BreadcrumbSeparator ─────────────────────────────────────────────────

export interface PekuloBreadcrumbSeparatorProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloBreadcrumbSeparator({ children, ...props }: PekuloBreadcrumbSeparatorProps) {
  return (
    <View
      render="li"
      role="presentation"
      aria-hidden={true}
      data-slot="breadcrumb-separator"
      flexDirection="row"
      alignItems="center"
      {...props}
    >
      {children ?? <ChevronRight size={14} color="var(--colorTertiary)" aria-hidden={true} />}
    </View>
  );
}

// ─── BreadcrumbEllipsis ──────────────────────────────────────────────────

export function PekuloBreadcrumbEllipsis(props: Omit<ViewProps, "children">) {
  return (
    <View
      role="presentation"
      aria-hidden={true}
      data-slot="breadcrumb-ellipsis"
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      width={36}
      height={36}
      {...props}
    >
      <MoreHorizontal size={16} color="var(--colorTertiary)" aria-hidden={true} />
      <Text position="absolute" width={1} height={1} overflow="hidden" color="$colorTertiary">
        More
      </Text>
    </View>
  );
}
