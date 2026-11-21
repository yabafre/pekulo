import { PekuloRootProvider } from "@pekulo/ui";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { ActionSheetIOS, Alert } from "react-native";

import ImmobilierScreen from "../app/(tabs)/immobilier/index";
import MensuelScreen from "../app/(tabs)/mensuel/index";
import PortefeuilleScreen from "../app/(tabs)/portefeuille/index";
import ClotureSheet from "../app/sheets/cloture";
import HoldingSheet from "../app/sheets/holding";
import LotSheet from "../app/sheets/lot";
import MortgageSheet from "../app/sheets/mortgage";
import PropertySheet from "../app/sheets/property";
import RentalSheet from "../app/sheets/rental";
import ValuationSheet from "../app/sheets/valuation";
import ValuationsSheet from "../app/sheets/valuations";
import { AuthProvider, createMobileQueryClient } from "../lib/auth/auth-context";
import * as forms from "../lib/forms";
import {
  accountsClient,
  holdingsClient,
  monthlyClient,
  realestateClient,
} from "../lib/orpc/modules";

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({
      back: mockBack,
      push: mockPush,
      replace: jest.fn(),
      canGoBack: () => true,
    }),
  };
});

jest.mock("expo-router/stack", () => {
  const React = require("react") as typeof import("react");
  function MockStack({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  MockStack.Screen = function MockStackScreen() {
    return null;
  };
  MockStack.SearchBar = function MockSearchBar() {
    return null;
  };
  function MockToolbar({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  MockToolbar.Button = function MockToolbarButton({
    children,
    onPress,
    accessibilityLabel,
    variant,
    disabled,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
    variant?: string;
    disabled?: boolean;
  }) {
    const RN = require("react-native") as typeof import("react-native");
    return React.createElement(
      RN.Pressable,
      {
        accessibilityRole: "button",
        accessibilityLabel,
        accessibilityState: { disabled: Boolean(disabled) },
        disabled,
        onPress,
        testID: variant === "done" ? "sheet-primary-btn" : undefined,
      },
      typeof children === "string" ? React.createElement(RN.Text, null, children) : null,
    );
  };
  MockToolbar.Menu = MockToolbar;
  MockToolbar.MenuAction = MockToolbar.Button;
  MockToolbar.Spacer = function MockSpacer() {
    return null;
  };
  MockStack.Toolbar = MockToolbar;
  return { __esModule: true, default: MockStack };
});

jest.mock("../lib/orpc/modules", () => {
  const actual = jest.requireActual("../lib/orpc/modules");
  return {
    ...actual,
    accountsClient: { list: jest.fn() },
    monthlyClient: {
      listMonthly: jest.fn(),
      getMonthly: jest.fn(),
      signOffMonthly: jest.fn(),
      reopenMonthly: jest.fn(),
    },
    holdingsClient: { list: jest.fn(), create: jest.fn(), recordLot: jest.fn(), close: jest.fn() },
    realestateClient: {
      listProperties: jest.fn(),
      listPropertyDerives: jest.fn(),
      getTotalEquity: jest.fn(),
      getProperty: jest.fn(),
      listValuations: jest.fn(),
      createProperty: jest.fn(),
      recordValuation: jest.fn(),
      attachMortgage: jest.fn(),
      updateMortgage: jest.fn(),
      attachRental: jest.fn(),
      updateRental: jest.fn(),
      deleteProperty: jest.fn(),
    },
  };
});

const SESSION: Session = {
  access_token: "jwt",
  refresh_token: "r",
  expires_in: 3600,
  expires_at: 1999999999,
  token_type: "bearer",
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email: "alex@pekulo.app",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-05-03T00:00:00Z",
  },
};

const ACC = "acc_AAAAAAAAAAAAAAAAAAAAA";
const HLD = "hld_AAAAAAAAAAAAAAAAAAAAA";
const RES = "res_AAAAAAAAAAAAAAAAAAAAA";

async function renderLive(ui: ReactNode) {
  const queryClient = createMobileQueryClient();
  return await render(
    <QueryClientProvider client={queryClient}>
      <PekuloRootProvider theme="pekulo-light">
        <AuthProvider initialSession={SESSION} requireAuth={false}>
          {ui}
        </AuthProvider>
      </PekuloRootProvider>
    </QueryClientProvider>,
  );
}

function pickActionSheet(label: string) {
  return jest
    .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
    .mockImplementation((opts, cb) => cb(opts.options.indexOf(label)));
}

function acceptDestructive() {
  return jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
  });
}

function seedMonthly({ signedOff = false }: { signedOff?: boolean } = {}) {
  (monthlyClient.getMonthly as jest.Mock).mockResolvedValue({
    source: "derived",
    record: {
      year: 2026,
      monthNum: 11,
      incomeEur: 3400,
      spendingEur: 2100,
      transfersEur: 300,
      netChangeEur: 1000,
      signedOffAt: signedOff ? "2026-11-30T00:00:00Z" : null,
    },
  });
  (monthlyClient.listMonthly as jest.Mock).mockResolvedValue({
    items: [
      {
        source: "persisted",
        record: {
          id: "mr_AAAAAAAAAAAAAAAAAAAAA",
          year: 2026,
          monthNum: 10,
          incomeEur: 3200,
          spendingEur: 1950,
          transfersEur: 0,
          netChangeEur: 1250,
          signedOffAt: "2026-10-31T00:00:00Z",
          createdAt: "2026-10-01T00:00:00Z",
        },
      },
    ],
  });
}

// AC-6 (verbatim from story 10-4-mobile-auth-and-orpc:21):
//   ... adds a holding, records a lot, or closes a holding, creates a property, records a
//   valuation, views the valuation history, attaches or updates a mortgage or a rental, or
//   deletes a property, signs off the current month inside its close window or reopens a
//   signed-off month ... Then each action calls the matching `@pekulo/contracts` procedure
//   with input validated by the shared `@pekulo/validators` schema through native iOS
//   sheets, action sheets, and destructive confirmations ...
describe("AC-6 — Mensuel interactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockParams = {};
    seedMonthly();
  });

  it("signs off the current month with the prefilled figures inside the close window", async () => {
    jest.spyOn(forms, "nowDate").mockReturnValue(new Date("2026-11-28T10:00:00Z"));
    jest.spyOn(forms, "currentUtcMonth").mockReturnValue({ year: 2026, monthNum: 11 });
    (monthlyClient.signOffMonthly as jest.Mock).mockResolvedValue({});
    await renderLive(<ClotureSheet />);
    await waitFor(() => expect(screen.getByDisplayValue("3400")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(monthlyClient.signOffMonthly).toHaveBeenCalledWith({
        year: 2026,
        monthNum: 11,
        incomeEur: 3400,
        spendingEur: 2100,
        transfersEur: 300,
        netChangeEur: 1000,
      }),
    );
  });

  it("refuses to sign off outside the close window", async () => {
    jest.spyOn(forms, "nowDate").mockReturnValue(new Date("2026-11-10T10:00:00Z"));
    jest.spyOn(forms, "currentUtcMonth").mockReturnValue({ year: 2026, monthNum: 11 });
    await renderLive(<MensuelScreen />);
    await waitFor(() => expect(screen.getByTestId("cloture-btn")).toBeTruthy());
    expect(screen.getByTestId("cloture-btn").props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText(/Clôture possible du/)).toBeTruthy();
  });

  it("reopens a signed-off month from its row action sheet", async () => {
    (monthlyClient.reopenMonthly as jest.Mock).mockResolvedValue({});
    pickActionSheet("Rouvrir le mois");
    acceptDestructive();
    await renderLive(<MensuelScreen />);
    await waitFor(() => expect(screen.getByTestId("month-row-2026-10")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("month-row-2026-10"));
    await waitFor(() =>
      expect(monthlyClient.reopenMonthly).toHaveBeenCalledWith({ year: 2026, monthNum: 10 }),
    );
  });
});

