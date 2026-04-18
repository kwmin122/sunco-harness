// Negative fixture — logged-secret MUST NOT fire.
// Redacted placeholders + omission of secret fields.

declare const logger: {
  info(obj: Record<string, unknown>): void;
  error(obj: Record<string, unknown>): void;
};

export function logLogin(user: { email: string }) {
  // Secret omitted entirely.
  logger.info({ event: 'login', email: user.email });
}

export function logRequestRedacted(headers: Record<string, string>) {
  // Secret replaced with the canonical redaction marker.
  logger.info({
    event: 'request',
    authorization: '[REDACTED]',
    token: '***',
    path: '/api',
  });
}
