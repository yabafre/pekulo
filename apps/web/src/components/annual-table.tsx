import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AnnualSummary } from "@/lib/types";

interface AnnualTableProps {
  data: AnnualSummary[];
}

export function AnnualTable({ data }: AnnualTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Suivi Mensuel — Résumé Annuel</CardTitle>
        <CardDescription>Capital projeté par période de 12 mois</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Période</TableHead>
              <TableHead className="text-right">Épargne annuelle</TableHead>
              <TableHead className="text-right">Perf. marché</TableHead>
              <TableHead className="text-right">Capital fin période</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((a) => (
              <TableRow key={a.periode}>
                <TableCell className="text-sm">{a.periode}</TableCell>
                <TableCell className="text-right">
                  {new Intl.NumberFormat("fr-FR").format(a.epargneAnnuelle)} €
                </TableCell>
                <TableCell className="text-right">
                  +{new Intl.NumberFormat("fr-FR").format(Math.round(a.perfMarche))} €
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {new Intl.NumberFormat("fr-FR").format(a.capitalFin)} €
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