describe("AC-6 — Portefeuille interactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockParams = {};
    (accountsClient.list as jest.Mock).mockResolvedValue([{ id: ACC, label: "PEA" }]);
    (holdingsClient.list as jest.Mock).mockResolvedValue([
      {
        id: HLD,
        accountId: ACC,
        kind: "etf",
        ticker: "CW8",
        isin: null,
        label: "Amundi MSCI World",
        currency: "EUR",
        quantity: 10,
        avgCost: 450,
        lastPrice: 500,
        notes: null,
      },
    ]);
  });

  it("adds a holding", async () => {
    (holdingsClient.create as jest.Mock).mockResolvedValue({ id: HLD });
    pickActionSheet("ETF");
    await renderLive(<HoldingSheet />);
    await waitFor(() => expect(screen.getByText("PEA")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("hld-label"), "Amundi MSCI World");
    await fireEvent.changeText(screen.getByTestId("hld-ticker"), "CW8");
    await fireEvent.press(screen.getByTestId("hld-kind"));
    await fireEvent.changeText(screen.getByTestId("hld-quantity"), "10");
    await fireEvent.changeText(screen.getByTestId("hld-avgcost"), "450,5");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(holdingsClient.create).toHaveBeenCalledWith({
        accountId: ACC,
        ticker: "CW8",
        isin: null,
        kind: "etf",
        currency: "EUR",
        label: "Amundi MSCI World",
        quantity: 10,
        avgCost: 450.5,
        notes: null,
      }),
    );
  });

  it("records a buy lot", async () => {
    mockParams = { id: HLD };
    (holdingsClient.recordLot as jest.Mock).mockResolvedValue({ id: "lot_1" });
    await renderLive(<LotSheet />);
    await fireEvent.changeText(screen.getByTestId("lot-quantity"), "2");
    await fireEvent.changeText(screen.getByTestId("lot-price"), "510");
    await fireEvent.changeText(screen.getByTestId("lot-fees"), "1,5");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(holdingsClient.recordLot).toHaveBeenCalledWith(
        expect.objectContaining({
          holdingId: HLD,
          type: "buy",
          quantity: 2,
          priceUnit: 510,
          fees: 1.5,
          occurredOn: expect.any(Date),
        }),
      ),
    );
  });

  it("closes a holding from its row action sheet", async () => {
    (holdingsClient.close as jest.Mock).mockResolvedValue({ ok: true });
    pickActionSheet("Clôturer la ligne");
    acceptDestructive();
    await renderLive(<PortefeuilleScreen />);
    await waitFor(() => expect(screen.getByTestId(`holding-row-${HLD}`)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`holding-row-${HLD}`));
    await waitFor(() => expect(holdingsClient.close).toHaveBeenCalledWith({ id: HLD }));
  });
});

