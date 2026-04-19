// Phase 51 fixture — logged-secret NEGATIVE case.
// All sensitive fields have redacted string-literal values.

export function debugAuth(user: { id: string; password: string; token: string }) {
  // eslint-disable-next-line no-console
  console.log('auth attempt', { userId: user.id, password: '[REDACTED]', token: '[REDACTED]' });
}

export function dumpCredentials(_creds: { apiKey: string; secret: string }) {
  // eslint-disable-next-line no-console
  console.log({ apiKey: '[REDACTED]', secret: '[REDACTED]' });
}
