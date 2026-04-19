// Phase 51 fixture — any-typed-body POSITIVE case.
// Handler's first parameter typed as `any` — no validator call in body.

export function createUser(body: any): { ok: true } {
  return { ok: true };
}

export const updateUser = (patch: any): { updated: true } => {
  return { updated: true };
};
