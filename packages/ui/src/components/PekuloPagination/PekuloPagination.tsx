"use client";

import { Text, View, styled } from "tamagui";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";

// Tamagui re-creation of the shadcn `Pagination` compound. shadcn is out-of-stack
// (Tailwind + className + @/components/ui/*); Pekulo is Tamagui + $tokens (ADR-0007),
// so we model the same ergonomics in our primitives. Grayscale only — TR-strict,
// no $accent: the active page uses the inverse $color / $colorOnAccent pair, exactly
// like PekuloSuggestionRow's confirm pill. The links are real <button>s (these drive
// client-side page STATE, not URLs), keyboard-operable with a visible focus ring.

// styled.button so HTML attrs (type/disabled/onClick/aria-*) are forwarded to the
// underlying <button>. `active`/`dimmed` are Tamagui variants (NOT the native
// `disabled` attr, kept separate so the DOM attr still passes through).
const PaginationLink = styled.button({
  name: "PekuloPaginationLink",
  minWidth: 32,
  height: 32,
  paddingHorizontal: "$2",
  borderRadius: "$3",
  borderWidth: 0,
  backgroundColor: "transparent",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "$1",
  cursor: "pointer",
  hoverStyle: { backgroundColor: "$backgroundMuted" },
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
  },
  variants: {
    active: {
      true: { backgroundColor: "$color", hoverStyle: { backgroundColor: "$color" } },
    },
    dimmed: {
      true: { opacity: 0.4, cursor: "default", hoverStyle: { backgroundColor: "transparent" } },
    },
  } as const,
});

type LinkButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  active?: boolean;
  dimmed?: boolean;
};
const PaginationLinkButton = PaginationLink as unknown as ComponentType<LinkButtonProps>;

export interface PekuloPaginationProps {
  /** Current 1-based page. */
  page: number;
  /** Total number of pages. Renders nothing when ≤ 1. */
  pageCount: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
}

// 1-based page window with ellipses: always show first + last + current±1, an
// ellipsis bridges any gap > 1. ≤ 7 pages → show them all (no ellipsis). Each
// entry carries a stable key (page number, or the gap's side) so React keys are
// never array-index-based.
type PageEntry = { kind: "page"; page: number } | { kind: "gap"; side: "start" | "end" };

function pageWindow(page: number, pageCount: number): PageEntry[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => ({ kind: "page", page: i + 1 }));
  }
  const out: PageEntry[] = [{ kind: "page", page: 1 }];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) out.push({ kind: "gap", side: "start" });
  for (let p = start; p <= end; p++) out.push({ kind: "page", page: p });
  if (end < pageCount - 1) out.push({ kind: "gap", side: "end" });
  out.push({ kind: "page", page: pageCount });
  return out;
}

export function PekuloPagination({
  page,
  pageCount,
  onPageChange,
  ariaLabel = "Pagination",
  previousLabel = "Page précédente",
  nextLabel = "Page suivante",
}: PekuloPaginationProps) {
  if (pageCount <= 1) return null;
  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  return (
    <View
      role="navigation"
      aria-label={ariaLabel}
      flexDirection="row"
      justifyContent="center"
      alignItems="center"
      gap="$1"
      marginTop="$3"
    >
      <PaginationLinkButton
        type="button"
        dimmed={atStart}
        disabled={atStart}
        aria-label={previousLabel}
        onClick={() => {
          if (!atStart) onPageChange(page - 1);
        }}
      >
        <ChevronLeft size={16} color="var(--colorSecondary)" aria-hidden />
      </PaginationLinkButton>

      {pageWindow(page, pageCount).map((entry) =>
        entry.kind === "gap" ? (
          <View
            key={`gap-${entry.side}`}
            aria-hidden
            minWidth={32}
            height={32}
            alignItems="center"
            justifyContent="center"
          >
            <MoreHorizontal size={16} color="var(--colorSecondary)" />
          </View>
        ) : (
          <PaginationLinkButton
            key={entry.page}
            type="button"
            active={entry.page === page}
            aria-current={entry.page === page ? "page" : undefined}
            aria-label={`Page ${entry.page}`}
            onClick={() => onPageChange(entry.page)}
          >
            <Text
              color={entry.page === page ? "$colorOnAccent" : "$color"}
              fontSize="$xs"
              fontWeight={entry.page === page ? "600" : "400"}
            >
              {entry.page}
            </Text>
          </PaginationLinkButton>
        ),
      )}

      <PaginationLinkButton
        type="button"
        dimmed={atEnd}
        disabled={atEnd}
        aria-label={nextLabel}
        onClick={() => {
          if (!atEnd) onPageChange(page + 1);
        }}
      >
        <ChevronRight size={16} color="var(--colorSecondary)" aria-hidden />
      </PaginationLinkButton>
    </View>
  );
}
