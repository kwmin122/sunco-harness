// Positive fixture — logged-secret MUST fire.
// Logger call embeds a secret-keyed field (password / authorization) directly.

declare const logger: {
  info(obj: Record<string, unknown>): void;
  error(obj: Record<string, unknown>): void;
};

export function logLogin(user: { email: string; password: string }) {
  logger.info({ event: 'login', email: user.email, password: user.password });
}

export function logRequest(headers: Record<string, string>) {
  console.log({ method: 'POST', authorization: headers.authorization, path: '/api' });
}
