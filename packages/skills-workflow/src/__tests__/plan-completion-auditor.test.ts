import { describe, it, expect } from 'vitest';
import { extractPlanTasks, auditPlanCompletion } from '../shared/plan-completion-auditor.js';

describe('plan-completion-auditor', () => {
  describe('extractPlanTasks', () => {
    it('extracts checkbox tasks', () => {
      const tasks = extractPlanTasks('- [ ] Create `src/foo.ts`\n- [x] Update `src/bar.ts`');
      expect(tasks).toHaveLength(2);
      expect(tasks[0].description).toContain('Create');
      expect(tasks[0].files).toContain('src/foo.ts');
    });

    it('extracts numbered steps', () => {
      const tasks = extractPlanTasks('1. Implement the handler in src/handler.ts\n2. Add unit tests for handler');
      expect(tasks).toHaveLength(2);
    });

    it('extracts bold imperatives', () => {
      const tasks = extractPlanTasks('**Create** shared/new-util.ts with export function');
      expect(tasks).toHaveLength(1);
      expect(tasks[0].description).toContain('Create');
    });

    it('extracts file paths from descriptions', () => {
      const tasks = extractPlanTasks('- [ ] Modify packages/core/src/index.ts');
      expect(tasks[0].files).toContain('packages/core/src/index.ts');
    });

    it('returns empty for no actionable items', () => {
      expect(extractPlanTasks('# Just a heading\nSome prose.')).toEqual([]);
    });
  });

  describe('auditPlanCompletion', () => {
    it('marks tasks as DONE when files match', () => {
      const plan = '- [ ] Create `src/foo.ts`\n- [ ] Create `src/bar.ts`';
      const result = auditPlanCompletion(plan, ['src/foo.ts', 'src/bar.ts']);
      expect(result.done).toBe(2);
      expect(result.completionPercent).toBe(100);
    });

    it('marks tasks as NOT_DONE when files missing', () => {
      const plan = '- [ ] Create `src/foo.ts`\n- [ ] Create `src/bar.ts`';
      const result = auditPlanCompletion(plan, ['src/other.ts']);
      expect(result.notDone).toBe(2);
    });

    it('marks tasks as PARTIAL when some files match', () => {
      const plan = '- [ ] Modify `src/a.ts` and `src/b.ts`';
      const result = auditPlanCompletion(plan, ['src/a.ts']);
      expect(result.partial).toBe(1);
    });

    it('returns 100% for no extractable tasks', () => {
      const result = auditPlanCompletion('Just prose.', ['a.ts']);
      expect(result.completionPercent).toBe(100);
      expect(result.summary).toContain('No extractable tasks');
    });

    it('summary shows counts', () => {
      const plan = '- [ ] Create `src/a.ts`\n- [ ] Create `src/b.ts`\n- [ ] Create `src/c.ts`';
      const result = auditPlanCompletion(plan, ['src/a.ts']);
      expect(result.summary).toContain('/3');
    });
  });
});
