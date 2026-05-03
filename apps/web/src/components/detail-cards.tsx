import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Hypotheses } from "@/lib/types";
import { deriveAvantages } from "@/lib/derive";

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " €";
}

function formatGain(n: number) {
  return "+" + formatEuro(n);
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

export function DetailCards({ hypotheses }: { hypotheses: Hypotheses }) {
  const ticketResto =
    hypotheses.ticketRestoJour * hypotheses.partEmployeurTr * hypotheses.joursTravailles;
  const navigoEmployeur = hypotheses.navigoCout * hypotheses.partEmployeurNavigo;
  const transportNet = hypotheses.navigoCout - navigoEmployeur;
  const avantages = deriveAvantages(hypotheses);
  const pouvoirAchat = hypotheses.salaireNet + avantages;

  const chargesFixes =
    hypotheses.loyer + hypotheses.courses + transportNet + hypotheses.autresCharges;
  const lifestyle = hypotheses.sorties + hypotheses.divers;
  const reste1 = hypotheses.salaireNet - chargesFixes - lifestyle - hypotheses.voyageMois;
  const reste2 = reste1 - hypotheses.creditMensuel;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail Revenus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label="Salaire net mensuel" value={formatEuro(hypotheses.salaireNet)} />
          <Row label="Tickets resto (part employeur)" value={formatGain(ticketResto)} />
          <Row label="Pass Navigo (part employeur)" value={formatGain(navigoEmployeur)} />
          <Row label="Mutuelle (économie)" value={formatGain(hypotheses.mutuelleEconomie)} />
          <Separator />
          <Row label="Total avantages" value={formatGain(avantages)} bold />
          <Separator />
          <Row label="Pouvoir d'achat réel" value={formatEuro(pouvoirAchat)} bold />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail Budget</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label="Loyer" value={formatEuro(hypotheses.loyer)} />
          <Row label="Courses" value={formatEuro(hypotheses.courses)} />
          <Row label="Transport (Navigo net)" value={formatEuro(transportNet)} />
          <Row label="Autres charges" value={formatEuro(hypotheses.autresCharges)} />
          <Row label="Total charges fixes" value={formatEuro(chargesFixes)} bold />
          <Separator />
          <Row label="Sorties" value={formatEuro(hypotheses.sorties)} />
          <Row label="Divers" value={formatEuro(hypotheses.divers)} />
          <Row label="Total lifestyle" value={formatEuro(lifestyle)} bold />
          <Separator />
          <Row label="Provision voyage" value={formatEuro(hypotheses.voyageMois)} />
          <Separator />
          <Row label="Reste à investir (Phase 1)" value={formatEuro(reste1)} bold />
          <Row label="Reste à investir (Phase 2)" value={formatEuro(reste2)} />
        </CardContent>
      </Card>
    </div>
  );
}
