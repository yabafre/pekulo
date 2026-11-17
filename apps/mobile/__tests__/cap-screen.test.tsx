import { PekuloHero, PekuloRootProvider, PekuloStat, pekuloDark, pekuloLight } from "@pekulo/ui";
import { Text } from "@pekulo/ui/client";
import { render, screen } from "@testing-library/react-native";
import { useTheme } from "tamagui";

import CapScreen from "../app/(tabs)/(cap)/index";
import { ScreenShell } from "../components/screen-shell";

function ThemeProbe() {
  const theme = useTheme();
  return <Text testID="theme-bg">{theme.background.val}</Text>;
}

// AC-1 (verbatim from story 10-2-mobile-app-bootstrap:36):
//   Given the mobile workspace and the cross-platform design-system additions,
//   When workspace installation, typechecking, linting, formatting,
//   design-system tests, and Tamagui CSS regeneration checks run, Then every
//   check exits 0 with zero regressions and zero drift on the pre-generated
//   web stylesheet.
// AC-2 (verbatim from story 10-2-mobile-app-bootstrap:37):
//   Given the shared design-system configuration and native theme provider,
//   When the mobile application compiles with the Tamagui optimizing compiler
//   and mounts its root screen, Then both dark and light Pekulo themes apply
//   cleanly and the shared hero and stat components render without web-only
//   runtime errors.
// AC-4 (verbatim from story 10-2-mobile-app-bootstrap:39):
//   Given the mobile unit and navigation test suites, When the monorepo test
//   suite runs, Then all mobile component-rendering and route-navigation
//   assertions pass cleanly without requiring a native simulator.
describe("CapScreen with @pekulo/ui native", () => {
  it("resolves @pekulo/ui native barrel exports and theme tokens (AC-1, AC-2)", () => {
    expect(typeof PekuloRootProvider).toBe("function");
    expect(typeof PekuloHero).toBe("function");
    expect(typeof PekuloStat).toBe("function");
    expect(pekuloDark.background).toBe("#000000");
    expect(pekuloLight.background).toBe("#ffffff");
  });

  it("renders PekuloHero and PekuloStat inside PekuloRootProvider (dark)", async () => {
    await render(
      <PekuloRootProvider theme="pekulo-dark">
        <CapScreen />
      </PekuloRootProvider>,
    );

    // The native header owns the "Cap" large title; the screen body must not repeat it.
    expect(screen.getAllByText("Cap")).toHaveLength(1);
    expect(screen.getByText("Trajectoire vers votre objectif patrimonial")).toBeTruthy();
    expect(screen.getByText("Patrimoine total")).toBeTruthy();
    expect(screen.getByText("Avancement")).toBeTruthy();
    expect(screen.getByText("22,6 %")).toBeTruthy();
    expect(screen.getByText("Prochain palier")).toBeTruthy();
    expect(screen.getByText("100 k€ · 2032")).toBeTruthy();
  });

  it("supports switching explicitly and dynamically to pekulo-light theme", async () => {
    const view = await render(
      <PekuloRootProvider theme="pekulo-dark">
        <ThemeProbe />
        <CapScreen />
      </PekuloRootProvider>,
    );

    expect(screen.getByTestId("theme-bg").props.children).toBe("#000000");

    await view.rerender(
      <PekuloRootProvider theme="pekulo-light">
        <ThemeProbe />
        <CapScreen />
      </PekuloRootProvider>,
    );

    expect(screen.getByTestId("theme-bg").props.children).toBe("#ffffff");
    expect(screen.getByText("Patrimoine total")).toBeTruthy();
  });

  it("omits subtitle Text node when subtitle is empty string", async () => {
    await render(
      <PekuloRootProvider theme="pekulo-dark">
        <ScreenShell title="Titre seul" subtitle="">
          <Text>Contenu</Text>
        </ScreenShell>
      </PekuloRootProvider>,
    );

    expect(screen.getByText("Titre seul")).toBeTruthy();
    expect(screen.queryByText("")).toBeNull();
  });
});
