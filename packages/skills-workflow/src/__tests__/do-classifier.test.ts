/**
 * Tests for deterministic category classifier (Phase 27 Plan B).
 */

import { describe, it, expect } from 'vitest';
import { classifyInput } from '../shared/category-classifier.js';

describe('classifyInput', () => {
  // ── quick ────────────────────────────────────────────────────────
  it('classifies "fix typo in README" as quick', () => {
    const r = classifyInput('fix typo in README');
    expect(r.category).toBe('quick');
    expect(r.confidence).toBeGreaterThan(0.3);
  });

  it('classifies "rename this variable" as quick', () => {
    const r = classifyInput('rename this variable');
    expect(r.category).toBe('quick');
  });

  it('classifies "오타 수정해" as quick (Korean)', () => {
    const r = classifyInput('오타 수정해');
    expect(r.category).toBe('quick');
  });

  // ── deep ─────────────────────────────────────────────────────────
  it('classifies "implement phase 27" as deep', () => {
    const r = classifyInput('implement phase 27');
    expect(r.category).toBe('deep');
  });

  it('classifies "build the authentication system" as deep', () => {
    const r = classifyInput('build the authentication system');
    expect(r.category).toBe('deep');
  });

  it('classifies "페이즈 구현해" as deep (Korean)', () => {
    const r = classifyInput('페이즈 구현해');
    expect(r.category).toBe('deep');
  });

  // ── planning ─────────────────────────────────────────────────────
  it('classifies "plan for the new feature" as planning', () => {
    const r = classifyInput('plan for the new feature');
    expect(r.category).toBe('planning');
  });

  it('classifies "how should I approach this" as planning', () => {
    const r = classifyInput('how should I approach this');
    expect(r.category).toBe('planning');
  });

  it('classifies "설계해 줘" as planning (Korean)', () => {
    const r = classifyInput('설계해 줘');
    expect(r.category).toBe('planning');
  });

  // ── review ───────────────────────────────────────────────────────
  it('classifies "review my PR" as review', () => {
    const r = classifyInput('review my PR');
    expect(r.category).toBe('review');
  });

  it('classifies "코드리뷰 해줘" as review (Korean)', () => {
    const r = classifyInput('코드리뷰 해줘');
    expect(r.category).toBe('review');
  });

  // ── debug ────────────────────────────────────────────────────────
  it('classifies "why is this broken" as debug', () => {
    const r = classifyInput('why is this broken');
    expect(r.category).toBe('debug');
  });

  it('classifies "tests failing after update" as debug', () => {
    const r = classifyInput('tests failing after update');
    expect(r.category).toBe('debug');
  });

  it('classifies "왜 안돼" as debug (Korean)', () => {
    const r = classifyInput('왜 안돼');
    expect(r.category).toBe('debug');
  });

  // ── visual ───────────────────────────────────────────────────────
  it('classifies "fix the button hover state" as visual', () => {
    const r = classifyInput('fix the button hover state');
    expect(r.category).toBe('visual');
  });

  it('classifies "improve UI layout" as visual', () => {
    const r = classifyInput('improve UI layout');
    expect(r.category).toBe('visual');
  });

  // ── fallback ─────────────────────────────────────────────────────
  it('falls back to deep with no_match on gibberish', () => {
    const r = classifyInput('xyzzy12345');
    expect(r.category).toBe('deep');
    expect(r.fallback_reason).toBe('no_match');
    expect(r.confidence).toBe(0);
  });

  it('falls back to deep on ambiguous input with low confidence', () => {
    const r = classifyInput('do something');
    expect(r.category).toBe('deep');
    expect(r.fallback_reason).toBeDefined();
  });

  // ── signal tracking ──────────────────────────────────────────────
  it('returns matched_signals with kind and value', () => {
    const r = classifyInput('fix the bug in auth');
    expect(r.matched_signals.length).toBeGreaterThan(0);
    expect(r.matched_signals[0]).toHaveProperty('kind');
    expect(r.matched_signals[0]).toHaveProperty('value');
  });
});
