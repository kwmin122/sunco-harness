import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/settings.skill.ts',
    'src/sample-prompt.skill.ts',
  ],
  format: ['esm'],
  target: 'node22',
  dts: true,
  clean: true,
  external: ['@sunco/core'],
});
