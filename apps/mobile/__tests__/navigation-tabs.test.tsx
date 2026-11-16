import { renderRouter, screen, testRouter } from "expo-router/testing-library";

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
describe("apps/mobile navigation graph", () => {
  it("boots on / (Cap) and navigates to all 5 tabs + /parametres", async () => {
    await renderRouter("./app", {
      initialUrl: "/",
    });

    expect(screen).toHavePathname("/");
    expect(screen.getByText("Patrimoine total")).toBeTruthy();

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
