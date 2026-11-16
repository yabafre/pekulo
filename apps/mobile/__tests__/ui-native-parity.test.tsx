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
  useThemeSetting,
  useToast,
} from "@pekulo/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Compass, Moon, Sun } from "lucide-react-native";
import { Text, View } from "react-native";

function ToastProbe() {
  const toast = useToast();
  return (
    <PekuloButton onPress={() => toast.success("Enregistré", "Opération terminée")}>
      Notifier
    </PekuloButton>
  );
}

function ThemeToggleProbe() {
  const { resolvedTheme, set } = useThemeSetting();
  return (
    <PekuloButton onPress={() => set("pekulo-light")}>{`Theme: ${resolvedTheme}`}</PekuloButton>
  );
}

function BombChild(): never {
  throw new Error("Boom test");
}

describe("@pekulo/ui native parity", () => {
  it("exports every public component and primitive from index.native.ts (AC-1)", () => {
    const expected = [
      "PekuloRootProvider",
      "useThemeSetting",
      "ToastProvider",
      "useToast",
      "PekuloToast",
      "PekuloToastViewport",
      "useCountUp",
      "useStagger",
      "Section",
      "HeaderAction",
      "PekuloAvatar",
      "PekuloBreadcrumb",
      "PekuloButton",
      "PekuloButtonGroup",
      "PekuloCalendar",
      "PekuloCard",
      "PekuloCheckbox",
      "PekuloDatePicker",
      "PekuloDialog",
      "PekuloDialogCloseX",
      "PekuloDrawer",
      "PekuloEmpty",
      "PekuloField",
      "PekuloInput",
      "PekuloLabel",
      "PekuloLoadingItem",
      "PekuloNativeCheckbox",
      "PekuloNativeSelect",
      "PekuloPopover",
      "PekuloProgress",
      "PekuloRadioGroup",
      "PekuloResizablePanelGroup",
      "PekuloSelect",
      "PekuloSeparator",
      "PekuloSheet",
      "PekuloSlider",
      "PekuloSpinner",
      "PekuloSubmitButton",
      "PekuloSwitch",
      "PekuloTextarea",
      "PekuloTooltip",
      "CategoryIcon",
      "CategoryPicker",
      "PekuloAccountRow",
      "PekuloAccountsSection",
      "PekuloActivityRow",
      "PekuloClassRow",
      "PekuloCompositionCard",
      "PekuloCompositionRow",
      "PekuloContextualAddButton",
      "PekuloCountUpEUR",
      "PekuloCountUpPct",
      "PekuloDonut",
      "PekuloDonutCard",
      "PekuloEmptyState",
      "PekuloErrorBoundary",
      "PekuloHero",
      "PekuloHeroCard",
      "PekuloHoldingRow",
      "PekuloHypothesisCard",
      "PekuloHypothesisVerdict",
      "PekuloKpiTile",
      "PekuloMilestoneRow",
      "PekuloMilestonesCard",
      "PekuloMobileBottomNav",
      "PekuloMonthlyRow",
      "PekuloNavRail",
      "PekuloPagination",
      "PekuloProjectionChart",
      "PekuloPropertyCard",
      "PekuloRecentActivityCard",
      "PekuloSegmentedControl",
      "PekuloSettingRow",
      "PekuloSkeleton",
      "PekuloStaggerList",
      "PekuloStat",
      "PekuloSuggestionRow",
      "PekuloToggleRow",
      "PekuloTopTabToggle",
      "PekuloTrajectoryChart",
      "PekuloTrajectoryCard",
      "PekuloUserDot",
      "TransactionLogo",
    ] as const;

    for (const name of expected) {
      expect(Reflect.get(PekuloUI, name)).toBeDefined();
    }
  });

  it("renders charts, cards, rows, navigation, and domain components in dark & light themes (AC-3)", async () => {
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
          <CategoryIcon category="courses" />
          <PekuloSettingRow label="Export" value="JSON" />
          <PekuloStaggerList>
            <Text>Item 1</Text>
            <Text>Item 2</Text>
          </PekuloStaggerList>
          <PekuloSkeleton lines={2} />
          <PekuloEmptyState icon={Compass} title="Rien ici" message="Ajoutez un élément" />
          <PekuloContextualAddButton label="Ajouter" onPress={jest.fn()} />
          <PekuloUserDot initial="a" onPress={jest.fn()} />
          <PekuloTopTabToggle topTab="cap" onChange={jest.fn()} />
          <PekuloMobileBottomNav activeKey="cap" onSelect={jest.fn()} />
          <PekuloNavRail activeKey="cap" onSelect={jest.fn()} />
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

    const darkJson = JSON.stringify(darkView.toJSON());
    expect(darkJson).not.toContain("var(--");
    expect(darkJson).not.toContain("currentColor");
    expect(darkJson).not.toContain("<svg");
    expect(darkJson).not.toContain("<img");

    const lightView = await render(
      <PekuloRootProvider theme="pekulo-light">{ui}</PekuloRootProvider>,
    );
    expect(screen.getByText("Vue globale")).toBeTruthy();

    const lightJson = JSON.stringify(lightView.toJSON());
    expect(lightJson).not.toContain("var(--");
    expect(lightJson).not.toContain("currentColor");
    expect(lightJson).not.toContain("<svg");
    expect(lightJson).not.toContain("<img");
    expect(lightJson).not.toEqual(darkJson);
  });

  it("renders and drives interactive primitives, pickers, calendar, toast, and theme switching (AC-4)", async () => {
    const onConfirm = jest.fn();
    const onPageChange = jest.fn();
    const onSelectChange = jest.fn();
    const onDateChange = jest.fn();
    const onToggle = jest.fn();
    const onSegment = jest.fn();
    const onTextarea = jest.fn();
    const onNativeCb = jest.fn();

    await render(
      <PekuloRootProvider theme="pekulo-dark">
        <View>
          <ThemeToggleProbe />
          <ToastProbe />
          <PekuloCard>
            <PekuloCardHeader>
              <PekuloCardTitle>Carte</PekuloCardTitle>
              <PekuloCardDescription>Description</PekuloCardDescription>
            </PekuloCardHeader>
            <PekuloCardContent>
              <PekuloFieldGroup>
                <PekuloField>
                  <PekuloFieldContent>
                    <PekuloFieldLabel htmlFor="pwd">Mot de passe</PekuloFieldLabel>
                    <PekuloInput type="password" placeholder="Secret" testID="pwd-input" />
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
                  <option value="livret">Livret</option>
                  <option value="pea">PEA</option>
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
                <PekuloCheckbox checked onCheckedChange={jest.fn()}>
                  <PekuloCheckbox.Indicator />
                </PekuloCheckbox>
                <PekuloNativeCheckbox testID="native-cb" onCheckedChange={onNativeCb} />
                <PekuloRadioGroup value="1" onValueChange={jest.fn()}>
                  <PekuloRadioGroup.Item value="1" />
                </PekuloRadioGroup>
                <PekuloSlider defaultValue={[40]} max={100} />
                <PekuloSwitch checked onCheckedChange={jest.fn()} />
                <PekuloToggleRow label="Activer" checked={false} onChange={onToggle} />
                <PekuloCalendar
                  mode="single"
                  selected={new Date(2026, 0, 15)}
                  onSelect={onDateChange}
                />
                <PekuloDatePicker value={new Date(2026, 0, 15)} onChange={jest.fn()} />
                <PekuloProgress value={50} />
                <PekuloLoadingItem title="Synchro" trailing="1/2" />
                <PekuloSpinner />
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
                <PekuloSubmitButton onPress={jest.fn()}>Valider</PekuloSubmitButton>
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
                <PekuloDialog open={false}>
                  <PekuloDialog.Portal>
                    <PekuloDialog.Content>
                      <PekuloDialogCloseX />
                    </PekuloDialog.Content>
                  </PekuloDialog.Portal>
                </PekuloDialog>
                <PekuloDrawer open={false}>
                  <PekuloDrawer.Content>
                    <PekuloDrawer.Header>
                      <PekuloDrawer.Title>Filtres</PekuloDrawer.Title>
                      <PekuloDrawer.Description>Par mois</PekuloDrawer.Description>
                    </PekuloDrawer.Header>
                    <PekuloDrawer.Footer>
                      <Text>OK</Text>
                    </PekuloDrawer.Footer>
                  </PekuloDrawer.Content>
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

    await fireEvent.press(screen.getByText("Notifier"));
    expect(screen.getByText("Enregistré")).toBeTruthy();

    await fireEvent.press(screen.getByText("Theme: pekulo-dark"));
    expect(screen.getByText("Theme: pekulo-light")).toBeTruthy();

    await fireEvent.press(screen.getByText("✓ Confirmer"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await fireEvent.press(screen.getByText("Clair"));
    expect(onSegment).toHaveBeenCalledWith("light");

    await fireEvent.press(screen.getByText("Livret"));
    expect(onSelectChange).toHaveBeenCalledWith("livret");

    expect(screen.getByTestId("pwd-input").props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByLabelText("Afficher le mot de passe"));
    expect(screen.getByTestId("pwd-input").props.secureTextEntry).toBe(false);

    await fireEvent.changeText(screen.getByTestId("note-textarea"), "Note test");
    expect(onTextarea).toHaveBeenCalledWith({ target: { value: "Note test" } });

    await fireEvent.press(screen.getByTestId("native-cb"));
    expect(onNativeCb).toHaveBeenCalledWith(true);

    await fireEvent.press(screen.getByTestId("native-datetimepicker"));
    expect(onDateChange).toHaveBeenCalledTimes(1);
  });

  it("renders PekuloErrorBoundary fallback when child throws (AC-4)", async () => {
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
    } finally {
      spy.mockRestore();
    }
  });
});
