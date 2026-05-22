"use client";

// /dev/primitives — Kitchen-sink dev-only route for visual verification
// of every @pekulo/ui primitive added in this PR. NOT linked from the
// nav. NOT for production traffic. Delete when DS work is reviewed.

import { useState } from "react";
import {
  // Feedback
  PekuloSpinner,
  PekuloLoadingItem,
  // Buttons
  PekuloButton,
  PekuloButtonGroup,
  PekuloButtonGroupSeparator,
  PekuloButtonGroupText,
  PekuloSubmitButton,
  // Forms
  PekuloField,
  PekuloFieldContent,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloFieldLegend,
  PekuloFieldSeparator,
  PekuloFieldSet,
  PekuloFieldTitle,
  PekuloInput,
  PekuloNativeCheckbox,
  PekuloNativeSelect,
  PekuloTextarea,
  // Cards
  PekuloCard,
  PekuloCardAction,
  PekuloCardContent,
  PekuloCardDescription,
  PekuloCardFooter,
  PekuloCardHeader,
  PekuloCardTitle,
  // Navigation
  PekuloBreadcrumb,
  PekuloBreadcrumbEllipsis,
  PekuloBreadcrumbItem,
  PekuloBreadcrumbLink,
  PekuloBreadcrumbList,
  PekuloBreadcrumbPage,
  PekuloBreadcrumbSeparator,
  // Date
  PekuloCalendar,
  // Overlays
  PekuloDialog,
  PekuloDrawer,
} from "@pekulo/ui";

const sectionStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  padding: 24,
  borderRadius: 16,
  backgroundColor: "var(--backgroundCard)",
  marginBottom: 24,
};

const headerStyle = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  color: "var(--color)",
};

const subStyle = {
  margin: 0,
  fontSize: 13,
  color: "var(--colorTertiary)",
};

const rowStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  alignItems: "center",
};

const labelStyle = {
  fontSize: 11,
  color: "var(--colorTertiary)",
  letterSpacing: 0.5,
  textTransform: "uppercase" as const,
  marginBottom: 4,
};

