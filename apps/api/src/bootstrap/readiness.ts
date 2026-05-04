export interface ProbeResult {
  ok: boolean;
  reason?: string;
}

export type ReadinessProbe = () => Promise<ProbeResult>;

export interface ReadinessReport {
  ready: boolean;
  probes: Record<string, ProbeResult>;
}

export interface Readiness {
  register(name: string, probe: ReadinessProbe): void;
  check(): Promise<ReadinessReport>;
}

export function createReadiness(): Readiness {
  const probes = new Map<string, ReadinessProbe>();
  return {
    register(name, probe) {
      probes.set(name, probe);
    },
    async check() {
      const results: Record<string, ProbeResult> = {};
      let allOk = true;
      for (const [name, probe] of probes.entries()) {
        const result = await probe();
        results[name] = result;
        if (!result.ok) {
          allOk = false;
        }
      }
      return { ready: allOk, probes: results };
    },
  };
}
