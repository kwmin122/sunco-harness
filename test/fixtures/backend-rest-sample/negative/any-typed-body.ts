// Phase 51 fixture — any-typed-body NEGATIVE case.
// First parameter is `any`, but body calls validator (parse/safeParse) so detector skips.

interface UserSchema {
  name: string;
  email: string;
}

const schema = {
  parse: (raw: unknown): UserSchema => {
    const r = raw as Record<string, unknown>;
    return { name: String(r.name), email: String(r.email) };
  },
};

export function createUser(body: any): UserSchema {
  const user = schema.parse(body);
  return user;
}
