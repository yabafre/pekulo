import { describe, expect, test } from "bun:test";
import { createLogosService, providerIdFromAccountKey } from "./logos.service";
import type { LogosRepository } from "./logos.repository";

function fakeRepo(seed?: {
  merchant?: Record<string, string | null>;
  provider?: Record<string, string | null>;
}): LogosRepository {
  const m = new Map(Object.entries(seed?.merchant ?? {}));
  const p = new Map(Object.entries(seed?.provider ?? {}));
  return {
    async getMerchant(k) {
      return m.has(k) ? { logoUrl: m.get(k) ?? null } : undefined;
    },
    async upsertMerchant(k, v) {
      m.set(k, v);
    },
    async getProvider(k) {
      return p.has(k) ? { logoUrl: p.get(k) ?? null } : undefined;
    },
    async upsertProvider(k, v) {
      p.set(k, v);
    },
  };
}

// AC-1/AC-2/AC-3 (verbatim from story 6-10-merchant-logos:38-40):
//   AC-1 — recognised merchant → merchant logo (tier 1).
//   AC-2 — unknown merchant but known bank → bank logo (tier 2).
//   AC-3 — no resolvable source (or manual tx, provider == null) → category
//          icon (tier 3).
// AC-5 (verbatim from story 6-10-merchant-logos:42):
//   … the endpoint responds 404 and never fetches a caller-supplied address
//   (anti-SSRF). A merchant that fails to resolve is remembered as "no logo"
//   and not looked up again before its refresh window elapses.
describe("logos.service (story 6-10 / FR-65)", () => {
  test("providerIdFromAccountKey parses pid:, ignores iban:/unknown", () => {
    expect(providerIdFromAccountKey("pid:574:Compte")).toBe("574");
    expect(providerIdFromAccountKey("iban:FR76...")).toBeNull();
    expect(providerIdFromAccountKey("pid:unknown:Carte")).toBeNull();
    expect(providerIdFromAccountKey(null)).toBeNull();
  });

  test("resolveMerchantLogo negative-caches a miss (no second brandfetch hit)", async () => {
    let calls = 0;
    const repo = fakeRepo();
    const svc = createLogosService({
      repository: repo,
      brandfetch: {
        async resolveLogoUrl() {
          calls += 1;
          return null;
        },
      },
      getBankLogo: async () => null,
    });
    expect(await svc.resolveMerchantLogo("Carrefour City")).toBeNull();
    expect(await svc.resolveMerchantLogo("Carrefour City")).toBeNull();
    expect(calls).toBe(1); // second call served from the negative cache
  });

  test("enrich: tier1 merchant, then tier2 bank, then null (AC-1/2/3)", async () => {
    const repo = fakeRepo({
      merchant: { "carrefour city": "https://x/carrefour.png" },
      provider: { "574": "https://x/sg.png" },
    });
    const svc = createLogosService({
      repository: repo,
      brandfetch: {
        async resolveLogoUrl() {
          return null;
        },
      },
      getBankLogo: async () => null,
    });
    const map = await svc.enrich([
      {
        id: "tx_a",
        label: "CB Carrefour City",
        provider: "bridge",
        providerAccountKey: "pid:574:Cpt",
      },
      { id: "tx_b", label: "Inconnu SARL", provider: "bridge", providerAccountKey: "pid:574:Cpt" },
      { id: "tx_c", label: "Café du coin", provider: null, providerAccountKey: null },
    ]);
    expect(map.get("tx_a")).toBeTruthy(); // tier 1 ref
    expect(map.get("tx_b")).toBeTruthy(); // tier 2 ref (bank cached)
    expect(map.get("tx_c")).toBeNull(); // manual → tier 3
  });

  test("refToUpstreamUrl: valid ref resolves, forged/garbage ref → null (AC-5)", async () => {
    const repo = fakeRepo({ provider: { "574": "https://x/sg.png" } });
    const svc = createLogosService({
      repository: repo,
      brandfetch: {
        async resolveLogoUrl() {
          return null;
        },
      },
      getBankLogo: async () => null,
    });
    const ref = Buffer.from("b:574", "utf8").toString("base64url");
    expect(await svc.refToUpstreamUrl(ref)).toBe("https://x/sg.png");
    expect(await svc.refToUpstreamUrl("http://169.254.169.254/")).toBeNull(); // not a ref → no fetch
    expect(await svc.refToUpstreamUrl("garbage!!")).toBeNull();
  });

  // Backfill/warm-up primitive — resolves + caches a batch so later reads are
  // pure cache lookups. Best-effort: a single failure never aborts the batch.
  test("warmMany resolves + caches merchant labels and provider ids", async () => {
    const repo = fakeRepo();
    const svc = createLogosService({
      repository: repo,
      brandfetch: {
        async resolveLogoUrl(q) {
          return q === "uber eats" ? "https://x/uber.png" : null;
        },
      },
      getBankLogo: async (id) => (id === "574" ? "https://x/sg.png" : null),
    });
    const r = await svc.warmMany({ labels: ["Cb Uber *eats"], providerIds: ["574"] });
    expect(r).toEqual({ merchants: 1, providers: 1 });
    expect(await repo.getMerchant("uber eats")).toEqual({ logoUrl: "https://x/uber.png" });
    expect(await repo.getProvider("574")).toEqual({ logoUrl: "https://x/sg.png" });
  });

  // AC-2 — bank tier on an IBAN account: the key (iban:...) carries no
  // provider_id, so enrich uses the stored EnrichRow.providerId instead.
  test("enrich resolves the bank tier from the stored providerId (IBAN account)", async () => {
    const repo = fakeRepo({ provider: { "574": "https://x/sg.png" } });
    const svc = createLogosService({
      repository: repo,
      brandfetch: {
        async resolveLogoUrl() {
          return null;
        },
      },
      getBankLogo: async () => null,
    });
    const map = await svc.enrich([
      {
        id: "tx_iban",
        label: "Prlv Sepa Matmut",
        provider: "bridge",
        providerAccountKey: "iban:FR76xxxx", // unparseable for a provider_id
        providerId: "574",
      },
    ]);
    expect(map.get("tx_iban")).toBeTruthy(); // tier-2 via stored providerId
  });
});
