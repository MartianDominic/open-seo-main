import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { validateEnv, REQUIRED_ENV_CORE } from "@/server/lib/runtime-env";

// Fail fast on missing required environment variables. Runs once per process.
validateEnv(REQUIRED_ENV_CORE);

const fetch = createStartHandler(defaultStreamHandler);

export default {
  fetch,
};
