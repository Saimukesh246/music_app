export type Sleep = (ms: number) => Promise<void>;

export interface ThrottleDeps {
  sleep?: Sleep;
  now?: () => number;
}

export function createThrottle(
  minIntervalMs: number,
  deps: ThrottleDeps = {}
): <T>(fn: () => Promise<T>) => Promise<T> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? Date.now;

  let lastCallAt: number | null = null;
  let chain: Promise<void> = Promise.resolve();

  return function throttled<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      if (lastCallAt !== null) {
        const wait = Math.max(0, lastCallAt + minIntervalMs - now());
        if (wait > 0) await sleep(wait);
      }
      lastCallAt = now();
      return fn();
    };

    const scheduled = chain.then(run, run);
    chain = scheduled.then(
      () => undefined,
      () => undefined
    );
    return scheduled;
  };
}
