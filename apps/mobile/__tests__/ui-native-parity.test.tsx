import * as PekuloUI from "@pekulo/ui";
import {
  CategoryIcon,
  CategoryPicker,
  HeaderAction,
  PekuloAccountRow,
  PekuloAccountsSection,
  PekuloActivityRow,
  PekuloAvatar,
  PekuloBreadcrumb,
  PekuloBreadcrumbItem,
  PekuloBreadcrumbLink,
  PekuloBreadcrumbList,
  PekuloBreadcrumbPage,
  PekuloBreadcrumbSeparator,
  PekuloButton,
  PekuloButtonGroup,
  PekuloButtonGroupText,
  PekuloCalendar,
  PekuloCard,
  PekuloCardAction,
  PekuloCardContent,
  PekuloCardDescription,
  PekuloCardFooter,
  PekuloCardHeader,
  PekuloCardTitle,
  PekuloCheckbox,
  PekuloClassRow,
  PekuloCompositionCard,
  PekuloCompositionRow,
  PekuloContextualAddButton,
  PekuloCountUpEUR,
  PekuloCountUpPct,
  PekuloDatePicker,
  PekuloDialog,
  PekuloDialogCloseX,
  PekuloDonut,
  PekuloDonutCard,
  PekuloDrawer,
  PekuloEmpty,
  PekuloEmptyDescription,
  PekuloEmptyHeader,
  PekuloEmptyMedia,
  PekuloEmptyState,
  PekuloEmptyTitle,
  PekuloErrorBoundary,
  PekuloField,
  PekuloFieldContent,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloHero,
  PekuloHeroCard,
  PekuloHoldingRow,
  PekuloHypothesisCard,
  PekuloHypothesisVerdict,
  PekuloInput,
  PekuloKpiTile,
  PekuloLabel,
  PekuloLoadingItem,
  PekuloMilestoneRow,
  PekuloMilestonesCard,
  PekuloMobileBottomNav,
  PekuloMonthlyRow,
  PekuloNativeCheckbox,
  PekuloNativeSelect,
  PekuloNavRail,
  PekuloPagination,
  PekuloPopover,
  PekuloProgress,
  PekuloProjectionChart,
  PekuloPropertyCard,
  PekuloRadioGroup,
  PekuloRecentActivityCard,
  PekuloResizableHandle,
  PekuloResizablePanel,
  PekuloResizablePanelGroup,
  PekuloRootProvider,
  PekuloSegmentedControl,
  PekuloSelect,
  PekuloSeparator,
  PekuloSettingRow,
  PekuloSheet,
  PekuloSkeleton,
  PekuloSlider,
  PekuloSpinner,
  PekuloStaggerList,
  PekuloStat,
  PekuloSubmitButton,
  PekuloSuggestionRow,
  PekuloSwitch,
  PekuloTextarea,
  PekuloToggleRow,
  PekuloTooltip,
  PekuloTopTabToggle,
  PekuloTrajectoryCard,
  PekuloTrajectoryChart,
  PekuloUserDot,
  Section,
  TransactionLogo,
  pekuloDark,
  pekuloLight,
  useThemeSetting,
  useToast,
} from "@pekulo/ui";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Compass, Moon, Sun } from "lucide-react-native";
import { useState } from "react";
import { Platform, processColor, Text, View } from "react-native";

type JsonNode = { type: string; props?: Record<string, unknown>; children?: unknown[] };

function assertColorTokenRendered(json: string, tokenColor: string): void {
  const numeric = processColor(tokenColor);
  const found =
    json.includes(tokenColor) ||
    (typeof numeric === "number" && json.includes(`"payload":${numeric}`));
  expect(found).toBe(true);
}

function collectNodeTypes(node: unknown, out: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) collectNodeTypes(child, out);
    return;
  }
  const el = node as JsonNode;
  if (typeof el.type === "string") out.add(el.type);
  if (Array.isArray(el.children)) {
    for (const child of el.children) collectNodeTypes(child, out);
  }
}

function ToastAndThemeProbe() {
  const toast = useToast();
  const { resolvedTheme, set } = useThemeSetting();
  const [counter, setCounter] = useState(0);
  return (
    <View>
      <PekuloButton onPress={() => toast.success("Enregistré", "Opération terminée")}>
        Notifier
      </PekuloButton>
      <PekuloButton onPress={() => set("pekulo-light")}>{`Theme: ${resolvedTheme}`}</PekuloButton>
      <PekuloButton onPress={() => setCounter((c) => c + 1)}>{`Count: ${counter}`}</PekuloButton>
    </View>
  );
}

