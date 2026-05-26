"use client";

import { useState } from "react";
import {
  PekuloButton,
  PekuloField,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
} from "@pekulo/ui";
import type { GetMonthlyOutput } from "@pekulo/types";
import { useUpsertMonthly } from "../_hooks/use-upsert-monthly";

interface MonthlyFormProps {
  year: number;
  monthNum: number;
  defaults: GetMonthlyOutput["record"];
  onSubmitSuccess?: () => void;
}

export function MonthlyForm({ year, monthNum, defaults, onSubmitSuccess }: MonthlyFormProps) {
  const [incomeEur, setIncomeEur] = useState(defaults.incomeEur);
  const [spendingEur, setSpendingEur] = useState(defaults.spendingEur);
  const [transfersEur, setTransfersEur] = useState(defaults.transfersEur);
  const [netChangeEur, setNetChangeEur] = useState(defaults.netChangeEur);
  const upsert = useUpsertMonthly(year, monthNum);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await upsert.mutateAsync({
      year,
      monthNum,
      incomeEur,
      spendingEur,
      transfersEur,
      netChangeEur,
    });
    onSubmitSuccess?.();
  }

  return (
    <form aria-label="Mois en cours" onSubmit={handleSubmit}>
      <PekuloFieldGroup>
        <PekuloField>
          <PekuloFieldLabel htmlFor="monthly-income">Entrées (€)</PekuloFieldLabel>
          <PekuloInput
            id="monthly-income"
            type="number"
            step="0.01"
            min="0"
            value={incomeEur}
            onChange={(e) => setIncomeEur(Number(e.currentTarget.value))}
          />
        </PekuloField>
        <PekuloField>
          <PekuloFieldLabel htmlFor="monthly-spending">Sorties (€)</PekuloFieldLabel>
          <PekuloInput
            id="monthly-spending"
            type="number"
            step="0.01"
            min="0"
            value={spendingEur}
            onChange={(e) => {
              const next = Number(e.currentTarget.value);
              setSpendingEur(next);
              setNetChangeEur(incomeEur - next);
            }}
          />
        </PekuloField>
        <PekuloField>
          <PekuloFieldLabel htmlFor="monthly-transfers">Transferts (€)</PekuloFieldLabel>
          <PekuloInput
            id="monthly-transfers"
            type="number"
            step="0.01"
            min="0"
            value={transfersEur}
            onChange={(e) => setTransfersEur(Number(e.currentTarget.value))}
          />
        </PekuloField>
        <PekuloField>
          <PekuloFieldLabel htmlFor="monthly-net">Net (€)</PekuloFieldLabel>
          <PekuloInput
            id="monthly-net"
            type="number"
            step="0.01"
            value={netChangeEur}
            onChange={(e) => setNetChangeEur(Number(e.currentTarget.value))}
          />
        </PekuloField>
        <PekuloButton type="submit" disabled={upsert.isPending}>
          {upsert.isPending ? "Enregistrement…" : "Enregistrer"}
        </PekuloButton>
      </PekuloFieldGroup>
    </form>
  );
}
