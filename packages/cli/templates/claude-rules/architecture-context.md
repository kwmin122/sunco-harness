---
patterns:
  - "packages/core/**"
  - "packages/cli/**"
  - "packages/skills-harness/**"
  - "packages/skills-workflow/**"
---

# Architecture Boundaries

- `packages/core/` — foundation. Exports primitives. NEVER imports from skill packages.
- `packages/skills-harness/` — deterministic skills. Imports from core only.
- `packages/skills-workflow/` — agent-powered skills. Imports from core. May import shared types from skills-harness.
- `packages/cli/` — composition root. Imports from all packages. This is the only package that wires everything together.

# Import Direction (enforced by ESLint boundaries plugin)
```
cli → core, skills-harness, skills-workflow
skills-workflow → core, skills-harness (shared types only)
skills-harness → core
core → nothing in packages/ (only node_modules)
```

# Naming Conventions
- ESM-only: use `.js` extension in imports even for `.ts` source files
- Barrel exports: `index.ts` per package with explicit re-exports
- Dynamic imports for optional deps: `await import('execa')`
