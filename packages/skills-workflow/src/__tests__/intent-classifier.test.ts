/**
 * Tests for intent-classifier.ts — deterministic user input classification.
 * Requirements: LH-06
 */

import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../shared/intent-classifier.js';

describe('classifyIntent', () => {
  it('classifies lookup intents', () => {
    expect(classifyIntent('find the config file').intent).toBe('lookup');
    expect(classifyIntent('where is the router?').intent).toBe('lookup');
    expect(classifyIntent('show me the tests').intent).toBe('lookup');
    expect(classifyIntent('list all skills').intent).toBe('lookup');
  });

  it('classifies implement intents', () => {
    expect(classifyIntent('add a new feature').intent).toBe('implement');
    expect(classifyIntent('create the login page').intent).toBe('implement');
    expect(classifyIntent('fix the bug in auth').intent).toBe('implement');
    expect(classifyIntent('refactor the router').intent).toBe('implement');
  });

  it('classifies investigate intents', () => {
    expect(classifyIntent('why is this failing?').intent).toBe('investigate');
    expect(classifyIntent('debug the test error').intent).toBe('investigate');
    expect(classifyIntent('something is broken and crashing').intent).toBe('investigate');
  });

  it('classifies plan intents', () => {
    expect(classifyIntent('plan the architecture').intent).toBe('plan');
    expect(classifyIntent('design the new API').intent).toBe('plan');
    expect(classifyIntent('create a roadmap').intent).toBe('plan');
  });

  it('classifies review intents', () => {
    expect(classifyIntent('review the PR').intent).toBe('review');
    expect(classifyIntent('verify the implementation').intent).toBe('review');
    expect(classifyIntent('audit the security').intent).toBe('review');
  });

  it('handles Korean keywords', () => {
    expect(classifyIntent('설정 파일 찾아줘').intent).toBe('lookup');
    expect(classifyIntent('새 기능 만들어줘').intent).toBe('implement');
    expect(classifyIntent('왜 에러가 나는지 확인해줘').intent).toBe('investigate');
    expect(classifyIntent('아키텍처 설계해줘').intent).toBe('plan');
    expect(classifyIntent('코드 검토해줘').intent).toBe('review');
  });

  it('returns confidence based on match count', () => {
    // No match -> low confidence default
    const noMatch = classifyIntent('hello world');
    expect(noMatch.confidence).toBeLessThanOrEqual(0.5);

    // Single match -> medium confidence
    const single = classifyIntent('find something');
    expect(single.confidence).toBeGreaterThanOrEqual(0.5);

    // Multiple matches -> high confidence
    const multi = classifyIntent('find and show and list everything');
    expect(multi.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('defaults to implement for ambiguous input', () => {
    const result = classifyIntent('do something with this');
    expect(result.intent).toBe('implement');
  });
});
