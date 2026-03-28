import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/status.skill.ts',
    'src/next.skill.ts',
    'src/context.skill.ts',
    'src/pause.skill.ts',
    'src/resume.skill.ts',
    'src/note.skill.ts',
    'src/todo.skill.ts',
    'src/seed.skill.ts',
    'src/backlog.skill.ts',
    'src/phase.skill.ts',
    'src/settings.skill.ts',
  ],
  format: ['esm'],
  target: 'node22',
  dts: true,
  clean: true,
  external: [
    '@sunco/core',
    'simple-git',
  ],
});
