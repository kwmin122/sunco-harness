import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/init.skill.ts',
    'src/lint.skill.ts',
    'src/health.skill.ts',
    'src/agents.skill.ts',
    'src/guard.skill.ts',
  ],
  format: ['esm'],
  target: 'node22',
  dts: true,
  clean: true,
  external: [
    '@sunco/core',
    'eslint',
    'eslint-plugin-boundaries',
    'typescript-eslint',
    'chokidar',
  ],
});
