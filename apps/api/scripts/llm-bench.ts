// apps/api/scripts/llm-bench.ts
// DR-11 dev bench — compares third-party LLM models on French transaction
// labels through the REAL transport + prompt + parser, BYPASSING the routing
// policy (prod traffic goes to Ollama; this hits the third-party client
// directly). No DB / no opt-in needed — it only exercises the transport.
//
// 1. Get an OpenRouter key at https://openrouter.ai/keys (add a few $ of credit,
//    or use ":free" model slugs — rate-limited). NEVER commit the key.
// 2. Put it in .env.local (gitignored):
//      THIRD_PARTY_LLM_API_KEY=sk-or-v1-...
//    Bun auto-loads .env.local, so just run:
//      bun apps/api/scripts/llm-bench.ts
//    (or inline: THIRD_PARTY_LLM_API_KEY=sk-or-... bun apps/api/scripts/llm-bench.ts)
//
// Defaults to OpenRouter. Override the model list: BENCH_MODELS="slugA,slugB".
import type { Env } from "../src/config/env";
import { createThirdPartyClient } from "../src/modules/llm/services/third-party-client";
import {
  buildCategorisationPrompt,
  buildPromptEnvelope,
} from "../src/modules/llm/llm-prompt-builder";
import { parseCategorisation } from "../src/modules/llm/llm-categoriser";
import { SUGGESTABLE_TRANSACTION_CATEGORIES } from "@pekulo/validators";

const API_KEY = process.env.THIRD_PARTY_LLM_API_KEY || process.env.OPENROUTER_API_KEY;
const BASE_URL =
  process.env.THIRD_PARTY_LLM_BASE_URL || "https://openrouter.ai/api/v1/chat/completions";

if (!API_KEY) {
  console.error(
    "✗ No API key. Set THIRD_PARTY_LLM_API_KEY (sk-or-… for OpenRouter) in .env.local, then:\n" +
      "    bun apps/api/scripts/llm-bench.ts",
  );
  process.exit(1);
}

// OpenRouter catalogue slugs — verify/adjust at https://openrouter.ai/models.
// A bad slug just errors that one row (the bench continues); OpenRouter's error
// names the right slug.
const MODELS = process.env.BENCH_MODELS?.split(",")
  .map((m) => m.trim())
  .filter(Boolean) ?? [
  "mistralai/mistral-small-3.2-24b-instruct",
  "anthropic/claude-haiku-4.5",
  "google/gemini-2.5-flash-lite",
];

// Realistic, messy FR bank labels. Replace with YOUR real labels for a true read.
const SAMPLE: { label: string; amount: number; occurredOn: string; merchant?: string }[] = [
  { label: "CB CARREFOUR MARKET 4929 PARIS", amount: -42.18, occurredOn: "2026-05-12" },
  { label: "PRLV SEPA EDF CLIENTS PARTICULIERS", amount: -78.5, occurredOn: "2026-05-05" },
  { label: "VIR SALAIRE ACME SAS", amount: 2850, occurredOn: "2026-05-28" },
  { label: "SNCF CONNECT 8012 PARIS", amount: -64.9, occurredOn: "2026-05-18" },
  { label: "PAYPAL *SPOTIFY", amount: -10.99, occurredOn: "2026-05-03" },
  { label: "CB FNAC 0571 LYON", amount: -129.99, occurredOn: "2026-05-21" },
  { label: "RETRAIT DAB 00012 PARIS", amount: -60, occurredOn: "2026-05-09" },
  { label: "PRLV LOYER SCI BELLEVUE", amount: -920, occurredOn: "2026-05-02" },
  { label: "CB PHARMACIE DU CENTRE NICE", amount: -23.4, occurredOn: "2026-05-15" },
  { label: "CB UBER EATS AMSTERDAM", amount: -27.8, occurredOn: "2026-05-22" },
];

const categories = SUGGESTABLE_TRANSACTION_CATEGORIES;

async function benchModel(model: string): Promise<void> {
  const env = {
    THIRD_PARTY_LLM_API_KEY: API_KEY,
    THIRD_PARTY_LLM_BASE_URL: BASE_URL,
    THIRD_PARTY_LLM_MODEL: model,
  } as unknown as Env;
  const client = createThirdPartyClient({ env });

  console.log(`\n━━━ ${model} ━━━`);
  let ok = 0;
  let totalMs = 0;
  for (const tx of SAMPLE) {
    const envelope = buildPromptEnvelope({
      label: tx.label,
      amount: tx.amount,
      currency: "EUR",
      occurredOn: tx.occurredOn,
      ...(tx.merchant ? { merchant: tx.merchant } : {}),
    });
    const prompt = buildCategorisationPrompt(envelope, categories);
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential on purpose (rate-limit friendly)
      const { raw, latencyMs } = await client.complete(prompt);
      const { category, confidence } = parseCategorisation(raw, categories);
      totalMs += latencyMs;
      if (category) ok += 1;
      const tag = category ? `${category} (${confidence.toFixed(2)})` : "✗ abstain";
      console.log(
        `  ${tx.label.padEnd(38).slice(0, 38)}  ${tag.padEnd(22)} ${latencyMs}ms` +
          (category ? "" : `  raw=${JSON.stringify(raw).slice(0, 90)}`),
      );
    } catch (err) {
      console.log(
        `  ${tx.label.padEnd(38).slice(0, 38)}  ERROR  ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  console.log(
    `  → ${ok}/${SAMPLE.length} categorised · avg ${
      SAMPLE.length > 0 ? Math.round(totalMs / SAMPLE.length) : 0
    }ms`,
  );
}

console.log(
  `LLM bench · ${MODELS.length} model(s) × ${SAMPLE.length} FR labels\n` +
    `endpoint: ${BASE_URL}\ncategories: ${categories.join(", ")}`,
);
for (const model of MODELS) {
  // eslint-disable-next-line no-await-in-loop -- one model at a time for readable output
  await benchModel(model);
}
