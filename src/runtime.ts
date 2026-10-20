export class DeadlineError extends Error {
  constructor() { super('Operation timed out'); }
}

export async function withDeadline<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DeadlineError()), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Stop scheduling first, then drain in-flight work before closing its dependencies. */
export function createShutdown(options: {
  stop?: () => void;
  steps: Array<() => Promise<unknown>>;
  timeoutMs: number;
  onFailure: (error: unknown) => void;
}): () => Promise<void> {
  let pending: Promise<void> | undefined;
  return () => {
    pending ??= withDeadline(async () => {
      options.stop?.();
      for (const step of options.steps) await step();
    }, options.timeoutMs).catch(options.onFailure);
    return pending;
  };
}

export function installShutdownSignals(shutdown: () => Promise<void>): void {
  // Keep handlers installed while draining: a second signal must not interrupt cleanup.
  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });
}

export function startSerialPoll(options: {
  run: () => Promise<void>;
  intervalMs: number;
  onError: (error: unknown) => void;
}): { stop: () => void; drain: () => Promise<void> } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void>;
  const tick = () => {
    active = Promise.resolve().then(options.run).catch(options.onError).then(() => {
      if (!stopped) {
        timer = setTimeout(tick, options.intervalMs);
        timer.unref();
      }
    });
  };
  tick();
  return {
    stop: () => { stopped = true; clearTimeout(timer); },
    drain: () => active
  };
}
