// packages/ui/src/components/PekuloPagination/PekuloPagination.native.tsx
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react-native";
import { Text, View, styled, useTheme } from "tamagui";

const PaginationLink = styled(View, {
  name: "PekuloPaginationLink",
  role: "button",
  minWidth: 32,
  height: 32,
  paddingHorizontal: "$2",
  borderRadius: "$md",
  backgroundColor: "transparent",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "$1",
  pressStyle: { backgroundColor: "$backgroundMuted" },
  variants: {
    active: {
      true: { backgroundColor: "$color", pressStyle: { backgroundColor: "$color" } },
    },
    dimmed: {
      true: { opacity: 0.4, pressStyle: { backgroundColor: "transparent" } },
    },
  } as const,
});

// Story 10-8 review — the page number is a named styled(Text) with an `active`
// variant, never a ternary `fontWeight` prop: the Tamagui compiler emits a
// ternary weight as its own style entry WITHOUT the native face swap, so the
// flattened Text carried `fontFamily: Geist_400Regular` + `fontWeight` side by
// side — the pair Android renders in Roboto. Named, so it sets `$body` itself
// (config.defaultProps.Text does not reach named components).
const PageNumberText = styled(Text, {
  name: "PekuloPaginationPageNumber",
  fontFamily: "$body",
  fontSize: "$xs",
  color: "$color",
  variants: {
    active: {
      true: { color: "$colorOnAccent", fontWeight: "600" },
    },
  } as const,
});

export interface PekuloPaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
}

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
  const theme = useTheme();
  const safePageCount = Number.isFinite(pageCount) ? Math.trunc(pageCount) : 0;
  if (safePageCount <= 1) return null;
  const safePage = Number.isFinite(page)
    ? Math.max(1, Math.min(safePageCount, Math.trunc(page)))
    : 1;
  const atStart = safePage <= 1;
  const atEnd = safePage >= safePageCount;

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
      <PaginationLink
        dimmed={atStart}
        disabled={atStart}
        aria-disabled={atStart}
        aria-label={previousLabel}
        onPress={() => {
          if (!atStart) onPageChange(safePage - 1);
        }}
      >
        <ChevronLeft size={16} color={theme.colorSecondary.val} />
      </PaginationLink>

      {pageWindow(safePage, safePageCount).map((entry) =>
        entry.kind === "gap" ? (
          <View
            key={`gap-${entry.side}`}
            accessibilityElementsHidden
            minWidth={32}
            height={32}
            alignItems="center"
            justifyContent="center"
          >
            <MoreHorizontal size={16} color={theme.colorSecondary.val} />
          </View>
        ) : (
          <PaginationLink
            key={entry.page}
            active={entry.page === safePage}
            aria-label={`Page ${entry.page}`}
            aria-selected={entry.page === safePage}
            onPress={() => onPageChange(entry.page)}
          >
            <PageNumberText active={entry.page === safePage}>{entry.page}</PageNumberText>
          </PaginationLink>
        ),
      )}

      <PaginationLink
        dimmed={atEnd}
        disabled={atEnd}
        aria-disabled={atEnd}
        aria-label={nextLabel}
        onPress={() => {
          if (!atEnd) onPageChange(safePage + 1);
        }}
      >
        <ChevronRight size={16} color={theme.colorSecondary.val} />
      </PaginationLink>
    </View>
  );
}
