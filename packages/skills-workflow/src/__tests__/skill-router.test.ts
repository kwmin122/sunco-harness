import { describe, it, expect } from 'vitest';
import {
  parseRoutingSection,
  matchRoute,
  generateRoutingSection,
  DEFAULT_ROUTING_RULES,
} from '../shared/skill-router.js';

describe('skill-router', () => {
  describe('DEFAULT_ROUTING_RULES', () => {
    it('has at least 10 rules', () => {
      expect(DEFAULT_ROUTING_RULES.length).toBeGreaterThanOrEqual(10);
    });

    it('includes Korean triggers', () => {
      const allTriggers = DEFAULT_ROUTING_RULES.flatMap((r) => r.triggers);
      expect(allTriggers.some((t) => /[\uAC00-\uD7AF]/.test(t))).toBe(true);
    });
  });

  describe('parseRoutingSection', () => {
    it('parses arrow-separated rules', () => {
      const content = `# Project
## Skill routing
- bugs, errors → workflow.debug
- ship, deploy → workflow.ship
## Other`;
      const rules = parseRoutingSection(content);
      expect(rules).toHaveLength(2);
      expect(rules[0].skillId).toBe('workflow.debug');
      expect(rules[0].triggers).toContain('bugs');
      expect(rules[1].skillId).toBe('workflow.ship');
    });

    it('handles -> syntax', () => {
      const content = `## Skill routing\n- test -> workflow.verify`;
      const rules = parseRoutingSection(content);
      expect(rules).toHaveLength(1);
      expect(rules[0].skillId).toBe('workflow.verify');
    });

    it('returns empty for no routing section', () => {
      expect(parseRoutingSection('# No routing here')).toEqual([]);
    });

    it('strips quotes from triggers', () => {
      const content = `## Skill routing\n- "qa", "testing" → workflow.verify`;
      const rules = parseRoutingSection(content);
      expect(rules[0].triggers).toContain('qa');
    });
  });

  describe('matchRoute', () => {
    it('matches English keywords', () => {
      const match = matchRoute('there is a bug in the auth flow', DEFAULT_ROUTING_RULES);
      expect(match).not.toBeNull();
      expect(match!.skillId).toBe('workflow.debug');
    });

    it('matches Korean keywords', () => {
      const match = matchRoute('이 에러 왜 나오지?', DEFAULT_ROUTING_RULES);
      expect(match).not.toBeNull();
      expect(match!.skillId).toBe('workflow.debug');
    });

    it('matches ship intent', () => {
      const match = matchRoute('push this to main', DEFAULT_ROUTING_RULES);
      expect(match).not.toBeNull();
      expect(match!.skillId).toBe('workflow.ship');
    });

    it('returns null for no match', () => {
      const match = matchRoute('hello how are you', DEFAULT_ROUTING_RULES);
      expect(match).toBeNull();
    });

    it('prefers custom rules over defaults', () => {
      const custom = [{ triggers: ['bug'], skillId: 'custom.debug', description: 'custom' }];
      const match = matchRoute('fix this bug', [...custom, ...DEFAULT_ROUTING_RULES]);
      expect(match!.skillId).toBe('custom.debug');
    });
  });

  describe('generateRoutingSection', () => {
    it('generates valid markdown', () => {
      const section = generateRoutingSection();
      expect(section).toContain('## Skill routing');
      expect(section).toContain('workflow.debug');
      expect(section).toContain('workflow.ship');
    });
  });
});
