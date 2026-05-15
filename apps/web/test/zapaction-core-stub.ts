// apps/web/test/zapaction-core-stub.ts
// @zapaction/core's setActionContext throws on import when window is defined
// (asserts server-only). happy-dom has window, so the assertion fires before
// any test code runs. The stub provides import-safe no-op equivalents — tests
// never invoke the runtime contract beyond hook construction.

export function setActionContext(_resolver: unknown): void {
  // no-op
}

export function defineAction<I, O, _C>(spec: {
  name: string;
  input?: unknown;
  output?: unknown;
  tags?: unknown;
  handler: (args: { input: I }) => Promise<O>;
}): (input: I) => Promise<O> {
  return (input: I) => spec.handler({ input });
}

// Mirror createFeatureKeys / createFeatureTags shape: input { feature, builders }
// → output { all(), <each builder method>(...args) }. The "all" key returns
// "<feature>:all". Each builder returns a [feature, ...args] tuple.
type Builders = Record<string, (...args: never[]) => readonly unknown[]>;

function createFeature<B extends Builders>(feature: string, builders: B) {
  const out: Record<string, unknown> = {
    all: () => `${feature}:all`,
  };
  for (const key of Object.keys(builders)) {
    out[key] = (...args: unknown[]) => [
      feature,
      key,
      ...(builders[key] as (...a: unknown[]) => readonly unknown[])(...(args as never[])),
    ];
  }
  return out as { all: () => string } & {
    [K in keyof B]: (...args: Parameters<B[K]>) => readonly unknown[];
  };
}

export function createFeatureKeys<B extends Builders>(feature: string, builders: B) {
  return createFeature(feature, builders);
}

export function createFeatureTags<B extends Builders>(feature: string, builders: B) {
  return createFeature(feature, builders);
}
