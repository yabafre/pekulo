import { describe, expect, test } from "bun:test";
import { createLogosService, providerIdFromAccountKey } from "./logos.service";
import type { LogosRepository } from "./logos.repository";

function fakeRepo(
  seed?: {
    merchant?: Record<string, string | null>;
    provider?: Record<string, string | null>;
  },
  clock: () => Date = () => new Date(),
): LogosRepository {
  const m = new Map<string, { logoUrl: string | null; fetchedAt: Date }>();
  const p = new Map<string, { logoUrl: string | null; fetchedAt: Date }>();
  for (const [k, v] of Object.entries(seed?.merchant ?? {}))
    m.set(k, { logoUrl: v, fetchedAt: clock() });
  for (const [k, v] of Object.entries(seed?.provider ?? {}))
    p.set(k, { logoUrl: v, fetchedAt: clock() });
  return {
    async getMerchant(k) {
      return m.get(k);
    },
    async upsertMerchant(k, v) {
      m.set(k, { logoUrl: v, fetchedAt: clock() });
    },
    async getProvider(k) {
      return p.get(k);
    },
    async upsertProvider(k, v) {
      p.set(k, { logoUrl: v, fetchedAt: clock() });
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
    expect((await repo.getMerchant("uber eats"))?.logoUrl).toBe("https://x/uber.png");
    expect((await repo.getProvider("574"))?.logoUrl).toBe("https://x/sg.png");
  });

  // Curated map (high recall) — a known brand buried mid-label is searched by its
  // CLEAN name, not the noisy 3-token key (else Brandfetch returns []).
  test("resolveMerchantLogo searches the curated clean brand for a buried merchant", async () => {
    const seen: string[] = [];
    const repo = fakeRepo();
    const svc = createLogosService({
      repository: repo,
      brandfetch: {
        async resolveLogoUrl(q) {
          seen.push(q);
          return q === "mcdonalds" ? "https://x/mcd.png" : null;
        },
      },
      getBankLogo: async () => null,
    });
    const url = await svc.resolveMerchantLogo("CB Mad Cours Mcdonald S Agdal Oncf");
    expect(url).toBe("https://x/mcd.png");
    expect(seen).toContain("mcdonalds"); // clean brand, not the "mad cours mcdonald" key
  });

  // AC-5 refresh window — a negative cache entry must NOT be permanent: once the
  // window elapses the merchant is re-resolved so a once-down brand can recover.
  test("re-resolves a negative cache entry once its refresh window elapses (AC-5)", async () => {
    let t = new Date("2026-01-01T00:00:00Z");
    let calls = 0;
    const repo = fakeRepo(undefined, () => t);
    const svc = createLogosService({
      repository: repo,
      brandfetch: {
        async resolveLogoUrl() {
          calls += 1;
          return null;
        },
      },
      getBankLogo: async () => null,
      clock: () => t,
    });
    expect(await svc.resolveMerchantLogo("Carrefour City")).toBeNull();
    expect(calls).toBe(1); // first miss → one brandfetch hit + negative-cache
    t = new Date("2026-01-10T00:00:00Z"); // +9 days — inside the 14-day window
    expect(await svc.resolveMerchantLogo("Carrefour City")).toBeNull();
    expect(calls).toBe(1); // served from the negative cache
    t = new Date("2026-01-20T00:00:00Z"); // +19 days — past the window
    expect(await svc.resolveMerchantLogo("Carrefour City")).toBeNull();
    expect(calls).toBe(2); // re-resolved after the refresh window elapsed
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
