import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { DeleteAccountConfirm } from "./delete-account-confirm";
import { renderWithTamagui } from "../../../../../../test/setup";
import fr from "../../../../../../messages/fr.json";

// Story 11-2, AC-8 (verbatim from story 11-2-account-deletion:21):
//   […] When that control is activated, Then a confirmation dialog opens
//   requiring the account's email address to be typed before the confirm
//   button enables.
// The typed-email gate is the behaviour worth proving here: without it the
// destructive button is one stray click away, and with it wrong, the user can
// be refused by the server after believing they confirmed.
// vi.mock factories are hoisted above every other statement, so the mocks
// they close over must be created in the hoisted phase too (lesson 2026-05-20).
const { mutate, push, refresh, purge } = vi.hoisted(() => ({
  mutate: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  purge: vi.fn(async () => undefined),
}));

vi.mock("../_hooks/use-delete-account", () => ({
  useDeleteUserAccount: () => ({ mutate, isPending: false, error: null, reset: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/lib/offline/cache-db", () => ({ purgeOfflineCache: purge }));

const EMAIL = "alex@pekulo.local";

beforeEach(() => {
  mutate.mockReset();
  push.mockReset();
  refresh.mockReset();
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
  });

  it("enables on an exact match and sends the typed email", async () => {
    const user = userEvent.setup();
    const { getByRole, getByLabelText } = renderWithTamagui(
      <DeleteAccountConfirm email={EMAIL} open onOpenChange={() => {}} />,
    );
    await user.type(getByLabelText(fr.settings.data.deleteConfirmLabel), EMAIL);
    const confirm = getByRole("button", { name: new RegExp(fr.settings.data.deleteConfirm) });
    expect(confirm).toBeEnabled();

    await user.click(confirm);
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
});
