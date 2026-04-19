// Phase 51 fixture — swallowed-catch NEGATIVE case.
// Catch block logs with context and rethrows.

const logger = {
  error: (msg: string, ctx: unknown): void => {
    // eslint-disable-next-line no-console
    console.error(msg, ctx);
  },
};

export async function saveUser(user: { id: string; name: string }) {
  try {
    await writeToDb(user);
  } catch (e) {
    logger.error('saveUser failed', { userId: user.id, error: e });
    throw e;
  }
}

async function writeToDb(_user: { id: string; name: string }): Promise<void> {
  // placeholder
}
