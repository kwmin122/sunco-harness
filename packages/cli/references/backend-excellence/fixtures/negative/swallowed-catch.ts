// Negative fixture — swallowed-catch MUST NOT fire.
// Catch blocks that log + rethrow / return a typed error / record a metric are healthy.

declare const logger: { error(msg: string, meta?: unknown): void };
declare const metrics: { increment(name: string): void };

export async function tryDeliverLogAndRethrow(message: string): Promise<void> {
  try {
    await sendMessage(message);
  } catch (err) {
    logger.error('sendMessage failed', { err, message });
    throw err;
  }
}

export async function maybeLoadCacheWithTypedFallback(key: string): Promise<string | null> {
  try {
    return await readCache(key);
  } catch (err) {
    logger.error('cache read failed', { err, key });
    metrics.increment('cache.read.fail');
    return null;
  }
}

declare function sendMessage(m: string): Promise<void>;
declare function readCache(k: string): Promise<string>;
