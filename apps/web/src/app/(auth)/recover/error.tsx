"use client";

import { useTranslations } from "next-intl";
import { SegmentError } from "@/lib/segment-error";

export default function RecoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  return (
    <SegmentError error={error} reset={reset} context="recover" message={t("recoverFailed")} />
  );
}
