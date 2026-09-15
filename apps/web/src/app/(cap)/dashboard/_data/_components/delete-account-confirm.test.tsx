import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { DeleteAccountConfirm } from "./delete-account-confirm";
import { renderWithTamagui } from "../../../../../../test/setup";
import fr from "../../../../../../messages/fr.json";

// Story 11-2, AC-8 (verbatim from story 11-2-account-deletion:21):
//   […] When that control is activated, Then a confirmation dialog opens
//   requiring the account's email address to be typed before the confirm
//   button enables. When the deletion succeeds, Then the offline cache is
//   purged, the session is cleared and the browser lands on `/`.
// The typed-email gate is the behaviour worth proving here: without it the
// destructive button is one stray click away, and with it wrong, the user can
// be refused by the server after believing they confirmed.
// vi.mock factories are hoisted above every other statement, so the mocks
// they close over must be created in the hoisted phase too (lesson 2026-05-20).
const { mutate, purge } = vi.hoisted(() => ({
  mutate: vi.fn(),
  purge: vi.fn(async () => undefined),
}));

vi.mock("../_hooks/use-delete-account", () => ({
  useDeleteUserAccount: () => ({ mutate, isPending: false, error: null, reset: vi.fn() }),
}));
vi.mock("@/lib/offline/cache-db", () => ({ purgeOfflineCache: purge }));

const EMAIL = "alex@pekulo.local";

type MutateOptions = { onSuccess: (result: { ok: true } | { ok: false; code: string }) => void };
const lastOnSuccess = () => (mutate.mock.calls[0]![1] as MutateOptions).onSuccess;

async function openAndConfirm() {
  const user = userEvent.setup();
  const view = renderWithTamagui(
    <DeleteAccountConfirm email={EMAIL} open onOpenChange={() => {}} />,
  );
  await user.type(view.getByLabelText(fr.settings.data.deleteConfirmLabel), EMAIL);
  await user.click(view.getByRole("button", { name: new RegExp(fr.settings.data.deleteConfirm) }));
  return view;
}

beforeEach(() => {
  mutate.mockReset();
  purge.mockClear();
});

describe("DeleteAccountConfirm (story 11-2, AC-8)", () => {
  it("keeps the destructive button disabled until the email matches", async () => {
    const user = userEvent.setup();
    const { getByRole, getByLabelText } = renderWithTamagui(
      <DeleteAccountConfirm email={EMAIL} open onOpenChange={() => {}} />,
    );
    const confirm = getByRole("button", { name: new RegExp(fr.settings.data.deleteConfirm) });
    expect(confirm).toBeDisabled();

    await user.type(getByLabelText(fr.settings.data.deleteConfirmLabel), "wrong@example.test");
    expect(confirm).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
    expect(purge).not.toHaveBeenCalled();
  });

  it("enables on an exact match, purges the offline cache, then sends the typed email", async () => {
    await openAndConfirm();
    // The purge runs BEFORE the call: the action ends in a redirect and never
    // resolves on this side, so there is no "after" to purge in.
    expect(purge).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toEqual({ confirmationEmail: EMAIL });
  });

  it("accepts a case- and whitespace-different match, like the server does", async () => {
    // The client gate must not be STRICTER than the server rule, or a user
    // typing their own address with a capital letter is stuck on a disabled
    // button with no explanation.
    const user = userEvent.setup();
    const { getByRole, getByLabelText } = renderWithTamagui(
      <DeleteAccountConfirm email={EMAIL} open onOpenChange={() => {}} />,
    );
    await user.type(
      getByLabelText(fr.settings.data.deleteConfirmLabel),
      ` ${EMAIL.toUpperCase()} `,
    );
    expect(getByRole("button", { name: new RegExp(fr.settings.data.deleteConfirm) })).toBeEnabled();
  });

  it("names the cancel control by its visible word, not Tamagui's default", () => {
    const { getByRole } = renderWithTamagui(
      <DeleteAccountConfirm email={EMAIL} open onOpenChange={() => {}} />,
    );
    // WCAG 2.5.3: « Annuler » must be in the accessible name. Tamagui's
    // Dialog.Close defaults it to "Dialog Close" (aped-review 11-2, Aria).
    expect(getByRole("button", { name: fr.common.cancel })).toBeInTheDocument();
    expect(() => getByRole("button", { name: "Dialog Close" })).toThrow();
  });

  describe("envelope branches (aped-review 11-2)", () => {
    // Failures travel as `{ ok: false, code }` because Next blanks the message
    // of a thrown server-action error in production; the copy branches on the
    // code, and each code is a different truth for the user.
    it("says the provider was unreachable and nothing was touched on BANK_PROVIDER_UNAVAILABLE", async () => {
      const { findByRole } = await openAndConfirm();
      lastOnSuccess()({ ok: false, code: "BANK_PROVIDER_UNAVAILABLE" });
      expect(await findByRole("alert")).toHaveTextContent(fr.settings.data.deleteProviderError);
    });

    it("says the data is gone but the account is not on ACCOUNT_PARTIALLY_ERASED", async () => {
      const { findByRole } = await openAndConfirm();
      lastOnSuccess()({ ok: false, code: "ACCOUNT_PARTIALLY_ERASED" });
      const alert = await findByRole("alert");
      expect(alert).toHaveTextContent(fr.settings.data.deletePartialError);
      expect(alert).not.toHaveTextContent(/rien n'a été supprimé/i);
    });

    it("falls back to the generic copy on any other code", async () => {
      const { findByRole } = await openAndConfirm();
      lastOnSuccess()({ ok: false, code: "FORBIDDEN" });
      expect(await findByRole("alert")).toHaveTextContent(fr.settings.data.deleteGenericError);
    });
  });

  describe("success fallback", () => {
    const original = window.location;
    afterEach(() => {
      Object.defineProperty(window, "location", { value: original, writable: true });
    });

    it("leaves with a full document load if the action ever resolves instead of redirecting", async () => {
      const assign = vi.fn();
      Object.defineProperty(window, "location", { value: { ...original, assign }, writable: true });
      await openAndConfirm();
      lastOnSuccess()({ ok: true });
      expect(assign).toHaveBeenCalledWith("/");
    });
  });
});
