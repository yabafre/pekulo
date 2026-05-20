export interface ProbeResult {
  ok: boolean;
  reason?: string;
}

type ReadinessProbe = () => Promise<ProbeResult>;

interface ReadinessReport {
  ready: boolean;
  probes: Record<string, ProbeResult>;
}

export interface Readiness {
  register(name: string, probe: ReadinessProbe): void;
  check(): Promise<ReadinessReport>;
}

const PROBE_TIMEOUT_MS = 2_000;

async function runProbe(name: string, probe: ReadinessProbe): Promise<[string, ProbeResult]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ProbeResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: "probe timeout" }), PROBE_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([probe(), timeout]);
    return [name, result];
  } catch (err) {
    return [name, { ok: false, reason: err instanceof Error ? err.message : String(err) }];
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function createReadiness(): Readiness {
  const probes = new Map<string, ReadinessProbe>();
  return {
    register(name, probe) {
      probes.set(name, probe);
    },
    async check() {
      const entries = await Promise.all(
        Array.from(probes.entries(), ([name, probe]) => runProbe(name, probe)),
      );
      const results: Record<string, ProbeResult> = Object.fromEntries(entries);
      const ready = entries.every(([, r]) => r.ok);
      return { ready, probes: results };
    },
  };
}
