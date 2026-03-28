import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  dts: true,
  clean: true,
  external: ['better-sqlite3', 'ai', '@ai-sdk/anthropic'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
