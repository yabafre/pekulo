import { Elysia } from "elysia";
import { loadEnv } from "./config/env";
import { createRuntimeDependencies } from "./bootstrap/runtime-dependencies";
import { registerLifecycle } from "./bootstrap/lifecycle";
import { createHealthModule } from "./modules/health/health.module";

export interface ServerHandle {
  stop: () => Promise<void>;
}

export async function startServer(): Promise<ServerHandle> {
  const env = loadEnv();
  const deps = await createRuntimeDependencies({ env });
  const healthModule = createHealthModule({ readiness: deps.readiness });

  const app = new Elysia()
    .onError(({ code, error, set }) => {
      console.error(`[api] error code=${String(code)}`, error);
      if (set.status === undefined || set.status === 200) {
        set.status = 500;
      }
      return {
        error: {
          code: String(code),
          message: error instanceof Error ? error.message : String(error),
        },
      };
    })
    .use(healthModule.routes);

  await registerLifecycle(app, deps);

  app.listen({ port: env.PORT, hostname: env.HOST }, (server) => {
    console.log(`[api] listening on http://${server.hostname}:${server.port}`);
  });

  return {
    stop: async () => {
      await app.stop();
    },
  };
}
