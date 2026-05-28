"use client";

// Story 5-2 T12 — CSV import dialog. 2-step flow:
//   step A: paste textarea + "Aperçu" → previewImportCsv (read-only SE)
//   step B: review CsvPreviewTable → "Confirmer (N)" → importCsv (mutate)
//
// AC-12 — the "Confirmer" CTA is disabled while summary.invalid > 0 OR
// summary.valid === 0; only a clean preview enables the bulk-insert.
// AC-13 — registry-SSOT (NOT optimistic) — the Récentes list re-fetches
// after the importCsv success via the useImportTransactionsCsvForm hook's
// invalidateWithTags option (R12, codified by the 2026-05-24 lesson).

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloButton, PekuloDialog, PekuloSkeleton, useToast } from "@pekulo/ui";
import type { PreviewedRow, ValidatedCsvRow } from "@pekulo/validators";
import { useAccounts } from "../../_accounts/_hooks/use-accounts";
import { useImportTransactionsCsvForm } from "../_hooks/use-import-transactions-csv-form";
import { usePreviewImportCsv } from "../_hooks/use-preview-import-csv";
import { CsvPreviewTable } from "./csv-preview-table";
import styles from "./csv-import-form.module.css";

export interface CsvImportFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CsvImportForm({ open, onOpenChange }: CsvImportFormProps) {
  const [csvText, setCsvText] = useState("");
  const [previewedRows, setPreviewedRows] = useState<PreviewedRow[] | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    valid: number;
    invalid: number;
  } | null>(null);
  // The exact textarea content that produced `previewedRows`. We gate
  // "Confirmer" on `csvText === lastPreviewedText` so an edit after preview
  // forces a fresh "Aperçu" round-trip and never imports stale rows.
  const [lastPreviewedText, setLastPreviewedText] = useState<string | null>(null);
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const previewMut = usePreviewImportCsv();
  const importMut = useImportTransactionsCsvForm();
  const { data: accounts } = useAccounts();
  const toast = useToast();

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    (accounts ?? []).forEach((a) => map.set(a.id, a.label));
    return map;
  }, [accounts]);

  useEffect(() => {
    if (!open) {
      setCsvText("");
      setPreviewedRows(null);
      setSummary(null);
      setLastPreviewedText(null);
      setEnvelopeError(null);
    }
  }, [open]);

  const handlePreview = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnvelopeError(null);
    const submittedText = csvText;
    previewMut.mutate(
      { csvText: submittedText },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setEnvelopeError(result.message);
            setPreviewedRows(null);
            setSummary(null);
            setLastPreviewedText(null);
            return;
          }
          setPreviewedRows(result.rows);
          setSummary(result.summary);
          setLastPreviewedText(submittedText);
        },
      },
    );
  };

  const handleConfirm = () => {
    if (importMut.isPending) return;
    if (!previewedRows || !summary || summary.invalid > 0 || summary.valid === 0) return;
    if (csvText !== lastPreviewedText) return;
    const rows: ValidatedCsvRow[] = previewedRows
      .map((r) => r.parsed)
      .filter((p): p is ValidatedCsvRow => p !== undefined);
    importMut.mutate(
      { rows },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setEnvelopeError(result.message);
            return;
          }
          toast.success("Import réussi", `${result.persisted} transactions importées`);
          onOpenChange(false);
        },
      },
    );
  };

  const canConfirm =
    summary !== null &&
    summary.invalid === 0 &&
    summary.valid > 0 &&
    !importMut.isPending &&
    csvText === lastPreviewedText;
  const isStalePreview = summary !== null && csvText !== lastPreviewedText;

  return (
    <PekuloDialog open={open} onOpenChange={onOpenChange}>
      <PekuloDialog.Portal>
        <PekuloDialog.Overlay />
        <PekuloDialog.Content maxWidth={920} width="92vw">
          <View flexDirection="column" gap="$4">
            <PekuloDialog.Title>Importer un CSV</PekuloDialog.Title>
            <Text fontSize="$caption" color="$colorTertiary">
              Format : 4 colonnes par ligne — date (YYYY-MM-DD), montant (signe = sens : positif =
              entrée, négatif = sortie), libellé, nom du compte. Max 1000 lignes.
            </Text>

            <form aria-label="Importer un CSV" onSubmit={handlePreview}>
              <View flexDirection="column" gap="$3">
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  aria-label="Contenu CSV"
                  rows={10}
                  placeholder="2026-05-01,42.50,Courses Carrefour,Compte courant"
                  className={styles.textarea}
                  style={{
                    width: "100%",
                    minHeight: 200,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: "var(--backgroundElevated)",
                    color: "var(--color)",
                    border: "1px solid var(--borderDefault)",
                    fontFamily: "monospace",
                    fontSize: 12,
                    resize: "vertical",
                  }}
                />
                {envelopeError && (
                  <Text fontSize="$caption" color="$danger" role="alert">
                    {envelopeError}
                  </Text>
                )}
                <View flexDirection="row" gap="$2">
                  <PekuloButton
                    type="submit"
                    disabled={previewMut.isPending || csvText.trim().length === 0}
                  >
                    {previewMut.isPending ? "Analyse…" : "Aperçu"}
                  </PekuloButton>
                </View>
              </View>
            </form>

            {previewMut.isPending && (
              <View role="status" aria-live="polite">
                <PekuloSkeleton lines={3} height={32} />
              </View>
            )}

            {summary && previewedRows && (
              <View flexDirection="column" gap="$2">
                <Text fontSize="$caption" color="$colorTertiary">
                  {summary.valid} lignes valides · {summary.invalid} invalides · {summary.total} au
                  total
                </Text>
                {isStalePreview && (
                  <Text fontSize="$caption" color="$danger" role="alert">
                    Le CSV a été modifié — relance « Aperçu » avant de confirmer.
                  </Text>
                )}
                <CsvPreviewTable rows={previewedRows} accountLabelById={accountLabelById} />
                <View flexDirection="row" gap="$2" justifyContent="flex-end" marginTop="$3">
                  <PekuloButton onPress={handleConfirm} disabled={!canConfirm}>
                    {importMut.isPending ? "Import…" : `Confirmer (${summary.valid})`}
                  </PekuloButton>
                </View>
              </View>
            )}

            <PekuloDialog.Close asChild>
              <View
                render="button"
                paddingVertical="$2"
                cursor="pointer"
                backgroundColor="transparent"
                borderWidth={0}
                alignItems="center"
              >
                <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
                  Fermer
                </Text>
              </View>
            </PekuloDialog.Close>
          </View>
        </PekuloDialog.Content>
      </PekuloDialog.Portal>
    </PekuloDialog>
  );
}
