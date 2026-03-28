import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node22',
  dts: false,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Bundle workspace packages into the CLI binary for npm distribution.
  // Only native modules and optional runtime dependencies remain external.
  noExternal: ['@sunco/core', '@sunco/skills-harness'],
  external: [
    'better-sqlite3',
    // Ink UI framework and its React dependencies (loaded dynamically at runtime)
    'ink', 'ink-spinner', 'ink-select-input', 'ink-text-input',
    'react', 'react-devtools-core',
    // AI SDK (dynamically imported by agent router)
    'ai', '@ai-sdk/anthropic',
    // execa (dynamically imported by ClaudeCliProvider -- cross-spawn uses require())
    'execa',
    // ESLint ecosystem (CJS packages, used by lint/guard skills at runtime)
    'eslint', 'eslint-plugin-boundaries', 'typescript-eslint',
    // File watcher (used by guard skill watch mode)
    'chokidar',
  ],
});
