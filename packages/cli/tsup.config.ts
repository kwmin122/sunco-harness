import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  dts: false,
  clean: true,
  shims: false,
  banner: {
    // Inject CJS require() shim so bundled CJS deps can use require('fs'), require('child_process'), etc.
    js: `#!/usr/bin/env node
import { createRequire as __createRequire } from 'module';
const require = __createRequire(import.meta.url);`,
  },
  // Bundle workspace packages AND pure-JS runtime deps into the CLI binary.
  // This makes the installed artifact self-contained (P0-2).
  //
  // Only keep external:
  //   - Native modules that need compilation (better-sqlite3)
  //   - Large UI frameworks with dynamic import + fallback (ink/react)
  //   - AI SDKs with dynamic import + availability check (ai/@ai-sdk)
  //   - ESLint ecosystem (large, CJS, only used by lint/guard skills)
  //
  // Bundled (moved from external): execa, simple-git, chokidar
  // These are pure JS and required for core CLI operations.
  noExternal: [
    '@sunco/core', '@sunco/skills-harness', '@sunco/skills-workflow',
    // Pure JS deps bundled for self-contained runtime
    // CJS require() calls are shimmed via banner createRequire()
    'execa', 'simple-git', 'chokidar',
  ],
  external: [
    'better-sqlite3',
    // Ink UI framework (dynamically imported in InkUiAdapter, SilentUiAdapter fallback)
    'ink', 'ink-spinner', 'ink-select-input', 'ink-text-input',
    'react', 'react-devtools-core',
    // AI SDK (dynamically imported by agent router with availability check)
    'ai', '@ai-sdk/anthropic',
    // ESLint ecosystem (CJS, only needed by lint/guard skills)
    'eslint', 'eslint-plugin-boundaries', 'typescript-eslint',
  ],
});
