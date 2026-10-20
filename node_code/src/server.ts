import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { createShutdown, installShutdownSignals } from './runtime.js';
import { safeError } from './logging.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildApp(config);
  const shutdown = createShutdown({
    steps: [() => app.close()],
    timeoutMs: config.SHUTDOWN_TIMEOUT_MS ?? 30000,
    onFailure: (error) => {
      app.log.error({ err: safeError(error) }, 'API shutdown failed or exceeded deadline');
      process.exit(1);
    }
  });
  installShutdownSignals(shutdown);

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
  } catch (error) {
    app.log.error({ err: safeError(error) }, 'API startup failed');
    process.exitCode = 1;
    await shutdown();
  }
}

main().catch((error: unknown) => {
  console.error('API startup failed', safeError(error));
  process.exit(1);
});
