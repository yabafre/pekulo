// AC-2 (verbatim from story 0-4-prisma-setup):
//   (i)   `injectPrefixedId("Account", { userId: "u" })` returns an object whose
//         `id` matches the regex `^acc_[0-9A-Za-z]{21}$`,
//   (ii)  `injectPrefixedId("Account", { id: "explicit_id", userId: "u" })`
//         returns the input unchanged (idempotence),
//   (iii) `injectPrefixedId("FakeModel", {})` throws a `MissingPrefixError`
//         with message containing `FakeModel`,
//   (iv)  `injectPrefixedId("Holding", {})` returns an `id` starting with `hld_`.

import { describe, expect, it } from "bun:test";
import { MissingPrefixError, injectPrefixedId } from "./prefixed-ids.injector";

describe("injectPrefixedId", () => {
  it("injects a prefixed id when data.id is undefined (Account → acc_…)", () => {
    const input: Record<string, unknown> = { userId: "u" };
    const out = injectPrefixedId("Account", input);
    expect(out).toMatchObject({ userId: "u" });
    expect((out as { id: string }).id).toMatch(/^acc_[0-9A-Za-z]{21}$/);
  });

  it("returns data unchanged when data.id is already set (idempotence)", () => {
    const data = { id: "explicit_id", userId: "u" };
    const out = injectPrefixedId("Account", data);
    expect(out).toBe(data);
    expect(out.id).toBe("explicit_id");
  });

  it("throws MissingPrefixError when the model is not registered", () => {
    expect(() => injectPrefixedId("FakeModel", {})).toThrow(MissingPrefixError);
    expect(() => injectPrefixedId("FakeModel", {})).toThrow(/FakeModel/);
  });

  it("uses the right prefix for a second model (Holding → hld_…)", () => {
    const out = injectPrefixedId("Holding", {});
    expect((out as { id: string }).id).toMatch(/^hld_[0-9A-Za-z]{21}$/);
  });

  it("treats null id like undefined (Prisma may pass either)", () => {
    const input: { id: unknown } = { id: null };
    const out = injectPrefixedId("Transaction", input);
    expect((out as unknown as { id: string }).id).toMatch(/^tx_[0-9A-Za-z]{21}$/);
  });

  it("treats empty-string id as missing — form clients coerce omitted fields to '' (review F4)", () => {
    const input: { id: unknown; userId: string } = { id: "", userId: "u" };
    const out = injectPrefixedId("Account", input);
    expect((out as unknown as { id: string }).id).toMatch(/^acc_[0-9A-Za-z]{21}$/);
  });
});