export default function PrimitivesShowcasePage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [checkbox, setCheckbox] = useState(false);
  const [select, setSelect] = useState("a");
  const [textInput, setTextInput] = useState("Alex");
  const [textareaVal, setTextareaVal] = useState("Notes ici…");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const variants = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
  const sizes = ["default", "xs", "sm", "lg"] as const;
  const iconSizes = ["icon", "icon-xs", "icon-sm", "icon-lg"] as const;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--background)",
        color: "var(--color)",
        padding: 24,
        fontFamily: "inherit",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Banner */}
        <div
          style={{
            padding: 16,
            marginBottom: 24,
            borderRadius: 12,
            backgroundColor: "var(--danger)",
            color: "var(--colorOnAccent)",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          ⚠️ DEV PAGE — visual kitchen-sink for @pekulo/ui primitives. Not linked from nav. Delete
          when DS work is reviewed.
        </div>

        <h1 style={{ ...headerStyle, fontSize: 32, marginBottom: 8 }}>Pekulo DS · Primitives</h1>
        <p style={{ ...subStyle, marginBottom: 32 }}>
          Visual showcase of every primitive added in PR #89. Toggle controls to inspect states.
        </p>

        {/* ─── Feedback ────────────────────────────────────────────── */}
        <section style={sectionStyle}>
          <header>
            <h2 style={headerStyle}>Feedback</h2>
            <p style={subStyle}>PekuloSpinner · PekuloLoadingItem</p>
          </header>
          <div>
            <p style={labelStyle}>Spinner sizes</p>
            <div style={rowStyle}>
              <PekuloSpinner size={12} />
              <PekuloSpinner size={16} />
              <PekuloSpinner size={20} />
              <PekuloSpinner size={32} />
              <PekuloSpinner size={48} />
            </div>
          </div>
          <div>
            <p style={labelStyle}>LoadingItem</p>
            <PekuloLoadingItem title="Mise à jour…" />
            <div style={{ height: 12 }} />
            <PekuloLoadingItem title="Traitement du paiement…" trailing="100,00 €" />
          </div>
        </section>

        {/* ─── Buttons ─────────────────────────────────────────────── */}
        <section style={sectionStyle}>
          <header>
            <h2 style={headerStyle}>Buttons</h2>
            <p style={subStyle}>
              PekuloButton (6 variants × 8 sizes) · PekuloButtonGroup · PekuloSubmitButton
            </p>
          </header>
          <div>
            <p style={labelStyle}>Variants</p>
            <div style={rowStyle}>
              {variants.map((v) => (
                <PekuloButton key={v} variant={v}>
                  {v}
                </PekuloButton>
              ))}
            </div>
          </div>
          <div>
            <p style={labelStyle}>Sizes</p>
            <div style={rowStyle}>
              {sizes.map((s) => (
                <PekuloButton key={s} size={s}>
                  Button {s}
                </PekuloButton>
              ))}
            </div>
          </div>
          <div>
            <p style={labelStyle}>Icon sizes</p>
            <div style={rowStyle}>
              {iconSizes.map((s) => (
                <PekuloButton key={s} size={s} aria-label={`icon ${s}`}>
                  +
                </PekuloButton>
              ))}
            </div>
          </div>
          <div>
            <p style={labelStyle}>Loading state</p>
            <div style={rowStyle}>
              <PekuloButton loading>Chargement…</PekuloButton>
              <PekuloButton variant="destructive" loading loadingLabel="Suppression…">
                Supprimer
              </PekuloButton>
              <PekuloButton onClick={() => setLoading((v) => !v)}>
                Toggle loading: {loading ? "ON" : "OFF"}
              </PekuloButton>
              <PekuloButton loading={loading}>Action</PekuloButton>
            </div>
          </div>
          <div>
            <p style={labelStyle}>Disabled</p>
            <div style={rowStyle}>
              <PekuloButton disabled>Disabled default</PekuloButton>
              <PekuloButton variant="destructive" disabled>
                Disabled danger
              </PekuloButton>
            </div>
          </div>
          <div>
            <p style={labelStyle}>ButtonGroup (horizontal)</p>
            <PekuloButtonGroup orientation="horizontal">
              <PekuloButton variant="outline">Prev</PekuloButton>
              <PekuloButtonGroupSeparator />
              <PekuloButtonGroupText>Page 1 / 5</PekuloButtonGroupText>
              <PekuloButtonGroupSeparator />
              <PekuloButton variant="outline">Next</PekuloButton>
            </PekuloButtonGroup>
          </div>
          <div>
            <p style={labelStyle}>ButtonGroup (vertical)</p>
            <PekuloButtonGroup orientation="vertical">
              <PekuloButton variant="ghost">Profile</PekuloButton>
              <PekuloButton variant="ghost">Settings</PekuloButton>
              <PekuloButton variant="ghost">Logout</PekuloButton>
            </PekuloButtonGroup>
          </div>
          <div>
            <p style={labelStyle}>SubmitButton (form pill, primary + danger)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320 }}>
              <PekuloSubmitButton>Ajouter le bien</PekuloSubmitButton>
              <PekuloSubmitButton loading loadingLabel="Ajout…">
                Ajouter le bien
              </PekuloSubmitButton>
              <PekuloSubmitButton variant="danger">Supprimer définitivement</PekuloSubmitButton>
              <PekuloSubmitButton type="button" fullWidth={false}>
                Compact (fullWidth=false)
              </PekuloSubmitButton>
            </div>
          </div>
        </section>

        {/* ─── Forms ───────────────────────────────────────────────── */}
        <section style={sectionStyle}>
          <header>
            <h2 style={headerStyle}>Forms (Field family)</h2>
            <p style={subStyle}>
              Field · FieldSet · FieldLegend · FieldGroup · FieldLabel · FieldTitle ·
              FieldDescription · FieldError · FieldSeparator · Input · Textarea · NativeSelect ·
              NativeCheckbox
            </p>
          </header>
          <PekuloFieldSet>
            <PekuloFieldLegend>Profil utilisateur</PekuloFieldLegend>
            <PekuloFieldDescription>
              Showcase de tous les composants Field rendus dans un fieldset.
            </PekuloFieldDescription>
            <PekuloFieldGroup>
              <PekuloField>
                <PekuloFieldLabel htmlFor="ps-name">Nom</PekuloFieldLabel>
                <PekuloInput
                  id="ps-name"
                  value={textInput}
                  onChange={(e) => setTextInput(e.currentTarget.value)}
                />
                <PekuloFieldDescription>
                  Le nom affiché dans l'app (changeable plus tard).
                </PekuloFieldDescription>
              </PekuloField>
              <PekuloField>
                <PekuloFieldLabel htmlFor="ps-email">Email (invalid)</PekuloFieldLabel>
                <PekuloInput id="ps-email" type="email" defaultValue="not-an-email" invalid />
                <PekuloFieldError>Adresse e-mail invalide.</PekuloFieldError>
              </PekuloField>
              <PekuloField>
                <PekuloFieldLabel htmlFor="ps-type">Type</PekuloFieldLabel>
                <PekuloNativeSelect
                  id="ps-type"
                  value={select}
                  onChange={(e) => setSelect(e.currentTarget.value)}
                >
                  <option value="a">Résidence principale</option>
                  <option value="b">Locatif</option>
                  <option value="c">Autre</option>
                </PekuloNativeSelect>
              </PekuloField>
              <PekuloField>
                <PekuloFieldLabel htmlFor="ps-date">Date</PekuloFieldLabel>
                <PekuloInput id="ps-date" type="date" defaultValue="2026-05-22" />
              </PekuloField>
              <PekuloField>
                <PekuloFieldLabel htmlFor="ps-amount">Montant (number)</PekuloFieldLabel>
                <PekuloInput id="ps-amount" type="number" defaultValue="42" controlSize="sm" />
              </PekuloField>
              <PekuloField orientation="horizontal">
                <PekuloFieldLabel htmlFor="ps-furn">Meublé</PekuloFieldLabel>
                <PekuloNativeCheckbox
                  id="ps-furn"
                  checked={checkbox}
                  onChange={(e) => setCheckbox(e.currentTarget.checked)}
                />
              </PekuloField>
              <PekuloField>
                <PekuloFieldLabel htmlFor="ps-notes">Notes</PekuloFieldLabel>
                <PekuloTextarea
                  id="ps-notes"
                  value={textareaVal}
                  onChange={(e) => setTextareaVal(e.currentTarget.value)}
                />
              </PekuloField>
              <PekuloFieldSeparator>ou</PekuloFieldSeparator>
              <PekuloField>
                <PekuloFieldTitle>Préférences</PekuloFieldTitle>
                <PekuloFieldDescription>
                  Cette section regroupe des préférences personnelles.
                </PekuloFieldDescription>
                <PekuloFieldContent>
                  <PekuloFieldLabel htmlFor="ps-newsletter">Newsletter</PekuloFieldLabel>
                  <PekuloNativeCheckbox id="ps-newsletter" />
                </PekuloFieldContent>
              </PekuloField>
              <PekuloFieldError
                errors={[
                  { message: "Champ obligatoire" },
                  { message: "Champ obligatoire" },
                  { message: "Format invalide" },
                ]}
              />
            </PekuloFieldGroup>
          </PekuloFieldSet>
        </section>

        {/* ─── Cards ───────────────────────────────────────────────── */}
        <section style={sectionStyle}>
          <header>
            <h2 style={headerStyle}>Cards</h2>
            <p style={subStyle}>
              PekuloCard (default + sm) · Header · Title · Description · Action · Content · Footer
            </p>
          </header>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <PekuloCard>
              <PekuloCardHeader>
                <div>
                  <PekuloCardTitle>Hypothèse 1</PekuloCardTitle>
                  <PekuloCardDescription>Vue 30 ans · base optimiste</PekuloCardDescription>
                </div>
                <PekuloCardAction>
                  <PekuloButton variant="ghost" size="sm">
                    Modifier
                  </PekuloButton>
                </PekuloCardAction>
              </PekuloCardHeader>
              <PekuloCardContent>
                <p style={{ margin: 0, fontSize: 14, color: "var(--colorSecondary)" }}>
                  Capital projeté : <b style={{ color: "var(--color)" }}>1 245 000 €</b>
                </p>
              </PekuloCardContent>
              <PekuloCardFooter>
                <PekuloButton variant="outline" size="sm">
                  Détails
                </PekuloButton>
                <PekuloButton size="sm">Valider</PekuloButton>
              </PekuloCardFooter>
            </PekuloCard>
            <PekuloCard size="sm">
              <PekuloCardHeader>
                <div>
                  <PekuloCardTitle>Card size=sm</PekuloCardTitle>
                  <PekuloCardDescription>Compact spacing</PekuloCardDescription>
                </div>
              </PekuloCardHeader>
              <PekuloCardContent>
                <p style={{ margin: 0, fontSize: 13 }}>Pour les listes denses (settings, etc.).</p>
              </PekuloCardContent>
            </PekuloCard>
          </div>
        </section>

        {/* ─── Breadcrumb ──────────────────────────────────────────── */}
        <section style={sectionStyle}>
          <header>
            <h2 style={headerStyle}>Breadcrumb</h2>
            <p style={subStyle}>nav · list · item · link · page · separator · ellipsis</p>
          </header>
          <PekuloBreadcrumb>
            <PekuloBreadcrumbList>
              <PekuloBreadcrumbItem>
                <PekuloBreadcrumbLink href="/dashboard">Dashboard</PekuloBreadcrumbLink>
              </PekuloBreadcrumbItem>
              <PekuloBreadcrumbSeparator />
              <PekuloBreadcrumbItem>
                <PekuloBreadcrumbLink href="/dashboard/portefeuille">
                  Portefeuille
                </PekuloBreadcrumbLink>
              </PekuloBreadcrumbItem>
              <PekuloBreadcrumbSeparator />
              <PekuloBreadcrumbItem>
                <PekuloBreadcrumbEllipsis />
              </PekuloBreadcrumbItem>
              <PekuloBreadcrumbSeparator />
              <PekuloBreadcrumbItem>
                <PekuloBreadcrumbPage>Immobilier</PekuloBreadcrumbPage>
              </PekuloBreadcrumbItem>
            </PekuloBreadcrumbList>
          </PekuloBreadcrumb>
        </section>

        {/* ─── Calendar ────────────────────────────────────────────── */}
        <section style={sectionStyle}>
          <header>
            <h2 style={headerStyle}>Calendar</h2>
            <p style={subStyle}>PekuloCalendar (single mode demo)</p>
          </header>
          <div>
            <PekuloCalendar mode="single" selected={date} onSelect={setDate} />
            <p style={{ ...subStyle, marginTop: 12 }}>
              Selected: {date ? date.toLocaleDateString("fr-FR") : "—"}
            </p>
          </div>
        </section>

        {/* ─── Overlays ────────────────────────────────────────────── */}
        <section style={sectionStyle}>
          <header>
            <h2 style={headerStyle}>Overlays</h2>
            <p style={subStyle}>PekuloDialog (Tamagui modal) · PekuloDrawer (vaul mobile sheet)</p>
          </header>
          <div style={rowStyle}>
            <PekuloButton onClick={() => setDialogOpen(true)}>Open Dialog</PekuloButton>
            <PekuloButton variant="secondary" onClick={() => setDrawerOpen(true)}>
              Open Drawer (bottom sheet)
            </PekuloButton>
          </div>

          <PekuloDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <PekuloDialog.Portal>
              <PekuloDialog.Overlay />
              <PekuloDialog.Content>
                <PekuloDialog.Title>Exemple Dialog</PekuloDialog.Title>
                <PekuloDialog.Description>
                  Modal centré, Tamagui-based. Bonne pour les confirmations critiques.
                </PekuloDialog.Description>
                <div
                  style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "flex-end" }}
                >
                  <PekuloDialog.Close asChild>
                    <PekuloButton variant="ghost">Annuler</PekuloButton>
                  </PekuloDialog.Close>
                  <PekuloButton onClick={() => setDialogOpen(false)}>Confirmer</PekuloButton>
                </div>
              </PekuloDialog.Content>
            </PekuloDialog.Portal>
          </PekuloDialog>

          <PekuloDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <PekuloDrawer.Content>
              <PekuloDrawer.Header>
                <PekuloDrawer.Title>Exemple Drawer</PekuloDrawer.Title>
                <PekuloDrawer.Description>
                  Bottom sheet vaul-backed avec swipe-to-close. Bon sur mobile.
                </PekuloDrawer.Description>
              </PekuloDrawer.Header>
              <div style={{ padding: 16 }}>
                <p style={{ margin: 0, fontSize: 14, color: "var(--colorSecondary)" }}>
                  Sur mobile, glisse-vers-le-bas pour fermer. Sur desktop, clique l'overlay ou
                  Escape.
                </p>
              </div>
              <PekuloDrawer.Footer>
                <PekuloButton onClick={() => setDrawerOpen(false)}>Fermer</PekuloButton>
              </PekuloDrawer.Footer>
            </PekuloDrawer.Content>
          </PekuloDrawer>
        </section>
      </div>
    </div>
  );
}
