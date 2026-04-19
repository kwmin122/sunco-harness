// Phase 51 fixture — swallowed-catch POSITIVE case.
// Empty catch block swallows errors silently.

export async function saveUser(user: { id: string; name: string }) {
  try {
    await writeToDb(user);
  } catch (_e) {
    // silently swallow
  }
}

export function parseJsonSafely(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeToDb(_user: { id: string; name: string }): Promise<void> {
  // placeholder
}
