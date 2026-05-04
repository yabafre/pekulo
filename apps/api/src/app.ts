import { Elysia } from "elysia";
import { loadEnv } from "./config/env";
import { createRuntimeDependencies } from "./bootstrap/runtime-dependencies";
import { registerLifecycle } from "./bootstrap/lifecycle";
import { createHealthModule } from "./modules/health/health.module";
import { mapErrorToOrpcResponse } from "./platform/http/error-mapper";
import { mountOrpc } from "./platform/http/orpc-mount";

export interface ServerHandle {
  stop: () => Promise<void>;
}

export async function startServer(): Promise<ServerHandle> {
  const env = loadEnv();
  const deps = await createRuntimeDependencies({ env });
  const healthModule = createHealthModule({ readiness: deps.readiness });

  // L2 — let Elysia infer the chained type; never annotate the variable with the bare Elysia type.
  const app = new Elysia()
    .onError(({ error, set }) => {
      // Generate the requestId BEFORE the log so the log line and the wire
      // body share the same correlation handle (review F3). Emit one
      // structured log carrying { requestId, code, name } — never the raw
      // Error object, which would dump message + stack + cause to stdout.
      const requestId = crypto.randomUUID();
      const mapped = mapErrorToOrpcResponse(error, requestId);
      console.error("[api] error", {
        requestId,
        code: mapped.body.error.code,
        name: error instanceof Error ? error.name : typeof error,
      });
      set.status = mapped.status;
      return mapped.body;
    })
    .use(healthModule.router);

  mountOrpc(app, { jwtVerifier: deps.jwtVerifier, orpcRouter: deps.orpcRouter });

  await registerLifecycle(
    app,
    { shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS },
    { prismaService: deps.prismaService },
  );

  app.listen({ port: env.PORT, hostname: env.HOST }, (server) => {
    console.log(`[api] listening on http://${server.hostname}:${server.port}`);
  });

  return {
    stop: async () => {
      await app.stop();
    },
  };
}
