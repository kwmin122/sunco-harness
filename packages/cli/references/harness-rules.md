# Harness Rules

SUNCO's deterministic enforcement layer. Zero LLM cost. Runs before any agent sees the code. If the harness fails, nothing proceeds.

---

## Philosophy

The harness is the immune system of the codebase. It enforces rules that are cheap to check but expensive to debug when violated. Every rule here:

1. Is deterministic — same input, same output, every time
2. Requires zero AI judgment — the rule either passes or fails
3. Runs fast — all rules combined should finish in < 30 seconds
4. Blocks progression — lint-gate failures stop execution, not just warn

This is **harnessing engineering**: set up the field so agents make fewer mistakes, not catch mistakes after they happen.

---

## Lint Rules (ESLint Flat Config)

### ESLint configuration

```javascript
// eslint.config.mjs
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'

export default tseslint.config(
  tseslint.configs.strictTypeChecked,
  boundaries.configs.strict,
  {
    rules: {
      // Type safety
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',

      // Nullability
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',

      // Style
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Anti-patterns
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-process-exit': 'error',  // Use proper error propagation
    }
  }
)
```

### Key rules and what they catch

| Rule | What it catches |
|------|----------------|
| `explicit-function-return-type` | Functions with inferred `any` return type, missing types on public APIs |
| `no-explicit-any` | Type escape hatches that bypass type safety |
| `no-non-null-assertion` | `value!` assertions that hide potential null pointer errors |
| `strict-boolean-expressions` | `if (value)` where value could be `""`, `0`, `undefined` |
| `no-unsafe-assignment` | `const x = apiResponse.data` without type assertion |
| `consistent-type-imports` | Inconsistent import style (`import type` vs `import`) |
| `no-console` | Accidental debug logging left in production code |

---

## Architecture Enforcement (eslint-plugin-boundaries)

Enforces import direction rules between architectural layers. A lower layer cannot import from a higher layer.

### Layer definitions

```javascript
// eslint.config.mjs
{
  settings: {
    'boundaries/elements': [
      { type: 'domain',    pattern: 'packages/core/src/domain/**' },
      { type: 'service',   pattern: 'packages/core/src/services/**' },
      { type: 'infra',     pattern: 'packages/core/src/infra/**' },
      { type: 'skill',     pattern: 'packages/skills-*/src/**' },
      { type: 'cli',       pattern: 'packages/cli/src/**' },
    ]
  },
  rules: {
    'boundaries/element-types': ['error', {
      default: 'disallow',
      rules: [
        // Domain can only import from domain
        { from: 'domain', allow: ['domain'] },
        // Service imports domain
        { from: 'service', allow: ['domain', 'service'] },
        // Infra imports service and domain
        { from: 'infra', allow: ['domain', 'service', 'infra'] },
        // Skills import core (domain + service + infra)
        { from: 'skill', allow: ['domain', 'service', 'infra', 'skill'] },
        // CLI imports everything
        { from: 'cli', allow: ['domain', 'service', 'infra', 'skill', 'cli'] },
      ]
    }]
  }
}
```

### Import direction violations

**Violation example:**
```typescript
// packages/core/src/domain/skill.ts
import { SqliteAdapter } from '../infra/sqlite-adapter.js'  // ERROR: domain → infra
```

**Fix:**
```typescript
// Inject the dependency instead of importing it directly
// Domain defines the interface, infra implements it
export interface SkillStateAdapter {
  get(key: string): unknown
  set(key: string, value: unknown): void
}
```

### Circular dependency detection

ESLint's `import/no-cycle` rule (or `boundaries` equivalent) catches circular imports:

```
packages/core/src/a.ts → b.ts → a.ts  // CIRCULAR
```

Circular deps cause module initialization failures and make code untestable. All must be eliminated.

---

## TypeScript Compilation

### tsconfig requirements

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Key `strict` mode checks

| Check | What it catches |
|-------|----------------|
| `strictNullChecks` | Unchecked `null` and `undefined` dereferences |
| `strictFunctionTypes` | Function parameter type contravariance violations |
| `noImplicitAny` | Variables inferred as `any` |
| `noUncheckedIndexedAccess` | Array/object index access without null check |
| `exactOptionalPropertyTypes` | Optional properties assigned `undefined` explicitly |

### Acceptable tsc error count

- 0 errors: required to pass lint-gate
- Any tsc errors: lint-gate FAILS

---

## Health Checks (Node / Deps / Build)