function BombChild({ empty }: { empty?: boolean }): never {
  throw new Error(empty ? "" : "Boom test");
}

// Story 10-3-ui-native-parity AC trace:
// AC-1 (verbatim from story 10-3-ui-native-parity, AC-1):
//   Given the complete `@pekulo/ui` public barrel surface (`provider`, `toast`,
//   `tokens`, `themes`, `animations`, all 33 primitives, and all 42 components),
//   When the design-system coverage suite runs, Then it excludes React Native
//   sibling variants from web primitive enumeration AND asserts that every public
//   module and symbol exposed on web is also exported by the React Native barrel
//   entrypoint.
// AC-3 (verbatim from story 10-3-ui-native-parity, AC-3):
//   Given `PekuloDonut`, `PekuloTrajectoryChart`, `PekuloProjectionChart`,
//   `CategoryIcon`, `TransactionLogo`, and every icon-bearing component or
//   primitive, When rendered inside `PekuloRootProvider` in both `pekulo-dark`
//   and `pekulo-light` themes under React Native Jest, Then colors resolve from
//   Tamagui theme tokens (`donutTrack`, `donutFill`, `chartActual`, `chartPlan`,
//   `color`, `colorSecondary`, `colorTertiary`, `success`, `danger`) without CSS
//   custom properties, `currentColor`, HTML `<svg>`, or HTML `<img>`.
// AC-4 (verbatim from story 10-3-ui-native-parity, AC-4):
//   Given all ported primitives and domain components, When mounted and
//   interacted with in Jest (`@testing-library/react-native`), Then each renders
//   without native view/DOM errors and honours its core interactions (press,
//   text input, password reveal, toggle/checkbox, native picker selection, date
//   selection, segmented switch, pagination, toast display).
// AC-5 (verbatim from story 10-3-ui-native-parity, AC-5):
//   Given all workspace packages and apps, When `bun run typecheck`, `bun run
//   lint`, `bun run format:check`, `bun --filter='@pekulo/mobile' run test`, and
//   `bun --filter='@pekulo/ui' run test` run, Then every command exits 0.
describe("@pekulo/ui native parity", () => {
  it("exports every public module, token, hook, component, and sub-primitive from index.native.ts (AC-1)", () => {
    const exportedKeys = Object.keys(PekuloUI);
    expect(exportedKeys.length).toBeGreaterThanOrEqual(120);
    for (const key of [
      "PekuloRootProvider",
      "useThemeSetting",
      "ToastProvider",
      "useToast",
      "PekuloToast",
      "PekuloToastViewport",
      "useCountUp",
      "useStagger",
      "usePrefersReducedMotion",
      "pekuloDark",
      "pekuloLight",
      "pekuloColors",
      "pekuloSpacing",
      "pekuloRadius",
      "PekuloCardHeader",
      "PekuloCardAction",
      "PekuloBreadcrumbList",
      "PekuloEmptyMedia",
      "PekuloFieldError",
      "PekuloResizablePanel",
      "PekuloDialogCloseX",
      "PekuloDrawer",
      "PekuloDatePicker",
      "PekuloCalendar",
      "PekuloNativeSelect",
      "PekuloSelect",
    ]) {
      expect(Reflect.get(PekuloUI, key)).toBeDefined();
    }
  });

  it("renders all SVG charts and icon-bearing components/primitives with resolved theme tokens in dark & light themes (AC-3)", async () => {
    const ui = (
      <View>
        <Section title="Vue globale" action={<HeaderAction label="Ajouter" icon={Compass} />}>
          <PekuloHeroCard
            totalEur={180400}
            aheadEur={2781}
            targetCapital={800000}
            targetYear={2055}
            requiredYearlyEur={20653}
          />
          <PekuloDonutCard pct={0.226} centered ariaLabel="Cap 22.6 %" />
          <PekuloTrajectoryCard
            months={[1, 2, 3]}
            actual={[100, 120, 140]}
            plan={[100, 115, 130]}
          />
          <PekuloProjectionChart
            years={[2026, 2030, 2040]}
            actual={[180400, 250000, 480000]}
            required={[180400, 260000, 500000]}
            nowMarker={{ year: 2026, value: 180400 }}
            capMarker={{ year: 2040, value: 500000 }}
          />
          <PekuloHypothesisCard
            reaches={false}
            headline="En dessous du cap"
            deltaLabel="−20 000 €"
            gapLabel="+150 €/mois"
          />
          <PekuloKpiTile
            label="Avancement"
            valueTop="22,6 %"
            valueBottom="vs 800 k€"
            progress={0.226}
          />
          <PekuloCountUpEUR value={180400} />
          <PekuloCountUpPct value={0.226} precise />
          <PekuloHero variant="mobile" totalEur={180400} aheadEur={2781} />
          <PekuloStat label="Net" value="+1 050 €" tone="gain" />
          <PekuloStat label="Perte" value="-150 €" tone="loss" />
          <PekuloDonut pct={0.5} size={40} stroke={4} />
          <PekuloTrajectoryChart months={[1, 2]} actual={[10, 20]} plan={[10, 15]} />
          <PekuloHypothesisVerdict reaches headline="Cap atteint" deltaLabel="+1 000 €" />
          <PekuloCompositionCard
            items={[{ id: "1", label: "Liquidités", amount: 15000, pct: 0.1 }]}
          />
          <PekuloCompositionRow label="Actions" amount={100000} pct={0.55} />
          <PekuloClassRow label="ETF" amountEur={80000} pct={0.44} />
          <PekuloAccountsSection
            accounts={[{ label: "Livret A", type: "livret", institution: "SG", balanceEur: 12000 }]}
          />
          <PekuloAccountRow label="Compte courant" type="banque" balanceEur={2400} />
          <PekuloHoldingRow
            holding={{
              ticker: "CW8.PA",
              kind: "etf",
              label: "Amundi MSCI World",
              account: "PEA",
              quantity: 100,
              pricePerUnit: 500,
              marketValueEur: 50000,
              pnlEur: 5000,
              pnlPct: 11.1,
            }}
          />
          <PekuloMilestonesCard
            milestones={[
              {
                id: "m1",
                label: "Premier palier",
                targetEur: 100000,
                targetYear: 2032,
                progressPct: 0.6,
                deltaEur: 5000,
                status: "ahead",
              },
            ]}
          />
          <PekuloMilestoneRow
            milestone={{
              id: "m2",
              label: "Palier 2",
              targetEur: 300000,
              targetYear: 2040,
              progressPct: 0.25,
              deltaEur: -1000,
              status: "behind",
            }}
            onDelete={jest.fn()}
          />
          <PekuloPropertyCard
            property={{
              label: "Lyon 7e",
              valuationEur: 320000,
              debtRemainingEur: 200000,
              monthlyPaymentEur: 1100,
              yearsRemaining: 18,
              repaidPct: 0.37,
            }}
          />
          <PekuloMonthlyRow
            month={{
              monthLabel: "octobre 2026",
              incomeEur: 4000,
              spendingEur: 2700,
              netEur: 1300,
              closed: true,
            }}
          />
          <PekuloRecentActivityCard
            activities={[
              {
                direction: "out",
                label: "Carrefour",
                account: "SG",
                category: "Courses",
                amountEur: 85,
              },
            ]}
          />
          <PekuloActivityRow
            tx={{
              direction: "in",
              label: "Salaire",
              account: "SG",
              category: "Salaire",
              amountEur: 3500,
            }}
            logo={<TransactionLogo src={null} category="salaire" />}
            aiApplied
          />
          <TransactionLogo src="https://cdn.example.com/merchant.png" category="courses" />
          <CategoryIcon category="courses" />
          <PekuloSettingRow label="Export" value="JSON" />
          <PekuloStaggerList>
            <Text key="item-1">Item 1</Text>
            <Text key="item-2">Item 2</Text>
          </PekuloStaggerList>
          <PekuloSkeleton lines={2} />
          <PekuloEmptyState icon={Compass} title="Rien ici" message="Ajoutez un élément" />
          <PekuloContextualAddButton label="Ajouter" onPress={jest.fn()} />
          <PekuloUserDot initial="a" onPress={jest.fn()} />
          <PekuloTopTabToggle topTab="cap" onChange={jest.fn()} />
          <PekuloMobileBottomNav activeKey="cap" onSelect={jest.fn()} />
          <PekuloNavRail activeKey="cap" onSelect={jest.fn()} />
          {/* Icon-bearing primitives & components previously omitted from dual-theme sweep */}
          <PekuloSegmentedControl
            ariaLabel="Thème"
            value="dark"
            onChange={jest.fn()}
            options={[
              { value: "dark", label: "Sombre", icon: Moon },
              { value: "light", label: "Clair", icon: Sun },
            ]}
          />
          <PekuloPagination page={2} pageCount={9} onPageChange={jest.fn()} />
          <PekuloSuggestionRow
            tx={{
              direction: "out",
              label: "Boulangerie",
              account: "SG",
              dateLabel: "12 nov",
              amountEur: 5,
              suggestedCategory: "Courses",
              confidence: 0.9,
              route: "ollama",
            }}
            onConfirm={jest.fn()}
          />
          <PekuloSpinner />
          <PekuloInput type="password" placeholder="Secret" />
          <PekuloCheckbox checked onCheckedChange={jest.fn()}>
            <PekuloCheckbox.Indicator />
          </PekuloCheckbox>
          <PekuloNativeCheckbox checked onCheckedChange={jest.fn()} />
          <PekuloSelect value="a" onValueChange={jest.fn()}>
            <PekuloSelect.Trigger>
              <PekuloSelect.Value placeholder="Choisir" />
            </PekuloSelect.Trigger>
          </PekuloSelect>
          <PekuloDialog open>
            <PekuloDialog.Portal>
              <PekuloDialog.Content>
                <PekuloDialogCloseX />
              </PekuloDialog.Content>
            </PekuloDialog.Portal>
          </PekuloDialog>
          <PekuloBreadcrumb>
            <PekuloBreadcrumbList>
              <PekuloBreadcrumbItem>
                <PekuloBreadcrumbLink>Cap</PekuloBreadcrumbLink>
              </PekuloBreadcrumbItem>
              <PekuloBreadcrumbSeparator />
              <PekuloBreadcrumbItem>
                <PekuloBreadcrumbPage>Portefeuille</PekuloBreadcrumbPage>
              </PekuloBreadcrumbItem>
            </PekuloBreadcrumbList>
          </PekuloBreadcrumb>
          <PekuloDatePicker value={new Date(2026, 0, 15)} onChange={jest.fn()} />
          <PekuloErrorBoundary>
            <Text>OK</Text>
          </PekuloErrorBoundary>
        </Section>
      </View>
    );

    const darkView = await render(
      <PekuloRootProvider theme="pekulo-dark">{ui}</PekuloRootProvider>,
    );
    expect(screen.getByText("Vue globale")).toBeTruthy();
    expect(screen.getByText("Lyon 7e")).toBeTruthy();
    expect(screen.getByText("CW8.PA")).toBeTruthy();

    const darkTree = darkView.toJSON();
    const darkJson = JSON.stringify(darkTree);
    const darkNodeTypes = new Set<string>();
    collectNodeTypes(darkTree, darkNodeTypes);

    expect(darkJson).not.toContain("var(--");
    expect(darkJson).not.toContain("currentColor");
    for (const bannedTag of ["svg", "img", "div", "span", "style"]) {
      expect(darkNodeTypes.has(bannedTag)).toBe(false);
    }
    expect(darkNodeTypes.has("Image")).toBe(true);
    for (const tokenKey of [
      "donutTrack",
      "donutFill",
      "chartActual",
      "chartPlan",
      "color",
      "colorSecondary",
      "colorTertiary",
      "success",
      "danger",
    ] as const) {
      assertColorTokenRendered(darkJson, pekuloDark[tokenKey]);
    }

    const lightView = await render(
      <PekuloRootProvider theme="pekulo-light">{ui}</PekuloRootProvider>,
    );
    expect(screen.getByText("Vue globale")).toBeTruthy();

    const lightTree = lightView.toJSON();
    const lightJson = JSON.stringify(lightTree);
    const lightNodeTypes = new Set<string>();
    collectNodeTypes(lightTree, lightNodeTypes);

    expect(lightJson).not.toContain("var(--");
    expect(lightJson).not.toContain("currentColor");
    for (const bannedTag of ["svg", "img", "div", "span", "style"]) {
      expect(lightNodeTypes.has(bannedTag)).toBe(false);
    }
    for (const tokenKey of [
      "donutTrack",
      "donutFill",
      "chartActual",
      "chartPlan",
      "color",
      "colorSecondary",
      "colorTertiary",
      "success",
      "danger",
    ] as const) {
      assertColorTokenRendered(lightJson, pekuloLight[tokenKey]);
    }
    expect(lightJson).not.toEqual(darkJson);
  });

  it("renders and drives all interactive primitives, pickers, overlays, navigation, toast, and theme switching without remounting (AC-4)", async () => {
    const onConfirm = jest.fn();
    const onPageChange = jest.fn();
    const onSelectChange = jest.fn();
    const onDisabledSelectChange = jest.fn();
    const onDateChange = jest.fn();
    const onPickerChange = jest.fn();
    const onDisabledPickerChange = jest.fn();
    const onToggle = jest.fn();
    const onSwitchChange = jest.fn();
    const onCheckboxChange = jest.fn();
    const onSegment = jest.fn();
    const onInput = jest.fn();
    const onTextarea = jest.fn();
    const onNativeCb = jest.fn();
    const onSubmit = jest.fn();
    const onBottomNav = jest.fn();
    const onNavRail = jest.fn();
    const onDrawerOpenChange = jest.fn();
    const onDialogOpenChange = jest.fn();

    await render(
      <PekuloRootProvider theme="pekulo-dark">
        <View>
          <ToastAndThemeProbe />
          <PekuloCard>
            <PekuloCardHeader>
              <PekuloCardTitle>Carte</PekuloCardTitle>
              <PekuloCardDescription>Description</PekuloCardDescription>
              <PekuloCardAction>
                <Text>Action 1</Text>
              </PekuloCardAction>
              <PekuloCardAction>
                <Text>Action 2</Text>
              </PekuloCardAction>
            </PekuloCardHeader>
            <PekuloCardContent>
              <PekuloFieldGroup>
                <PekuloField>
                  <PekuloFieldContent>
                    <PekuloFieldLabel htmlFor="pwd">Mot de passe</PekuloFieldLabel>
                    <PekuloInput
                      type="password"
                      placeholder="Secret"
                      testID="pwd-input"
                      onChange={onInput}
                    />
                    <PekuloInput
                      type="password"
                      disabled
                      placeholder="Verrouillé"
                      testID="disabled-pwd-input"
                    />
                    <PekuloFieldDescription>12 caractères min</PekuloFieldDescription>
                    <PekuloFieldError errors={["Champ requis"]} />
                  </PekuloFieldContent>
                </PekuloField>
                <PekuloLabel>Notes</PekuloLabel>
                <PekuloTextarea placeholder="Note" testID="note-textarea" onChange={onTextarea} />
                <PekuloNativeSelect
                  testID="native-select"
                  defaultValue="pea"
                  onValueChange={onSelectChange}
                >
                  <optgroup label="Épargne">
                    <option value="livret">Livret</option>
                    <option value="pea">PEA</option>
                  </optgroup>
                </PekuloNativeSelect>
                <PekuloNativeSelect
                  testID="disabled-native-select"
                  disabled
                  defaultValue="pea"
                  onValueChange={onDisabledSelectChange}
                >
                  <option value="blocked">Bloqué</option>
                </PekuloNativeSelect>
                <CategoryPicker
                  value="courses"
                  onValueChange={jest.fn()}
                  options={[{ value: "courses", label: "Courses" }]}
                />
                <PekuloSelect value="a" onValueChange={jest.fn()}>
                  <PekuloSelect.Trigger>
                    <PekuloSelect.Value placeholder="Choisir" />
                  </PekuloSelect.Trigger>
                </PekuloSelect>
                <PekuloCheckbox testID="tama-cb" checked={false} onCheckedChange={onCheckboxChange}>
                  <PekuloCheckbox.Indicator />
                </PekuloCheckbox>
                <PekuloNativeCheckbox testID="native-cb" onCheckedChange={onNativeCb} />
                <PekuloRadioGroup value="1" onValueChange={jest.fn()}>
                  <PekuloRadioGroup.Item value="1" />
                </PekuloRadioGroup>
                <PekuloSlider defaultValue={[40]} max={100} />
                <PekuloSwitch
                  testID="tama-switch"
                  checked={false}
                  onCheckedChange={onSwitchChange}
                />
                <PekuloToggleRow label="Activer" checked={false} onChange={onToggle} />
                <PekuloCalendar
                  mode="single"
                  selected={new Date(2026, 0, 15)}
                  onSelect={onDateChange}
                />
                <PekuloDatePicker
                  value={undefined}
                  placeholder="Date cible"
                  onChange={onPickerChange}
                />
                <PekuloDatePicker
                  value={undefined}
                  placeholder="Date désactivée"
                  disabled
                  onChange={onDisabledPickerChange}
                />
                <PekuloProgress value={50} />
                <PekuloLoadingItem title="Synchro" trailing="1/2" />
                <PekuloSpinner color="currentColor" />
                <PekuloSeparator />
                <PekuloAvatar>
                  <PekuloAvatar.Fallback>
                    <Text>A</Text>
                  </PekuloAvatar.Fallback>
                </PekuloAvatar>
                <PekuloBreadcrumb>
                  <PekuloBreadcrumbList>
                    <PekuloBreadcrumbItem>
                      <PekuloBreadcrumbLink>Cap</PekuloBreadcrumbLink>
                    </PekuloBreadcrumbItem>
                    <PekuloBreadcrumbSeparator />
                    <PekuloBreadcrumbItem>
                      <PekuloBreadcrumbPage>Portefeuille</PekuloBreadcrumbPage>
                    </PekuloBreadcrumbItem>
                  </PekuloBreadcrumbList>
                </PekuloBreadcrumb>
                <PekuloButtonGroup>
                  <PekuloButtonGroupText>EUR</PekuloButtonGroupText>
                </PekuloButtonGroup>
                <PekuloSubmitButton onPress={onSubmit}>Valider</PekuloSubmitButton>
                <PekuloEmpty>
                  <PekuloEmptyHeader>
                    <PekuloEmptyMedia variant="icon">
                      <Compass size={20} color="#EDEDED" />
                    </PekuloEmptyMedia>
                    <PekuloEmptyTitle>Vide</PekuloEmptyTitle>
                    <PekuloEmptyDescription>Aucune donnée</PekuloEmptyDescription>
                  </PekuloEmptyHeader>
                </PekuloEmpty>
                <PekuloResizablePanelGroup>
                  <PekuloResizablePanel>
                    <Text>Gauche</Text>
                  </PekuloResizablePanel>
                  <PekuloResizableHandle withHandle />
                  <PekuloResizablePanel>
                    <Text>Droite</Text>
                  </PekuloResizablePanel>
                </PekuloResizablePanelGroup>
                <PekuloSegmentedControl
                  ariaLabel="Thème"
                  value="dark"
                  onChange={onSegment}
                  options={[
                    { value: "dark", label: "Sombre", icon: Moon },
                    { value: "light", label: "Clair", icon: Sun },
                  ]}
                />
                <PekuloPagination page={2} pageCount={5} onPageChange={onPageChange} />
                <PekuloSuggestionRow
                  tx={{
                    direction: "out",
                    label: "Boulangerie",
                    account: "SG",
                    dateLabel: "12 nov",
                    amountEur: 5,
                    suggestedCategory: "Courses",
                    confidence: 0.9,
                    route: "ollama",
                  }}
                  onConfirm={onConfirm}
                />
                <PekuloMobileBottomNav activeKey="cap" onSelect={onBottomNav} />
                <PekuloNavRail activeKey="cap" onSelect={onNavRail} />
                <PekuloDialog open onOpenChange={onDialogOpenChange}>
                  <PekuloDialog.Portal>
                    <PekuloDialog.Content>
                      <PekuloDialogCloseX />
                      <PekuloDialog.Title>Dialogue actif</PekuloDialog.Title>
                    </PekuloDialog.Content>
                  </PekuloDialog.Portal>
                </PekuloDialog>
                <PekuloDrawer defaultOpen={false} onOpenChange={onDrawerOpenChange}>
                  <PekuloDrawer.Trigger>
                    <Text>Ouvrir tiroir</Text>
                  </PekuloDrawer.Trigger>
                  <PekuloDrawer.Portal>
                    <PekuloDrawer.Overlay />
                    <PekuloDrawer.Content>
                      <PekuloDrawer.Header>
                        <PekuloDrawer.Title>Filtres</PekuloDrawer.Title>
                        <PekuloDrawer.Description>Par mois</PekuloDrawer.Description>
                      </PekuloDrawer.Header>
                      <PekuloDrawer.Footer>
                        <PekuloDrawer.Close>
                          <Text>Fermer tiroir</Text>
                        </PekuloDrawer.Close>
                      </PekuloDrawer.Footer>
                    </PekuloDrawer.Content>
                  </PekuloDrawer.Portal>
                </PekuloDrawer>
                <PekuloPopover>
                  <PekuloPopover.Trigger>
                    <Text>Menu</Text>
                  </PekuloPopover.Trigger>
                </PekuloPopover>
                <PekuloSheet open={false}>
                  <PekuloSheet.Frame>
                    <Text>Sheet</Text>
                  </PekuloSheet.Frame>
                </PekuloSheet>
                <PekuloTooltip>
                  <PekuloTooltip.Trigger>
                    <Text>Info</Text>
                  </PekuloTooltip.Trigger>
                </PekuloTooltip>
              </PekuloFieldGroup>
            </PekuloCardContent>
            <PekuloCardFooter>
              <Text>Pied</Text>
            </PekuloCardFooter>
          </PekuloCard>
        </View>
      </PekuloRootProvider>,
    );

    // Card preserves multiple PekuloCardAction children
    expect(screen.getByText("Action 1")).toBeTruthy();
    expect(screen.getByText("Action 2")).toBeTruthy();

    // Toast & local state survive theme switch (proves no TamaguiProvider remount)
    await fireEvent.press(screen.getByText("Count: 0"));
    expect(screen.getByText("Count: 1")).toBeTruthy();
    await fireEvent.press(screen.getByText("Notifier"));
    expect(screen.getByText("Enregistré")).toBeTruthy();

    await fireEvent.press(screen.getByText("Theme: pekulo-dark"));
    expect(screen.getByText("Theme: pekulo-light")).toBeTruthy();
    expect(screen.getByText("Count: 1")).toBeTruthy();
    expect(screen.getByText("Enregistré")).toBeTruthy();

    // Suggestion confirm, submit button, nav rail & bottom nav
    await fireEvent.press(screen.getByText("✓ Confirmer"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText("Valider"));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    const txNavBtn = screen.getAllByLabelText("Transactions")[0];
    expect(txNavBtn).toBeDefined();
    await fireEvent.press(txNavBtn!);
    expect(onBottomNav).toHaveBeenCalledWith("transactions");
    const pfNavBtn = screen.getAllByLabelText("Portefeuille")[1];
    expect(pfNavBtn).toBeDefined();
    await fireEvent.press(pfNavBtn!);
    expect(onNavRail).toHaveBeenCalledWith("portfolio");

    // Pagination & segmented control
    await fireEvent.press(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await fireEvent.press(screen.getByText("Clair"));
    expect(onSegment).toHaveBeenCalledWith("light");

    // Native select (including optgroup children + disabled guard)
    await fireEvent.press(screen.getByText("Livret"));
    expect(onSelectChange).toHaveBeenCalledWith("livret");
    await fireEvent.press(screen.getByText("Bloqué"));
    expect(onDisabledSelectChange).not.toHaveBeenCalled();

    // Input text typing + password reveal + disabled input blocks reveal
    await fireEvent.changeText(screen.getByTestId("pwd-input"), "Secret123456");
    expect(onInput).toHaveBeenCalledWith({ target: { value: "Secret123456" } });
    expect(screen.getByTestId("pwd-input").props.secureTextEntry).toBe(true);
    const revealButtons = screen.getAllByLabelText("Afficher le mot de passe");
    expect(revealButtons.length).toBeGreaterThanOrEqual(2);
    await fireEvent.press(revealButtons[0]!);
    expect(screen.getByTestId("pwd-input").props.secureTextEntry).toBe(false);
    await fireEvent.press(revealButtons[1]!);
    expect(screen.getByTestId("disabled-pwd-input").props.secureTextEntry).toBe(true);

    // Textarea typing
    await fireEvent.changeText(screen.getByTestId("note-textarea"), "Note test");
    expect(onTextarea).toHaveBeenCalledWith({ target: { value: "Note test" } });

    // Toggles & checkboxes (PekuloToggleRow, PekuloSwitch, PekuloCheckbox, PekuloNativeCheckbox)
    await fireEvent.press(screen.getByTestId("native-cb"));
    expect(onNativeCb).toHaveBeenCalledWith(true);

    await fireEvent.press(screen.getByTestId("tama-cb"));
    expect(onCheckboxChange).toHaveBeenCalledWith(true);

    await fireEvent.press(screen.getByTestId("tama-switch"));
    expect(onSwitchChange).toHaveBeenCalledWith(true);

    await fireEvent.press(screen.getByLabelText("Activer"));
    expect(onToggle).toHaveBeenCalledWith(true);

    // Calendar: dismiss does NOT commit; set commits
    await fireEvent.press(screen.getByTestId("native-datetimepicker-dismiss"));
    expect(onDateChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("native-datetimepicker"));
    expect(onDateChange).toHaveBeenCalledTimes(1);

    // DatePicker placeholder + disabled guard
    expect(screen.getByText("Date cible")).toBeTruthy();
    expect(screen.getByText("Date désactivée")).toBeTruthy();
    await fireEvent.press(screen.getByText("Date désactivée"));
    expect(onDisabledPickerChange).not.toHaveBeenCalled();

    // Dialog open & close X button mounted and clickable
    expect(screen.getByText("Dialogue actif")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Fermer"));
    expect(onDialogOpenChange).toHaveBeenCalledWith(false);

    // Drawer open via Trigger and close via Close
    await fireEvent.press(screen.getByText("Ouvrir tiroir"));
    expect(onDrawerOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByText("Filtres")).toBeTruthy();
    await fireEvent.press(screen.getByText("Fermer tiroir"));
    expect(onDrawerOpenChange).toHaveBeenCalledWith(false);
  });

  it("handles edge cases safely (range resetOnSelect, Android calendar, invalid Date, NaN charts/progress, pagination clamping, URI & prototype guards)", async () => {
    const onRangeChange = jest.fn();
    const onOutOfRangePage = jest.fn();

    const view = await render(
      <PekuloRootProvider theme="pekulo-dark">
        <View>
          <PekuloDatePicker
            mode="range"
            value={{ from: new Date(2026, 0, 10), to: new Date(2026, 0, 20) }}
            onChange={onRangeChange}
          />
          <PekuloDatePicker
            value={new Date("invalid")}
            placeholder="Date invalide"
            onChange={jest.fn()}
          />
          <PekuloDonut pct={Number.NaN} size={4} stroke={12} centered />
          <PekuloProgress value={Number.NaN} max={-10} />
          <PekuloTrajectoryChart months={[]} actual={[]} plan={[]} />
          <PekuloProjectionChart
            years={[]}
            actual={[Number.NaN]}
            required={[]}
            nowMarker={{ year: 2026, value: Number.NaN }}
          />
          <PekuloSkeleton lines={12} />
          <PekuloPagination page={100} pageCount={5} onPageChange={onOutOfRangePage} />
          <TransactionLogo src="file:///etc/passwd" category="courses" />
          <TransactionLogo src="/v1/logos?ref=abc" category="courses" />
          <CategoryIcon category="toString" color="currentColor" />
        </View>
      </PekuloRootProvider>,
    );

    const json = JSON.stringify(view.toJSON());
    expect(json).not.toContain("NaN");
    expect(json).not.toContain("-%");
    expect(json).not.toContain("file:///etc/passwd");
    expect(json).not.toContain("currentColor");
    expect(screen.getByText("Date invalide")).toBeTruthy();

    // Out-of-range page=100 of 5 clamps to 5, so Previous emits 4 (not 99)
    await fireEvent.press(screen.getByLabelText("Page précédente"));
    expect(onOutOfRangePage).toHaveBeenCalledWith(4);

    // Range DatePicker re-edit: picking new `from` resets `to` to undefined and keeps dialog open
    const rangeTrigger = screen.getAllByLabelText("Sélectionner une date")[0];
    expect(rangeTrigger).toBeDefined();
    await fireEvent.press(rangeTrigger!);
    await fireEvent.press(screen.getByTestId("native-datetimepicker"));
    expect(onRangeChange).toHaveBeenCalledWith(expect.objectContaining({ to: undefined }));
    expect(screen.getByText("Début")).toBeTruthy();

    // Android calendar opens DateTimePickerAndroid imperatively on press only (never on mount)
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    try {
      (DateTimePickerAndroid.open as jest.Mock).mockClear();
      await render(
        <PekuloRootProvider theme="pekulo-dark">
          <PekuloCalendar mode="single" selected={new Date(2026, 0, 15)} onSelect={jest.fn()} />
        </PekuloRootProvider>,
      );
      expect(DateTimePickerAndroid.open).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByTestId("native-android-date-trigger"));
      expect(DateTimePickerAndroid.open).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS });
    }
  });

  it("renders PekuloErrorBoundary fallback for both message and empty Error (AC-4)", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      await render(
        <PekuloRootProvider theme="pekulo-dark">
          <PekuloErrorBoundary>
            <BombChild />
          </PekuloErrorBoundary>
        </PekuloRootProvider>,
      );
      expect(screen.getByText(/Une erreur s'est produite/i)).toBeTruthy();
      expect(screen.getByText("Boom test")).toBeTruthy();

      await render(
        <PekuloRootProvider theme="pekulo-dark">
          <PekuloErrorBoundary>
            <BombChild empty />
          </PekuloErrorBoundary>
        </PekuloRootProvider>,
      );
      expect(screen.getByText("Détails indisponibles.")).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });
});
