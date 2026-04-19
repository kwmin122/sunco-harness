// Phase 51 fixture — logged-secret POSITIVE case.
// console.log / logger call exposes secret fields.

export function debugAuth(user: { id: string; password: string; token: string }) {
  // eslint-disable-next-line no-console
  console.log('auth attempt', { userId: user.id, password: user.password, token: user.token });
}

export function dumpCredentials(creds: { apiKey: string; secret: string }) {
  // eslint-disable-next-line no-console
  console.log({ apiKey: creds.apiKey, secret: creds.secret });
}