These checks run as part of `/sunco:health`. They produce a score, not a hard block (unlike lint-gate which hard-blocks).

### Node.js version

```bash
node --version
```

- >= 24: full score
- 22.x: minor deduction, note to upgrade
- < 22: major deduction, warning

### Dependency audit

```bash
npm audit --json
```

- Critical vulnerabilities: hard flag (not score deduction — must be reviewed)
- High: -10 points each from dependencies score
- Moderate: -3 points each
- Low: capped at -5 total

### Build validation

```bash
npm run build --workspaces 2>&1
```

- Clean build: full score
- Build warnings: minor deduction
- Build errors: zero score for build dimension

### Unused dependency check (heuristic)

For each package in `package.json` dependencies:
- Check if the package name appears in any source file import
- Flag packages not found in any `import` statement as "potentially unused"
- This is advisory — not all package usage is via import (e.g., CLI tools, postinstall scripts)

---

## Guard Mode (File Watcher)

`/sunco:guard` starts a persistent file watcher. On every file save, it runs a subset of the lint rules.

### Guard configuration

```toml
[guard]
# Run on save
on_save = ["eslint", "tsc-incremental"]

# Files to watch
watch_patterns = ["packages/**/*.ts", "packages/**/*.tsx"]

# Ignore patterns
ignore_patterns = ["**/dist/**", "**/.sun/**", "**/node_modules/**"]

# Strict mode: fail on warnings
strict = false
```

### Guard vs. full lint

| Mode | Speed | Checks | When |
|------|-------|--------|------|
| Guard (on save) | < 2s | ESLint on changed file + tsc incremental | During development |
| Full lint (lint-gate) | 5-30s | All ESLint + full tsc + architecture | After plan execution, before commit |
| CI lint | 30-120s | Full lint + tests + build | On push |

### Guard behavior

- **Pass**: show checkmark in terminal, no noise
- **Warn**: show warning inline, do not block
- **Error**: show error prominently with file:line reference, do not block save

Guard mode does not block file saves — it observes and reports. The hard block is the lint-gate.

---

## Lint-Gate (Mandatory Post-Execution)

The lint-gate is the enforcement mechanism for execution. It runs after every plan completes in `/sunco:execute`. It is not optional.

```bash
# Primary command
sunco lint

# Fallback (if SUNCO binary not available)
npx eslint packages/ --max-warnings 0 && npx tsc --noEmit
```

### Lint-gate rules

| Condition | Action |
|-----------|--------|
| Zero ESLint errors + zero tsc errors | PASS — continue |
| Any ESLint error | FAIL — stop execution |
| Any tsc error | FAIL — stop execution |
| ESLint warnings only | PASS (warnings allowed) |

### Why warnings don't fail the gate

Lint errors = a rule you configured as blocking is violated. These represent commitments.
Warnings = informational. Use warnings for "things we'd like to fix eventually" — they do not block.

If a rule is important enough to block, it should be configured as `'error'`, not `'warn'`.

---

## Custom Rule Authoring

SUNCO supports project-specific custom ESLint rules. Place in `packages/core/src/lint-rules/`.

### Rule structure

```typescript
// packages/core/src/lint-rules/no-hardcoded-commands.ts
import { RuleTester } from '@typescript-eslint/rule-tester'
import { createRule } from '@typescript-eslint/utils'

export const noHardcodedCommands = createRule({
  name: 'no-hardcoded-commands',
  meta: {
    type: 'problem',
    docs: {
      description: 'All CLI commands must be registered via defineSkill(), not hardcoded',
    },
    schema: [],
    messages: {
      noHardcoded: 'Use defineSkill() to register commands. Hardcoded command strings are not allowed.',
    },
  },
  create(context) {
    return {
      // Rule implementation
    }
  },
})
```

### Register in ESLint config

```javascript
import { noHardcodedCommands } from './packages/core/src/lint-rules/no-hardcoded-commands.js'

export default [
  {
    plugins: { sunco: { rules: { 'no-hardcoded-commands': noHardcodedCommands } } },
    rules: { 'sunco/no-hardcoded-commands': 'error' }
  }
]
```

### Testing custom rules

```typescript
const tester = new RuleTester()
tester.run('no-hardcoded-commands', noHardcodedCommands, {
  valid: [
    { code: `defineSkill({ id: 'lint', ... })` },
  ],
  invalid: [
    {
      code: `program.command('lint').action(...)`,
      errors: [{ messageId: 'noHardcoded' }],
    },
  ],
})
```
