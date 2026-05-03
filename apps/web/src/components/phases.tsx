import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Phase {
  num: string;
  name: string;
  detail: string;
  epargne: string;
  duree: string;
  statut: string;
}

interface PhasesProps {
  phases: Phase[];
}

export function Phases({ phases }: PhasesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Phases Stratégiques</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {phases.map((p) => (
            <div key={p.num} className="border rounded-lg p-3 bg-muted/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                {p.num}
              </p>
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{p.detail}</p>
              <p className="text-xs text-muted-foreground">{p.epargne}</p>
              <p className="text-xs text-muted-foreground">{p.duree}</p>
              <p className="text-xs font-medium mt-1 text-muted-foreground">{p.statut}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
