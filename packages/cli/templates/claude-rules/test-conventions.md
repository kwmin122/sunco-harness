---
patterns:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/__tests__/**"
---

# Test Conventions

- Test files go in `__tests__/` directories, not next to source files
- Use `describe` → `it` nesting. One `describe` per exported function or class.
- Mock pattern: `vi.hoisted()` for mock variables used in `vi.mock()` factories
- Never modify existing tests to make them pass — fix the implementation instead
- Every test must be independent — no shared mutable state between `it()` blocks
- Use `expect().toBe()` for primitives, `expect().toEqual()` for objects
- Test file naming: `{module-name}.test.ts` matching the source file name
- Prefer real implementations over mocks. Mock only external dependencies (network, file system, time)