describe("AC-6 — Immobilier interactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockParams = {};
    (realestateClient.listProperties as jest.Mock).mockResolvedValue([
      {
        id: RES,
        label: "Studio Lyon",
        propertyType: "locatif",
        currentValuation: 150000,
        lastValuedOn: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    (realestateClient.listPropertyDerives as jest.Mock).mockResolvedValue([
      { propertyId: RES, netEquityEur: 30000, monthlyCashFlowEur: 50 },
    ]);
    (realestateClient.getTotalEquity as jest.Mock).mockResolvedValue({
      totalEquityEur: 30000,
      perProperty: [],
    });
  });

  it("creates a property", async () => {
    (realestateClient.createProperty as jest.Mock).mockResolvedValue({ id: RES });
    pickActionSheet("Locatif");
    await renderLive(<PropertySheet />);
    await fireEvent.changeText(screen.getByTestId("prop-label"), "Studio Lyon");
    await fireEvent.press(screen.getByTestId("prop-type"));
    await fireEvent.changeText(screen.getByTestId("prop-valuation"), "150 000");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(realestateClient.createProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "Studio Lyon",
          propertyType: "locatif",
          currentValuation: 150000,
          lastValuedOn: expect.any(Date),
        }),
      ),
    );
  });

  it("records a valuation and lists the history", async () => {
    mockParams = { id: RES };
    (realestateClient.recordValuation as jest.Mock).mockResolvedValue({});
    (realestateClient.listValuations as jest.Mock).mockResolvedValue([
      { id: "resv_1", amount: 150000, valuedOn: new Date("2026-01-01T00:00:00Z") },
    ]);
    const valuation = await renderLive(<ValuationSheet />);
    await fireEvent.changeText(screen.getByTestId("val-amount"), "155 000");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(realestateClient.recordValuation).toHaveBeenCalledWith(
        expect.objectContaining({ propertyId: RES, amount: 155000 }),
      ),
    );
    await valuation.unmount();

    await renderLive(<ValuationsSheet />);
    await waitFor(() => expect(screen.getByText(/150\s000\s€/)).toBeTruthy());
  });

  it("attaches a mortgage when none exists and updates it when one does", async () => {
    mockParams = { id: RES };
    (realestateClient.getProperty as jest.Mock).mockResolvedValue({
      property: { id: RES, label: "Studio Lyon" },
      mortgage: null,
      rental: null,
    });
    (realestateClient.attachMortgage as jest.Mock).mockResolvedValue({});
    const attach = await renderLive(<MortgageSheet />);
    await waitFor(() => expect(screen.getByText("Ajouter")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("mtg-principal"), "120 000");
    await fireEvent.changeText(screen.getByTestId("mtg-rate"), "3,5");
    await fireEvent.changeText(screen.getByTestId("mtg-payment"), "650");
    await fireEvent.changeText(screen.getByTestId("mtg-term"), "240");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(realestateClient.attachMortgage).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId: RES,
          outstandingPrincipal: 120000,
          annualRate: 0.035,
          monthlyPayment: 650,
          termMonths: 240,
          startDate: expect.any(Date),
        }),
      ),
    );
    await attach.unmount();

    (realestateClient.getProperty as jest.Mock).mockResolvedValue({
      property: { id: RES, label: "Studio Lyon" },
      mortgage: {
        outstandingPrincipal: 120000,
        annualRate: 0.035,
        monthlyPayment: 650,
        termMonths: 240,
        startDate: new Date("2026-01-01T00:00:00Z"),
      },
      rental: null,
    });
    (realestateClient.updateMortgage as jest.Mock).mockResolvedValue({});
    await renderLive(<MortgageSheet />);
    await waitFor(() => expect(screen.getByDisplayValue("650")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("mtg-payment"), "700");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(realestateClient.updateMortgage).toHaveBeenCalledWith(
        expect.objectContaining({ propertyId: RES, monthlyPayment: 700 }),
      ),
    );
  });

  it("attaches a rental", async () => {
    mockParams = { id: RES };
    (realestateClient.getProperty as jest.Mock).mockResolvedValue({
      property: { id: RES, label: "Studio Lyon" },
      mortgage: null,
      rental: null,
    });
    (realestateClient.attachRental as jest.Mock).mockResolvedValue({});
    await renderLive(<RentalSheet />);
    await waitFor(() => expect(screen.getByText("Ajouter")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("rent-amount"), "700");
    await fireEvent.changeText(screen.getByTestId("rent-charges"), "80");
    await fireEvent(screen.getByTestId("rent-furnished"), "valueChange", true);
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(realestateClient.attachRental).toHaveBeenCalledWith({
        propertyId: RES,
        monthlyRent: 700,
        monthlyCharges: 80,
        furnished: true,
      }),
    );
  });

  it("deletes a property from its card action sheet", async () => {
    (realestateClient.deleteProperty as jest.Mock).mockResolvedValue({ ok: true });
    pickActionSheet("Supprimer le bien");
    acceptDestructive();
    await renderLive(<ImmobilierScreen />);
    await waitFor(() => expect(screen.getByTestId(`property-card-${RES}`)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`property-card-${RES}`));
    await waitFor(() => expect(realestateClient.deleteProperty).toHaveBeenCalledWith({ id: RES }));
  });
});
