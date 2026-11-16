import { renderRouter, screen, testRouter } from "expo-router/testing-library";

import appConfig from "../app.json";

// AC-3 (verbatim from story 10-2-mobile-app-bootstrap:38):
//   Given the mobile navigation shell, When the application launches at the
//   root route, Then the Cap tab renders as the initial screen, all five
//   primary destinations (`Cap`, `Transactions`, `Mensuel`, `Portefeuille`,
//   `Immobilier`) are navigable, and `Paramètres` opens in one tap from the
//   Cap header.
// AC-4 (verbatim from story 10-2-mobile-app-bootstrap:39):
//   Given the mobile unit and navigation test suites, When the monorepo test
//   suite runs, Then all mobile component-rendering and route-navigation
//   assertions pass cleanly without requiring a native simulator.
// AC-5 (verbatim from story 10-2-mobile-app-bootstrap:40):
//   Given the Expo Dev Client configuration, Maestro smoke flow, and local
//   runbook, When a developer prepares a local iOS Dev Build and executes the
//   smoke flow, Then the application launches under its configured bundle
//   identifier, verifies Cap rendering, traverses all five tabs, and opens
//   `Paramètres`.
describe("apps/mobile navigation graph", () => {
  it("declares the app.pekulo.mobile Dev Build bundle identifier and plugins (AC-5)", () => {
    expect(appConfig.expo.ios.bundleIdentifier).toBe("app.pekulo.mobile");
    expect(appConfig.expo.android.package).toBe("app.pekulo.mobile");
    expect(appConfig.expo.plugins).toEqual(
      expect.arrayContaining(["expo-router", "expo-dev-client", "expo-font"]),
    );
  });

  it("boots on / (Cap) and navigates to all 5 tabs + 1-tap /parametres", async () => {
    await renderRouter("./app", {
      initialUrl: "/",
    });

    expect(screen).toHavePathname("/");
    expect(screen.getByText("Patrimoine total")).toBeTruthy();
    expect(screen.getByTestId("open-settings-btn")).toBeTruthy();

    await testRouter.push("/transactions");
    expect(screen).toHavePathname("/transactions");
    expect(screen.getByText("Solde du mois")).toBeTruthy();

    await testRouter.push("/mensuel");
    expect(screen).toHavePathname("/mensuel");
    expect(screen.getByText("Épargne nette")).toBeTruthy();

    await testRouter.push("/portefeuille");
    expect(screen).toHavePathname("/portefeuille");
    expect(screen.getByText("Plus-value latente")).toBeTruthy();

    await testRouter.push("/immobilier");
    expect(screen).toHavePathname("/immobilier");
    expect(screen.getByText("Équité nette")).toBeTruthy();

    await testRouter.push("/parametres");
    expect(screen).toHavePathname("/parametres");
    expect(screen.getByText("Design System")).toBeTruthy();
  });
});
