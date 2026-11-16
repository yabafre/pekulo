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
      <PaginationLink
        dimmed={atStart}
        disabled={atStart}
        aria-disabled={atStart}
        aria-label={previousLabel}
        onPress={() => {
          if (!atStart) onPageChange(page - 1);
        }}
      >
        <ChevronLeft size={16} color={theme.colorSecondary.val} />
      </PaginationLink>

      {pageWindow(page, pageCount).map((entry) =>
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
            active={entry.page === page}
            aria-label={`Page ${entry.page}`}
            aria-selected={entry.page === page}
            onPress={() => onPageChange(entry.page)}
          >
            <Text
              color={entry.page === page ? "$colorOnAccent" : "$color"}
              fontSize="$xs"
              fontWeight={entry.page === page ? "600" : "400"}
            >
              {entry.page}
            </Text>
          </PaginationLink>
        ),
      )}

      <PaginationLink
        dimmed={atEnd}
        disabled={atEnd}
        aria-disabled={atEnd}
        aria-label={nextLabel}
        onPress={() => {
          if (!atEnd) onPageChange(page + 1);
        }}
      >
        <ChevronRight size={16} color={theme.colorSecondary.val} />
      </PaginationLink>
    </View>
  );
}
