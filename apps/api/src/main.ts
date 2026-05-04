import { startServer } from "./app";
import { ConfigError } from "./config/env";

try {
  await startServer();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error("[api] invalid env:", JSON.stringify(err.fieldErrors, null, 2));
    process.exit(1);
  }
  console.error("[api] startup failed:", err);
  process.exit(1);
}
