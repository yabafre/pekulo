"use client";

// /dev/primitives — Kitchen-sink showcase for every @pekulo/ui primitive
// shipped in PR #89. DEV-ONLY. Delete on review.
//
// Layout: sticky left TOC + main scroll column (≥ lg). Mobile: stacked
// with a top-anchored quick-links bar. Every primitive section shows ALL
// states (default, hover-hint, focus, disabled, invalid, loading).

import { useEffect, useMemo, useState } from "react";
import { Cloud, Folder, Plus, Settings as SettingsIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import {
  PekuloSpinner,
  PekuloLoadingItem,
  PekuloProgress,
  PekuloButton,
  PekuloButtonGroup,
  PekuloButtonGroupSeparator,
  PekuloButtonGroupText,
  PekuloSubmitButton,
  type PekuloButtonVariant,
  type PekuloButtonSize,
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
  PekuloLabel,
  PekuloNativeCheckbox,
  PekuloNativeSelect,
  PekuloTextarea,
  PekuloCard,
  PekuloCardAction,
  PekuloCardContent,
  PekuloCardDescription,
  PekuloCardFooter,
  PekuloCardHeader,
  PekuloCardTitle,
  PekuloEmpty,
  PekuloEmptyContent,
  PekuloEmptyDescription,
  PekuloEmptyHeader,
  PekuloEmptyMedia,
  PekuloEmptyTitle,
  PekuloBreadcrumb,
  PekuloBreadcrumbEllipsis,
  PekuloBreadcrumbItem,
  PekuloBreadcrumbLink,
  PekuloBreadcrumbList,
  PekuloBreadcrumbPage,
  PekuloBreadcrumbSeparator,
  PekuloCalendar,
  PekuloDatePicker,
  PekuloResizableHandle,
  PekuloResizablePanel,
  PekuloResizablePanelGroup,
  PekuloDialog,
  PekuloDrawer,
} from "@pekulo/ui";

// ─── TOC ─────────────────────────────────────────────────────────────────

const TOC: ReadonlyArray<{ id: string; label: string; count: number }> = [
  { id: "feedback", label: "Feedback", count: 3 },
  { id: "buttons", label: "Buttons", count: 1 },
  { id: "button-group", label: "ButtonGroup", count: 3 },
  { id: "submit-button", label: "SubmitButton", count: 1 },
  { id: "field", label: "Field family", count: 10 },
  { id: "inputs", label: "Form inputs", count: 4 },
  { id: "label", label: "Label", count: 1 },
  { id: "cards", label: "Cards", count: 7 },
  { id: "empty", label: "Empty state", count: 6 },
  { id: "breadcrumb", label: "Breadcrumb", count: 7 },
  { id: "calendar", label: "Calendar", count: 1 },
  { id: "datepicker", label: "DatePicker", count: 1 },
  { id: "resizable", label: "Resizable", count: 3 },
  { id: "overlays", label: "Overlays", count: 2 },
];

// ─── Local layout primitives ─────────────────────────────────────────────

function Subsection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: "var(--colorTertiary)",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {label}
        </p>
        {hint && (
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--colorTertiary)" }}>{hint}</p>
        )}
      </div>
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          backgroundColor: "var(--background)",
          border: "1px solid var(--borderDefault)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  tagline,
  children,
}: {
  id: string;
  title: string;
  tagline: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 24,
        borderRadius: 16,
        backgroundColor: "var(--backgroundCard)",
        scrollMarginTop: 24,
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingBottom: 16,
          borderBottom: "1px solid var(--borderDefault)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--color)" }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--colorTertiary)" }}>{tagline}</p>
      </header>
      {children}
    </section>
  );
}

