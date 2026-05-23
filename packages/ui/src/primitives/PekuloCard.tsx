"use client";

// PekuloCard family — shadcn-`Card` parity for the Pekulo DS.
//
// Coexists with `Section` (also a primitive). The choice between the two:
//   - Section — opinionated header bar with `title` + `action` slot props.
//                Best for sections that always have a tertiary action and
//                no body footer (e.g. the immobilier PropertyCard wrapper,
//                the cap-page hero blocks).
//   - PekuloCard — compositional. Header / Title / Description / Action /
//                  Content / Footer as discrete sub-components, like
//                  shadcn. Best for richer cards (settings groups, list
//                  containers with a footer CTA, multi-row dashboards).
//
// Both render on `$backgroundCard`. Pick whichever matches the shape of
// the content. We don't migrate Section consumers to Card — that's a
// future audit.
//
// Layout parity notes vs shadcn (2026-05-23 refactor):
//   - Size context propagation. shadcn uses `data-size="sm"` on Card +
//     `group-data-[size=sm]/card:` Tailwind selectors so every nested
//     subcomponent adapts its padding/gap/font automatically. We replicate
//     with a React Context (`PekuloCardSizeContext`); the data-size attr
//     is preserved for DOM-level diagnostics + downstream CSS targeting.
//   - Card-header CSS grid. shadcn uses `grid-cols-[1fr_auto]` so
//     CardAction can sit at `col-start-2 row-span-2 row-start-1` and
//     span both title + description rows. We use CSS grid via inline
//     style on web; Tamagui View's default flex layout would break the
//     multi-line description case (action would only align with title).
//   - Footer-presence padding drop. shadcn `has-data-[slot=card-footer]:pb-0`
//     drops Card's bottom padding when a CardFooter is present (footer
//     brings its own). We detect via React.Children walk; consumers who
//     nest CardFooter inside an extra wrapper will lose the heuristic
//     (acceptable trade-off — shadcn's CSS selector has the same limit).

import { Children, createContext, isValidElement, useContext } from "react";
import { View, type ViewProps, Text, type TextProps } from "tamagui";
import type { CSSProperties, ReactNode } from "react";

export type PekuloCardSize = "default" | "sm";

const PekuloCardSizeContext = createContext<PekuloCardSize>("default");

// Token tuples — kept inline so the JSX reads tokens directly rather than
// a lookup table. Tamagui `$3` = 12 px ; `$4` = 16 px.
const PAD: Record<PekuloCardSize, "$3" | "$4"> = {
  default: "$4",
  sm: "$3",
};

const PAD_PX: Record<PekuloCardSize, number> = {
  default: 16,
  sm: 12,
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
  // Footer presence drops the Card's bottom padding (shadcn's
  // has-data-[slot=card-footer]:pb-0 trick). Walk direct children only —
  // consumers who wrap CardFooter in an extra container lose the
  // heuristic, same as the CSS selector.
  const hasFooter = Children.toArray(children).some(
    (c) => isValidElement(c) && c.type === PekuloCardFooter,
  );

  return (
    <PekuloCardSizeContext.Provider value={size}>
      <View
        data-slot="card"
        data-size={size}
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

// ─── CardHeader ──────────────────────────────────────────────────────────
// CSS grid (web) so CardAction can span both title + description rows via
// `grid-row: 1 / span 2`. Children sit in column 1 by default; CardAction
// opts into column 2 via its own grid-placement style.

export interface PekuloCardHeaderProps extends Omit<ViewProps, "children" | "style"> {
  children?: ReactNode;
  style?: CSSProperties;
}

export function PekuloCardHeader({ children, style, ...props }: PekuloCardHeaderProps) {
  const size = useContext(PekuloCardSizeContext);
  const headerStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gridAutoRows: "min-content",
    rowGap: 4,
    columnGap: 12,
    paddingLeft: PAD_PX[size],
    paddingRight: PAD_PX[size],
    alignItems: "start",
    ...style,
  };
  return (
    <View data-slot="card-header" style={headerStyle} {...props}>
      {children}
    </View>
  );
}

// ─── CardTitle ───────────────────────────────────────────────────────────

export function PekuloCardTitle(props: TextProps) {
  const size = useContext(PekuloCardSizeContext);
  return (
    <Text
      data-slot="card-title"
      color="$color"
      fontSize={TITLE_FONT_SIZE[size]}
      fontWeight="500"
      lineHeight="$2"
      {...props}
    />
  );
}

// ─── CardDescription ─────────────────────────────────────────────────────

export function PekuloCardDescription(props: TextProps) {
  return (
    <Text data-slot="card-description" color="$colorTertiary" fontSize="$caption" {...props} />
  );
}

// ─── CardAction ──────────────────────────────────────────────────────────
// Grid placement: column 2, spans both rows (title + description) so the
// action is vertically centered relative to the title block even when
// description wraps. Mirrors shadcn `col-start-2 row-span-2 row-start-1
// self-start justify-self-end`.

export interface PekuloCardActionProps extends Omit<ViewProps, "children" | "style"> {
  children?: ReactNode;
  style?: CSSProperties;
}

export function PekuloCardAction({ children, style, ...props }: PekuloCardActionProps) {
  const actionStyle: CSSProperties = {
    gridColumn: "2",
    gridRow: "1 / span 2",
    alignSelf: "start",
    justifySelf: "end",
    ...style,
  };
  return (
    <View data-slot="card-action" style={actionStyle} {...props}>
      {children}
    </View>
  );
}

// ─── CardContent ─────────────────────────────────────────────────────────

export interface PekuloCardContentProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloCardContent({ children, ...props }: PekuloCardContentProps) {
  const size = useContext(PekuloCardSizeContext);
  return (
    <View data-slot="card-content" paddingHorizontal={PAD[size]} {...props}>
      {children}
    </View>
  );
}

// ─── CardFooter ──────────────────────────────────────────────────────────

export interface PekuloCardFooterProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloCardFooter({ children, ...props }: PekuloCardFooterProps) {
  const size = useContext(PekuloCardSizeContext);
  return (
    <View
      data-slot="card-footer"
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
