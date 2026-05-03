"use client";

import { Plus, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ACCOUNT_TYPE_LABELS } from "@/lib/schemas/portfolio";
import type { Account, AccountType } from "@/lib/types";
import { AccountForm } from "./account-form";

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " €";
}

export function AccountsSection({
  accounts,
  editing,
  setEditing,
}: {
  accounts: Account[];
  editing: string | "new" | null;
  setEditing: (v: string | "new" | null) => void;
}) {
  const editingAccount =
    editing && editing !== "new" ? (accounts.find((a) => a.id === editing) ?? null) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Comptes</CardTitle>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau compte
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {accounts.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">
            Aucun compte. Crée ton premier compte (Livret A, PEA…) pour commencer.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Devise</TableHead>
                <TableHead className="text-right">Solde cash</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.label}
                    {a.notes && <div className="text-xs text-muted-foreground">{a.notes}</div>}
                  </TableCell>
                  <TableCell>{ACCOUNT_TYPE_LABELS[a.type as AccountType]}</TableCell>
                  <TableCell>{a.currency}</TableCell>
                  <TableCell className="text-right">{formatEuro(a.cashBalance)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setEditing(a.id)}
                      aria-label="Modifier"
                    >
                      <Pencil />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AccountForm
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        editing={editingAccount}
      />
    </Card>
  );
}
