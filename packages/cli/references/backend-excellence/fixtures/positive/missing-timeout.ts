// Positive fixture — missing-timeout MUST fire.
// fetch + axios.get calls with no timeout/signal option = unbounded wait risk.

declare const axios: {
  get(url: string, config?: Record<string, unknown>): Promise<{ data: unknown }>;
};

export async function loadProfile(userId: string) {
  const res = await fetch(`https://api.example.com/users/${userId}`);
  return res.json();
}

export async function loadBillingSummary(userId: string) {
  const res = await axios.get(`https://billing.example.com/summary/${userId}`);
  return res.data;
}
