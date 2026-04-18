// Positive fixture — swallowed-catch MUST fire.
// Empty catch block swallows the error; bare `return;` also discards context.

export async function tryDeliver(message: string): Promise<void> {
  try {
    await sendMessage(message);
  } catch {
    // Silence — no rethrow, no log, no metric. Classic swallow.
  }
}

export async function maybeLoadCache(key: string): Promise<string | null> {
  try {
    return await readCache(key);
  } catch (_err) {
    return;
  }
}

declare function sendMessage(m: string): Promise<void>;
declare function readCache(k: string): Promise<string>;
