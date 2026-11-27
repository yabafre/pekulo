// apps/mobile/__tests__/e2e-build-env.test.ts
// Story 10-6 review — the E2E build flags live in two places: the EAS
// `e2e-test` profile (apps/mobile/eas.json, still used for local/EAS e2e builds
// and by store-compliance.test.ts) and the GitHub Actions workflow that now
// builds the CI binaries (.github/workflows/e2e-mobile.yml). They must not drift.
export {};

const fs = require("node:fs") as {
  readFileSync: (filePath: string, encoding: "utf8") => string;
};
const path = require("node:path") as {
  dirname: (filePath: string) => string;
  join: (...segments: string[]) => string;
};

const resolveModule = (require as unknown as { resolve: (id: string) => string }).resolve;
const MOBILE_ROOT = path.dirname(resolveModule("../package.json"));
const REPO_ROOT = path.join(MOBILE_ROOT, "..", "..");

const easJson = JSON.parse(fs.readFileSync(path.join(MOBILE_ROOT, "eas.json"), "utf8")) as {
  build: { "e2e-test": { env: Record<string, string> } };
};
const workflow = fs.readFileSync(path.join(REPO_ROOT, ".github/workflows/e2e-mobile.yml"), "utf8");

/** Top-level `env:` block of the workflow, as KEY → value. */
function workflowEnv(text: string): Record<string, string> {
  const block = text.match(/^env:\n((?:(?: {2}.*)?\n)+)/m)?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/^ {2}([A-Z0-9_]+): "([^"]*)"$/gm)].map(([, key, value]) => [key, value]),
  );
}

describe("E2E build flags (story 10-6 review)", () => {
  it("keeps the workflow env in sync with the EAS e2e-test profile", () => {
    const eas = easJson.build["e2e-test"].env;
    expect(Object.keys(eas).length).toBeGreaterThanOrEqual(3);
    expect(workflowEnv(workflow)).toMatchObject(eas);
  });
});
