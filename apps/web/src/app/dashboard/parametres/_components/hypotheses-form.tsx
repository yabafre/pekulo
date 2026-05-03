"use client";

import { Loader2 } from "lucide-react";
import { useActionMutation } from "@zapaction/query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldControl, FieldError, FieldLabel, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppForm } from "@/hooks/form-hook";
import { saveHypotheses } from "@/lib/actions/hypotheses";
import { hypothesesSchema } from "@/lib/schemas/hypotheses";
import { hypothesesTags } from "@/lib/zapaction/keys";
import type { Hypotheses } from "@/lib/types";

export function HypothesesForm({ initialValues }: { initialValues: Hypotheses }) {
  const router = useRouter();
  const mutation = useActionMutation(saveHypotheses, {
    invalidateWithTags: [hypothesesTags.current()],
    onSuccess: () => {
      // Hard navigation to bypass the client router cache & any prefetched RSC payload.
      // revalidatePath() inside the action handles server cache; this guarantees a fresh fetch.
      window.location.href = "/dashboard";
    },
  });

  const form = useAppForm({
    defaultValues: initialValues,
    validators: { onChange: hypothesesSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <form.AppForm>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-5"
      >
        <Section title="Revenus & avantages">
          <Grid>
            <NumField form={form} name="salaireNet" label="Salaire net (€)" step="1" />
            <NumField
              form={form}
              name="ticketRestoJour"
              label="Ticket resto / jour (€)"
              step="0.5"
            />
            <NumField
              form={form}
              name="partEmployeurTr"
              label="Part employeur TR (0-1)"
              step="0.01"
            />
            <NumField form={form} name="joursTravailles" label="Jours travaillés / mois" step="1" />
            <NumField form={form} name="navigoCout" label="Navigo (€)" step="1" />
            <NumField
              form={form}
              name="partEmployeurNavigo"
              label="Part employeur Navigo (0-1)"
              step="0.01"
            />
            <NumField
              form={form}
              name="mutuelleEconomie"
              label="Économie mutuelle / mois (€)"
              step="1"
            />
          </Grid>
        </Section>

        <Section title="Charges & lifestyle">
          <Grid>
            <NumField form={form} name="loyer" label="Loyer (€)" step="10" />
            <NumField form={form} name="courses" label="Courses (€)" step="10" />
            <NumField form={form} name="transport" label="Transport (€)" step="5" />
            <NumField form={form} name="autresCharges" label="Autres charges (€)" step="10" />
            <NumField form={form} name="sorties" label="Sorties (€)" step="10" />
            <NumField form={form} name="divers" label="Divers (€)" step="10" />
            <NumField form={form} name="voyageMois" label="Voyage / mois (€)" step="50" />
          </Grid>
        </Section>

        <Section title="Investissement & remote">
          <Grid>
            <NumField
              form={form}
              name="perfEtfAnnuelle"
              label="Perf ETF annuelle (0-1)"
              step="0.01"
            />
            <NumField
              form={form}
              name="augmentationSalaire"
              label="Augmentation salaire / an (0-1)"
              step="0.01"
            />
            <NumField form={form} name="partEtfMonde" label="Part ETF World (0-1)" step="0.01" />
            <NumField
              form={form}
              name="partOpportunites"
              label="Part opportunités (0-1)"
              step="0.01"
            />
            <NumField
              form={form}
              name="economieRemoteMois"
              label="Économie remote / mois (€)"
              step="50"
            />
            <NumField form={form} name="moisRemoteAn" label="Mois remote / an" step="1" />
            <NumField
              form={form}
              name="revenuFreelanceMois"
              label="Revenu freelance / mois (€)"
              step="50"
            />
          </Grid>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="Crédit & matelas">
            <Grid>
              <NumField form={form} name="creditMensuel" label="Crédit mensuel (€)" step="10" />
              <TextField
                form={form}
                name="dateDebutCredit"
                label="Début crédit (MM/YYYY)"
                placeholder="01/2027"
              />
              <NumField form={form} name="matelasCible" label="Matelas cible (€)" step="500" />
            </Grid>
          </Section>

          <Section title="Projection">
            <Grid>
              <NumField form={form} name="horizonYears" label="Horizon (années)" step="1" />
              <NumField form={form} name="objectif" label="Objectif (€)" step="1000" />
            </Grid>
          </Section>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            {mutation.isError && (
              <span className="text-destructive">Erreur : {(mutation.error as Error).message}</span>
            )}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")}>
              Annuler
            </Button>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
              {([canSubmit, isSubmitting]) => {
                const pending = mutation.isPending || isSubmitting;
                return (
                  <Button type="submit" disabled={!canSubmit || pending}>
                    {pending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Enregistrement…
                      </>
                    ) : (
                      "Enregistrer"
                    )}
                  </Button>
                );
              }}
            </form.Subscribe>
          </div>
        </div>
      </Form>
    </form.AppForm>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {children}
    </div>
  );
}

type NumericKey = {
  [K in keyof Hypotheses]: Hypotheses[K] extends number ? K : never;
}[keyof Hypotheses];

type StringKey = {
  [K in keyof Hypotheses]: Hypotheses[K] extends string ? K : never;
}[keyof Hypotheses];

function NumField({
  form,
  name,
  label,
  step = "1",
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  name: NumericKey;
  label: string;
  step?: string;
}) {
  return (
    <form.AppField name={name}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <Field>
          <FieldLabel>{label}</FieldLabel>
          <FieldControl>
            <Input
              type="number"
              step={step}
              value={field.state.value ?? 0}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                field.handleChange(Number.isNaN(v) ? 0 : v);
              }}
              onBlur={field.handleBlur}
            />
          </FieldControl>
          <FieldError />
        </Field>
      )}
    </form.AppField>
  );
}

function TextField({
  form,
  name,
  label,
  placeholder,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  name: StringKey;
  label: string;
  placeholder?: string;
}) {
  return (
    <form.AppField name={name}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <Field>
          <FieldLabel>{label}</FieldLabel>
          <FieldControl>
            <Input
              type="text"
              placeholder={placeholder}
              value={field.state.value ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </FieldControl>
          <FieldError />
        </Field>
      )}
    </form.AppField>
  );
}
