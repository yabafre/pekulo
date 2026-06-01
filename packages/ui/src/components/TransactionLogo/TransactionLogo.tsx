"use client";

import { useState } from "react";
import { View } from "tamagui";
import { CategoryIcon } from "../CategoryIcon/CategoryIcon";

// Story 6-10 (FR-65). 3-tier transaction avatar: when `src` is present render
// the (merchant/bank) logo image; on image load error OR no `src`, fall back to
// the category icon (story 6-8). Decorative: the row announces the label, so the
// avatar is aria-hidden + alt="" (NFR-22/24). Grayscale chrome (TR fidelity,
// lesson 2026-05-07) — no emerald. Fixed square so rows stay aligned.
export interface TransactionLogoProps {
  /** Opaque Pekulo proxy URL (/v1/logos?ref=...), or null/undefined → category icon. */
  src?: string | null;
  /** RAW category value for the fallback CategoryIcon (e.g. "courses"). */
  category: string;
  size?: number;
}

export function TransactionLogo({ src, category, size = 28 }: TransactionLogoProps) {
  // A broken/404 proxy image swaps to the category icon (AC-3). useState keeps
  // the fallback in React's hands — no imperative DOM poke on the sibling node.
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(src) && !failed;
  return (
    <View
      width={size}
      height={size}
      borderRadius="$full"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      backgroundColor="$backgroundMuted"
      aria-hidden
    >
      {showImg ? (
        // Native <img> (not Tamagui Image): we need the onError fallback to swap
        // to the category icon when the proxy 404s a missing/broken logo.
        <img
          src={src ?? undefined}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: "contain", display: "block" }}
          onError={() => setFailed(true)}
        />
      ) : (
        <CategoryIcon category={category} size={Math.round(size * 0.6)} />
      )}
    </View>
  );
}