function Row({ children, wrap = true }: { children: React.ReactNode; wrap?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: wrap ? "wrap" : "nowrap",
        gap: 12,
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}

// ─── TOC active section (IntersectionObserver) ───────────────────────────

function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function PrimitivesShowcasePage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [datePickerSingle, setDatePickerSingle] = useState<Date | undefined>();
  const [datePickerRange, setDatePickerRange] = useState<DateRange | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressAuto, setProgressAuto] = useState(true);

  useEffect(() => {
    if (!progressAuto) return;
    const id = setInterval(() => setProgress((p) => (p >= 100 ? 0 : p + 5)), 400);
    return () => clearInterval(id);
  }, [progressAuto]);

  const tocIds = useMemo(() => TOC.map((t) => t.id), []);
  const activeSection = useActiveSection(tocIds);

  const buttonVariants: ReadonlyArray<PekuloButtonVariant> = [
    "default",
    "outline",
    "secondary",
    "ghost",
    "destructive",
    "link",
  ];
  const buttonSizes: ReadonlyArray<PekuloButtonSize> = ["xs", "sm", "default", "lg"];
  const iconSizes: ReadonlyArray<PekuloButtonSize> = ["icon-xs", "icon-sm", "icon", "icon-lg"];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--background)",
        color: "var(--color)",
        fontFamily: "inherit",
      }}
    >
      <style>{`
        @media (min-width: 1024px) {
          .pekulo-mobile-toc { display: none !important; }
          .pekulo-showcase-grid { grid-template-columns: 220px 1fr !important; }
          .pekulo-sticky-toc { display: flex !important; }
        }
      `}</style>

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "32px 24px 80px",
          display: "grid",
          gap: 24,
        }}
      >
        {/* Banner */}
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 12,
            backgroundColor: "color-mix(in srgb, var(--danger) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)",
            color: "var(--danger)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>
            DEV ONLY — kitchen-sink pour @pekulo/ui. Pas dans la nav. À supprimer après review.
          </span>
        </div>

        {/* Header */}
        <header style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 40,
              fontWeight: 600,
              color: "var(--color)",
              letterSpacing: -0.5,
            }}
          >
            Pekulo DS · Primitives
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "var(--colorTertiary)", maxWidth: 720 }}>
            Showcase exhaustif des primitives ajoutées dans PR #89 — chaque section présente la
            primitive avec toutes ses variantes et tous ses états.
          </p>
          <Row>
            {[`${TOC.length} sections`, "~50 primitives", "TR-strict dark", "Tamagui rc.42"].map(
              (label) => (
                <span
                  key={label}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 9999,
                    backgroundColor: "var(--backgroundCard)",
                    border: "1px solid var(--borderDefault)",
                    fontSize: 12,
                    color: "var(--colorTertiary)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {label}
                </span>
              ),
            )}
          </Row>
        </header>

        {/* Mobile quick-links */}
        <nav
          aria-label="Sections"
          // oxlint-disable-next-line pekulo/no-tailwind-outside-ui -- scoped CSS class
          className="pekulo-mobile-toc"
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            padding: 12,
            borderRadius: 12,
            backgroundColor: "var(--backgroundCard)",
            border: "1px solid var(--borderDefault)",
          }}
        >
          {TOC.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                backgroundColor: activeSection === t.id ? "var(--color)" : "var(--backgroundMuted)",
                color: activeSection === t.id ? "var(--colorOnAccent)" : "var(--colorTertiary)",
                fontSize: 12,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              {t.label}
            </a>
          ))}
        </nav>

        {/* Two-column layout */}
        <div
          // oxlint-disable-next-line pekulo/no-tailwind-outside-ui -- scoped CSS class
          className="pekulo-showcase-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* Sticky TOC */}
          <aside
            // oxlint-disable-next-line pekulo/no-tailwind-outside-ui -- scoped CSS class
            className="pekulo-sticky-toc"
            aria-label="Table des matières"
            style={{
              display: "none",
              position: "sticky",
              top: 24,
              flexDirection: "column",
              gap: 4,
              padding: 16,
              borderRadius: 12,
              backgroundColor: "var(--backgroundCard)",
              border: "1px solid var(--borderDefault)",
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
            }}
          >
            <p
              style={{
                margin: "0 0 8px 0",
                fontSize: 10,
                color: "var(--colorTertiary)",
                letterSpacing: 0.6,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Sections
            </p>
            {TOC.map((t) => {
              const isActive = activeSection === t.id;
              return (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                    color: isActive ? "var(--color)" : "var(--colorTertiary)",
                    backgroundColor: isActive ? "var(--backgroundMuted)" : "transparent",
                  }}
                >
                  <span>{t.label}</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--colorTertiary)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {t.count}
                  </span>
                </a>
              );
            })}
          </aside>

          {/* Main */}
          <main style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            {/* FEEDBACK */}
            <Section
              id="feedback"
              title="Feedback"
              tagline="Spinner, LoadingItem, Progress — états transitoires"
            >
              <Subsection label="Spinner — 12 → 48px">
                <Row>
                  {[12, 16, 20, 24, 32, 48].map((size) => (
                    <div
                      key={size}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <PekuloSpinner size={size} />
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--colorTertiary)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {size}px
                      </span>
                    </div>
                  ))}
                </Row>
              </Subsection>

              <Subsection label="LoadingItem — title-only + with trailing">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <PekuloLoadingItem title="Mise à jour…" />
                  <PekuloLoadingItem title="Traitement du paiement…" trailing="100,00 €" />
                  <PekuloLoadingItem title="Chargement de l'historique" trailing="42 entrées" />
                </div>
              </Subsection>

              <Subsection
                label="Progress — fixed values + animated"
                hint="Plain CSS bar, no Tamagui dep — works regardless of provider state"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[0, 33, 66, 100].map((v) => (
                    <div key={v} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span
                        style={{
                          width: 40,
                          fontSize: 12,
                          color: "var(--colorTertiary)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {v}%
                      </span>
                      <div style={{ flex: 1 }}>
                        <PekuloProgress value={v} />
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        width: 40,
                        fontSize: 12,
                        color: progressAuto ? "var(--color)" : "var(--colorTertiary)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {progress}%
                    </span>
                    <div style={{ flex: 1 }}>
                      <PekuloProgress value={progress} />
                    </div>
                    <PekuloButton
                      size="xs"
                      variant="outline"
                      onClick={() => setProgressAuto((v) => !v)}
                    >
                      {progressAuto ? "Pause" : "Play"}
                    </PekuloButton>
                  </div>
                </div>
              </Subsection>
            </Section>

            {/* BUTTONS */}
            <Section
              id="buttons"
              title="Buttons"
              tagline="6 variants × 4 sizes + icon sizes + loading + disabled + onPress shim"
            >
              <Subsection
                label="Variant × Size matrix"
                hint="Hover to see interaction states; tab to see focus rings"
              >
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      borderCollapse: "separate",
                      borderSpacing: 8,
                      minWidth: "100%",
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            fontSize: 10,
                            color: "var(--colorTertiary)",
                            letterSpacing: 0.6,
                            textTransform: "uppercase",
                            fontWeight: 600,
                            padding: "4px 8px",
                          }}
                        >
                          variant ↓ / size →
                        </th>
                        {buttonSizes.map((s) => (
                          <th
                            key={s}
                            style={{
                              textAlign: "left",
                              fontSize: 10,
                              color: "var(--colorTertiary)",
                              letterSpacing: 0.6,
                              textTransform: "uppercase",
                              fontWeight: 600,
                              padding: "4px 8px",
                            }}
                          >
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {buttonVariants.map((v) => (
                        <tr key={v}>
                          <th
                            style={{
                              textAlign: "left",
                              fontSize: 11,
                              color: "var(--colorTertiary)",
                              fontWeight: 500,
                              padding: "4px 8px",
                            }}
                          >
                            {v}
                          </th>
                          {buttonSizes.map((s) => (
                            <td key={s} style={{ padding: 4 }}>
                              <PekuloButton variant={v} size={s}>
                                Action
                              </PekuloButton>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Subsection>

              <Subsection label="Icon-only sizes">
                <Row>
                  {iconSizes.map((s) => {
                    const size =
                      s === "icon-xs" ? 12 : s === "icon-sm" ? 14 : s === "icon-lg" ? 18 : 16;
                    return (
                      <PekuloButton
                        key={s}
                        size={s}
                        variant="outline"
                        aria-label={`Ajouter (${s})`}
                      >
                        <Plus size={size} aria-hidden={true} />
                      </PekuloButton>
                    );
                  })}
                </Row>
              </Subsection>

              <Subsection label="States — default · loading · disabled · loading+danger">
                <Row>
                  <PekuloButton>Default</PekuloButton>
                  <PekuloButton loading>Chargement…</PekuloButton>
                  <PekuloButton disabled>Disabled</PekuloButton>
                  <PekuloButton variant="destructive" loading loadingLabel="Suppression…">
                    Supprimer
                  </PekuloButton>
                  <PekuloButton variant="outline" disabled>
                    Outline disabled
                  </PekuloButton>
                  <PekuloButton variant="ghost" disabled>
                    Ghost disabled
                  </PekuloButton>
                </Row>
              </Subsection>
            </Section>

            {/* BUTTON GROUP */}
            <Section
              id="button-group"
              title="ButtonGroup"
              tagline="Segmented control — horizontal / vertical, Separator + Text slots"
            >
              <Subsection label="Horizontal — buttons + separator + text">
                <PekuloButtonGroup orientation="horizontal">
                  <PekuloButton variant="outline">Prev</PekuloButton>
                  <PekuloButtonGroupSeparator />
                  <PekuloButtonGroupText>Page 1 / 5</PekuloButtonGroupText>
                  <PekuloButtonGroupSeparator />
                  <PekuloButton variant="outline">Next</PekuloButton>
                </PekuloButtonGroup>
              </Subsection>

              <Subsection label="Horizontal — segmented filter">
                <PekuloButtonGroup>
                  <PekuloButton variant="secondary">Tous</PekuloButton>
                  <PekuloButton variant="outline">Actifs</PekuloButton>
                  <PekuloButton variant="outline">Archivés</PekuloButton>
                </PekuloButtonGroup>
              </Subsection>

              <Subsection label="Vertical — ghost stack">
                <PekuloButtonGroup orientation="vertical">
                  <PekuloButton variant="ghost">Profil</PekuloButton>
                  <PekuloButton variant="ghost">Paramètres</PekuloButton>
                  <PekuloButton variant="ghost">Déconnexion</PekuloButton>
                </PekuloButtonGroup>
              </Subsection>
            </Section>

            {/* SUBMIT BUTTON */}
            <Section
              id="submit-button"
              title="SubmitButton"
              tagline="Form pill — variant primary/danger + 44px WCAG touch target"
            >
              <Subsection label="Primary — default · loading · disabled">
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
                  <PekuloSubmitButton>Ajouter le bien</PekuloSubmitButton>
                  <PekuloSubmitButton loading loadingLabel="Ajout…">
                    Ajouter le bien
                  </PekuloSubmitButton>
                  <PekuloSubmitButton disabled>Ajouter le bien</PekuloSubmitButton>
                </div>
              </Subsection>
              <Subsection label="Danger variant">
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
                  <PekuloSubmitButton variant="danger">Supprimer définitivement</PekuloSubmitButton>
                  <PekuloSubmitButton variant="danger" loading loadingLabel="Suppression…">
                    Supprimer définitivement
                  </PekuloSubmitButton>
                </div>
              </Subsection>
              <Subsection label="Compact — fullWidth=false">
                <PekuloSubmitButton type="button" fullWidth={false}>
                  Compact action
                </PekuloSubmitButton>
              </Subsection>
            </Section>

            {/* FIELD */}
            <Section
              id="field"
              title="Field family"
              tagline="FieldSet · Legend · Group · Field · Label · Title · Description · Error · Separator · Content"
            >
              <Subsection label="Default — label + input + description">
                <PekuloField>
                  <PekuloFieldLabel htmlFor="f-default">Libellé</PekuloFieldLabel>
                  <PekuloInput id="f-default" defaultValue="Alex" />
                  <PekuloFieldDescription>
                    Description optionnelle sous le champ.
                  </PekuloFieldDescription>
                </PekuloField>
              </Subsection>

              <Subsection label="Invalid — FieldError children (manual message)">
                <PekuloField invalid>
                  <PekuloFieldLabel htmlFor="f-invalid-1">Email</PekuloFieldLabel>
                  <PekuloInput id="f-invalid-1" type="email" defaultValue="not-an-email" invalid />
                  <PekuloFieldError>Adresse e-mail invalide.</PekuloFieldError>
                </PekuloField>
              </Subsection>

              <Subsection label="Invalid — FieldError errors[] with dedupe">
                <PekuloField invalid>
                  <PekuloFieldLabel htmlFor="f-invalid-2">Mot de passe</PekuloFieldLabel>
                  <PekuloInput id="f-invalid-2" type="password" defaultValue="abc" invalid />
                  <PekuloFieldError
                    errors={[
                      { message: "Requis" },
                      { message: "Requis" },
                      { message: "Trop court (min 8)" },
                      { message: "Au moins 1 chiffre" },
                    ]}
                  />
                </PekuloField>
              </Subsection>

              <Subsection label="Disabled — opacity + pointer-events">
                <PekuloField disabled>
                  <PekuloFieldLabel htmlFor="f-disabled">Code (verrouillé)</PekuloFieldLabel>
                  <PekuloInput id="f-disabled" defaultValue="LOCKED-42" disabled />
                  <PekuloFieldDescription>
                    Ce champ est verrouillé par l'admin.
                  </PekuloFieldDescription>
                </PekuloField>
              </Subsection>

              <Subsection label="Horizontal orientation — label + checkbox inline">
                <PekuloField orientation="horizontal">
                  <PekuloFieldLabel htmlFor="f-h-1">Activer les notifications</PekuloFieldLabel>
                  <PekuloNativeCheckbox id="f-h-1" defaultChecked />
                </PekuloField>
              </Subsection>

              <Subsection label="Responsive orientation — vertical < lg, horizontal ≥ lg">
                <PekuloField orientation="responsive">
                  <PekuloFieldLabel htmlFor="f-r-1">Nom complet</PekuloFieldLabel>
                  <PekuloInput id="f-r-1" defaultValue="Alex Pekulo" />
                </PekuloField>
              </Subsection>

              <Subsection label="Title + Content — non-label group avec controls imbriqués">
                <PekuloField>
                  <PekuloFieldTitle>Préférences de notification</PekuloFieldTitle>
                  <PekuloFieldDescription>
                    Choisis ce qui te concerne — modifiable à tout moment.
                  </PekuloFieldDescription>
                  <PekuloFieldContent>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <PekuloNativeCheckbox id="f-cnt-news" />
                      <PekuloFieldLabel htmlFor="f-cnt-news">Newsletter</PekuloFieldLabel>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <PekuloNativeCheckbox id="f-cnt-alerts" defaultChecked />
                      <PekuloFieldLabel htmlFor="f-cnt-alerts">Alertes seuils</PekuloFieldLabel>
                    </div>
                  </PekuloFieldContent>
                </PekuloField>
              </Subsection>

              <Subsection label="FieldSet + Legend + Group + Separator">
                <PekuloFieldSet>
                  <PekuloFieldLegend>Profil utilisateur</PekuloFieldLegend>
                  <PekuloFieldDescription>
                    Légende (variant=legend) + description + group avec séparateur.
                  </PekuloFieldDescription>
                  <PekuloFieldGroup>
                    <PekuloField>
                      <PekuloFieldLabel htmlFor="fs-1">Nom</PekuloFieldLabel>
                      <PekuloInput id="fs-1" defaultValue="Alex" />
                    </PekuloField>
                    <PekuloField>
                      <PekuloFieldLabel htmlFor="fs-2">Email</PekuloFieldLabel>
                      <PekuloInput id="fs-2" type="email" defaultValue="alex@pekulo.fr" />
                    </PekuloField>
                    <PekuloFieldSeparator>ou</PekuloFieldSeparator>
                    <PekuloField>
                      <PekuloFieldLabel htmlFor="fs-3">Téléphone</PekuloFieldLabel>
                      <PekuloInput id="fs-3" type="tel" defaultValue="+33 6 12 34 56 78" />
                    </PekuloField>
                  </PekuloFieldGroup>
                </PekuloFieldSet>
              </Subsection>

              <Subsection label="Legend variant=label (sous-groupe compact)">
                <PekuloFieldSet>
                  <PekuloFieldLegend variant="label">Adresse de facturation</PekuloFieldLegend>
                  <PekuloFieldGroup>
                    <PekuloField>
                      <PekuloFieldLabel htmlFor="fsl-1">Ligne 1</PekuloFieldLabel>
                      <PekuloInput id="fsl-1" />
                    </PekuloField>
                  </PekuloFieldGroup>
                </PekuloFieldSet>
              </Subsection>
            </Section>

            {/* INPUTS */}
            <Section
              id="inputs"
              title="Form inputs"
              tagline="Input · Textarea · NativeSelect · NativeCheckbox — tous les states"
            >
              <Subsection label="Input — controlSize sm vs md">
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320 }}>
                  <PekuloInput placeholder="md (default)" />
                  <PekuloInput controlSize="sm" placeholder="sm (compact)" />
                </div>
              </Subsection>

              <Subsection label="Input — types text / number / date / email / password">
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320 }}>
                  <PekuloInput type="text" placeholder="Texte" />
                  <PekuloInput type="number" defaultValue="42" />
                  <PekuloInput type="date" defaultValue="2026-05-22" />
                  <PekuloInput type="email" placeholder="alex@pekulo.fr" />
                  <PekuloInput type="password" defaultValue="hunter2" />
                </div>
              </Subsection>

              <Subsection label="Input — states default · invalid · disabled · readOnly">
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320 }}>
                  <PekuloInput placeholder="Default" />
                  <PekuloInput defaultValue="Tab here to focus" />
                  <PekuloInput defaultValue="invalid value" invalid />
                  <PekuloInput defaultValue="disabled" disabled />
                  <PekuloInput defaultValue="readonly" readOnly aria-readonly={true} />
                </div>
              </Subsection>

              <Subsection label="Textarea — default · invalid · disabled">
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
                  <PekuloTextarea placeholder="Notes…" />
                  <PekuloTextarea defaultValue="Trop court — invalide" invalid />
                  <PekuloTextarea defaultValue="Verrouillé" disabled />
                </div>
              </Subsection>

              <Subsection label="NativeSelect — controlSize sm / md + invalid + disabled">
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320 }}>
                  <PekuloNativeSelect defaultValue="a">
                    <option value="a">Option A (md default)</option>
                    <option value="b">Option B</option>
                  </PekuloNativeSelect>
                  <PekuloNativeSelect controlSize="sm" defaultValue="a">
                    <option value="a">Option A (sm)</option>
                    <option value="b">Option B</option>
                  </PekuloNativeSelect>
                  <PekuloNativeSelect defaultValue="a" invalid>
                    <option value="a">Invalid state</option>
                  </PekuloNativeSelect>
                  <PekuloNativeSelect defaultValue="a" disabled>
                    <option value="a">Disabled</option>
                  </PekuloNativeSelect>
                </div>
              </Subsection>

              <Subsection label="NativeCheckbox — sizes + checked / disabled">
                <Row>
                  <PekuloNativeCheckbox size={16} />
                  <PekuloNativeCheckbox size={20} defaultChecked />
                  <PekuloNativeCheckbox size={24} defaultChecked />
                  <PekuloNativeCheckbox size={20} disabled />
                  <PekuloNativeCheckbox size={20} disabled defaultChecked />
                </Row>
              </Subsection>
            </Section>

            {/* LABEL */}
            <Section
              id="label"
              title="Label (standalone)"
              tagline="Pour les controls isolés (hors PekuloField)"
            >
              <Subsection label="Avec checkbox isolé">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <PekuloNativeCheckbox id="dev-news" />
                  <PekuloLabel htmlFor="dev-news">M'envoyer la newsletter mensuelle</PekuloLabel>
                </div>
              </Subsection>
              <Subsection label="Disabled — via ancestor data-disabled=true">
                <div
                  data-disabled="true"
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <PekuloNativeCheckbox id="dev-news-disabled" disabled />
                  <PekuloLabel htmlFor="dev-news-disabled">Désactivé via data-disabled</PekuloLabel>
                </div>
              </Subsection>
            </Section>

            {/* CARDS */}
            <Section
              id="cards"
              title="Cards"
              tagline="Card + Header + Title + Description + Action + Content + Footer"
            >
              <Subsection label="Default size — full composition">
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
                      Capital projeté :{" "}
                      <b
                        style={{
                          color: "var(--color)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        1 245 000 €
                      </b>
                    </p>
                  </PekuloCardContent>
                  <PekuloCardFooter>
                    <PekuloButton variant="outline" size="sm">
                      Détails
                    </PekuloButton>
                    <PekuloButton size="sm">Valider</PekuloButton>
                  </PekuloCardFooter>
                </PekuloCard>
              </Subsection>

              <Subsection label="Size=sm — KPI compact">
                <PekuloCard size="sm">
                  <PekuloCardHeader>
                    <PekuloCardTitle>Total liquide</PekuloCardTitle>
                  </PekuloCardHeader>
                  <PekuloCardContent>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 24,
                        fontWeight: 600,
                        color: "var(--color)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      72 200 €
                    </p>
                  </PekuloCardContent>
                </PekuloCard>
              </Subsection>

              <Subsection label="Card minimal — header only">
                <PekuloCard>
                  <PekuloCardHeader>
                    <PekuloCardTitle>Card sans pied</PekuloCardTitle>
                    <PekuloCardDescription>
                      Description seule, pas d'action ni de footer.
                    </PekuloCardDescription>
                  </PekuloCardHeader>
                </PekuloCard>
              </Subsection>
            </Section>

            {/* EMPTY */}
            <Section
              id="empty"
              title="Empty state"
              tagline="Empty + Header + Media + Title + Description + Content — outlined vs solid"
            >
              <Subsection label="Outlined — icon + CTA">
                <PekuloEmpty outlined>
                  <PekuloEmptyHeader>
                    <PekuloEmptyMedia variant="icon">
                      <Folder size={16} aria-hidden={true} />
                    </PekuloEmptyMedia>
                    <PekuloEmptyTitle>Aucun bien immobilier</PekuloEmptyTitle>
                    <PekuloEmptyDescription>
                      Tu n'as pas encore ajouté de bien. Clique « Ajouter » pour créer le premier.
                    </PekuloEmptyDescription>
                  </PekuloEmptyHeader>
                  <PekuloEmptyContent>
                    <PekuloButton size="sm">Ajouter un bien</PekuloButton>
                  </PekuloEmptyContent>
                </PekuloEmpty>
              </Subsection>

              <Subsection label="Solid — Media variant=default (illustration)">
                <PekuloEmpty>
                  <PekuloEmptyHeader>
                    <PekuloEmptyMedia variant="default">
                      <Cloud size={32} color="var(--colorTertiary)" aria-hidden={true} />
                    </PekuloEmptyMedia>
                    <PekuloEmptyTitle>Storage vide</PekuloEmptyTitle>
                    <PekuloEmptyDescription>
                      Aucun fichier n'a été uploadé. Lance la sync pour rapatrier l'historique.
                    </PekuloEmptyDescription>
                  </PekuloEmptyHeader>
                  <PekuloEmptyContent>
                    <PekuloButton variant="outline" size="sm">
                      Synchroniser
                    </PekuloButton>
                  </PekuloEmptyContent>
                </PekuloEmpty>
              </Subsection>
            </Section>

            {/* BREADCRUMB */}
            <Section
              id="breadcrumb"
              title="Breadcrumb"
              tagline="nav · list · item · link · page · separator · ellipsis"
            >
              <Subsection label="Standard — 3 niveaux">
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
                      <PekuloBreadcrumbPage>Détails</PekuloBreadcrumbPage>
                    </PekuloBreadcrumbItem>
                  </PekuloBreadcrumbList>
                </PekuloBreadcrumb>
              </Subsection>

              <Subsection label="Avec ellipsis — chemin tronqué">
                <PekuloBreadcrumb>
                  <PekuloBreadcrumbList>
                    <PekuloBreadcrumbItem>
                      <PekuloBreadcrumbLink href="/dashboard">Dashboard</PekuloBreadcrumbLink>
                    </PekuloBreadcrumbItem>
                    <PekuloBreadcrumbSeparator />
                    <PekuloBreadcrumbItem>
                      <PekuloBreadcrumbEllipsis />
                    </PekuloBreadcrumbItem>
                    <PekuloBreadcrumbSeparator />
                    <PekuloBreadcrumbItem>
                      <PekuloBreadcrumbLink href="/dashboard/immobilier">
                        Immobilier
                      </PekuloBreadcrumbLink>
                    </PekuloBreadcrumbItem>
                    <PekuloBreadcrumbSeparator />
                    <PekuloBreadcrumbItem>
                      <PekuloBreadcrumbPage>Appartement</PekuloBreadcrumbPage>
                    </PekuloBreadcrumbItem>
                  </PekuloBreadcrumbList>
                </PekuloBreadcrumb>
              </Subsection>
            </Section>

            {/* CALENDAR */}
            <Section
              id="calendar"
              title="Calendar"
              tagline="react-day-picker — Pekulo theme via CSS custom properties"
            >
              <Subsection label="Mode single">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <PekuloCalendar mode="single" selected={date} onSelect={setDate} />
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "var(--colorTertiary)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    Sélectionné : {date ? date.toLocaleDateString("fr-FR") : "—"}
                  </p>
                </div>
              </Subsection>
            </Section>

            {/* DATE PICKER */}
            <Section
              id="datepicker"
              title="DatePicker (pre-composed)"
              tagline="Popover + Calendar + trigger pill (single + range)"
            >
              <Subsection label="Mode single — fr-FR format par défaut">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <PekuloDatePicker value={datePickerSingle} onChange={setDatePickerSingle} />
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "var(--colorTertiary)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    Value : {datePickerSingle ? datePickerSingle.toLocaleDateString("fr-FR") : "—"}
                  </p>
                </div>
              </Subsection>

              <Subsection label="Mode range — 2 mois côte-à-côte">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <PekuloDatePicker
                    mode="range"
                    value={datePickerRange}
                    onChange={setDatePickerRange}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "var(--colorTertiary)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    De {datePickerRange?.from?.toLocaleDateString("fr-FR") ?? "—"} →{" "}
                    {datePickerRange?.to?.toLocaleDateString("fr-FR") ?? "—"}
                  </p>
                </div>
              </Subsection>

              <Subsection label="Disabled">
                <PekuloDatePicker value={undefined} onChange={() => {}} disabled />
              </Subsection>
            </Section>

            {/* RESIZABLE */}
            <Section
              id="resizable"
              title="Resizable panels"
              tagline="react-resizable-panels — drag the divider to redistribute"
            >
              <Subsection label="Horizontal — 2 panels + handle (withHandle)">
                <div
                  style={{
                    height: 220,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid var(--borderDefault)",
                  }}
                >
                  <PekuloResizablePanelGroup orientation="horizontal">
                    <PekuloResizablePanel defaultSize={50} minSize={20}>
                      <div
                        style={{
                          padding: 16,
                          height: "100%",
                          backgroundColor: "var(--backgroundCard)",
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Panel A</h3>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 12,
                            color: "var(--colorTertiary)",
                          }}
                        >
                          Drag the divider →
                        </p>
                      </div>
                    </PekuloResizablePanel>
                    <PekuloResizableHandle withHandle />
                    <PekuloResizablePanel defaultSize={50} minSize={20}>
                      <div
                        style={{
                          padding: 16,
                          height: "100%",
                          backgroundColor: "var(--backgroundElevated)",
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Panel B</h3>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 12,
                            color: "var(--colorTertiary)",
                          }}
                        >
                          I shrink/grow accordingly.
                        </p>
                      </div>
                    </PekuloResizablePanel>
                  </PekuloResizablePanelGroup>
                </div>
              </Subsection>

              <Subsection label="Vertical — 2 panels stacked">
                <div
                  style={{
                    height: 280,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid var(--borderDefault)",
                  }}
                >
                  <PekuloResizablePanelGroup orientation="vertical">
                    <PekuloResizablePanel defaultSize={40} minSize={15}>
                      <div
                        style={{
                          padding: 16,
                          height: "100%",
                          backgroundColor: "var(--backgroundCard)",
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Top</h3>
                      </div>
                    </PekuloResizablePanel>
                    <PekuloResizableHandle withHandle />
                    <PekuloResizablePanel defaultSize={60} minSize={20}>
                      <div
                        style={{
                          padding: 16,
                          height: "100%",
                          backgroundColor: "var(--backgroundElevated)",
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Bottom</h3>
                      </div>
                    </PekuloResizablePanel>
                  </PekuloResizablePanelGroup>
                </div>
              </Subsection>
            </Section>

            {/* OVERLAYS */}
            <Section
              id="overlays"
              title="Overlays"
              tagline="PekuloDialog (Tamagui modal centré) · PekuloDrawer (vaul bottom sheet)"
            >
              <Subsection label="Triggers">
                <Row>
                  <PekuloButton onClick={() => setDialogOpen(true)}>
                    <SettingsIcon size={14} aria-hidden={true} /> Open Dialog
                  </PekuloButton>
                  <PekuloButton variant="secondary" onClick={() => setDrawerOpen(true)}>
                    Open Drawer (bottom sheet)
                  </PekuloButton>
                </Row>
              </Subsection>

              <PekuloDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <PekuloDialog.Portal>
                  <PekuloDialog.Overlay />
                  <PekuloDialog.Content>
                    <PekuloDialog.Title>Exemple Dialog</PekuloDialog.Title>
                    <PekuloDialog.Description>
                      Modal centré, Tamagui-based. Bonne pour les confirmations critiques. Tab pour
                      cycler les boutons, Escape pour fermer.
                    </PekuloDialog.Description>
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        marginTop: 16,
                        justifyContent: "flex-end",
                      }}
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
            </Section>

            <footer
              style={{
                padding: "24px 0",
                fontSize: 12,
                color: "var(--colorTertiary)",
                textAlign: "center",
              }}
            >
              Pekulo DS · PR #89 · feature/26-4-3-realestate-ui · DEV-ONLY route
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
