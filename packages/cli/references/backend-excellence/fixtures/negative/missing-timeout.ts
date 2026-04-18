// Negative fixture — missing-timeout MUST NOT fire.
// AbortSignal.timeout(), explicit signal, and axios-with-timeout all count as evidence.

declare const axios: {
  get(url: string, config?: Record<string, unknown>): Promise<{ data: unknown }>;
};

export async function loadProfileWithAbortTimeout(userId: string) {
  const res = await fetch(`https://api.example.com/users/${userId}`, {
    signal: AbortSignal.timeout(5000),
  });
  return res.json();
}

export async function loadProfileWithExternalController(userId: string) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 3000);
  const res = await fetch(`https://api.example.com/users/${userId}`, {
    signal: controller.signal,
  });
  return res.json();
}

export async function loadBillingSummaryWithTimeout(userId: string) {
  const res = await axios.get(`https://billing.example.com/summary/${userId}`, {
    timeout: 2000,
  });
  return res.data;
}
