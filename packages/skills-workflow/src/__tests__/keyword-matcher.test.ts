import { describe, it, expect } from 'vitest';
import { detectProactiveSuggestion, formatProactiveSuggestion } from '../shared/keyword-matcher.js';

describe('keyword-matcher', () => {
  describe('detectProactiveSuggestion', () => {
    it('detects verify intent', () => {
      const s = detectProactiveSuggestion('does this feature work correctly?');
      expect(s).not.toBeNull();
      expect(s!.skillId).toBe('workflow.verify');
    });

    it('detects debug intent from error mention', () => {
      const s = detectProactiveSuggestion('why is this broken?');
      expect(s).not.toBeNull();
      expect(s!.skillId).toBe('workflow.debug');
    });

    it('detects ship intent', () => {
      const s = detectProactiveSuggestion("let's ship this to production");
      expect(s).not.toBeNull();
      expect(s!.skillId).toBe('workflow.ship');
    });

    it('detects review intent', () => {
      const s = detectProactiveSuggestion('can you review my code changes?');
      expect(s).not.toBeNull();
      expect(s!.skillId).toBe('workflow.review');
    });

    it('detects plan intent', () => {
      const s = detectProactiveSuggestion('how should I approach this feature?');
      expect(s).not.toBeNull();
      expect(s!.skillId).toBe('workflow.plan');
    });

    it('detects Korean debug intent', () => {
      const s = detectProactiveSuggestion('왜 안돼?');
      expect(s).not.toBeNull();
      expect(s!.skillId).toBe('workflow.debug');
    });

    it('returns null for unrelated input', () => {
      expect(detectProactiveSuggestion('good morning')).toBeNull();
    });
  });

  describe('formatProactiveSuggestion', () => {
    it('formats suggestion string', () => {
      const s = detectProactiveSuggestion('why did this crash?')!;
      const formatted = formatProactiveSuggestion(s);
      expect(formatted).toContain('/sunco:debug');
      expect(formatted).toContain('might help');
    });
  });
});
