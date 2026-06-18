"use client";

import { useTranslations } from "next-intl";
import { SegmentError } from "@/lib/segment-error";

export default function ParametresError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  return (
    <SegmentError
      error={error}
      reset={reset}
      context="parametres"
      message={t("parametresFailed")}
    />
  );
}
