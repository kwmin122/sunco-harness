/**
 * Tests for the delivery-slice planning pipeline.
 *
 * Covers:
 * 1. parsePlanMd: dual-format detection (legacy vs delivery-slice)
 * 2. parsePlanMd: delivery-slice section extraction
 * 3. parsePlanMd: capabilities frontmatter field
 * 4. groupPlansByWave: works with delivery-slice plans
 * 5. buildProductSpecPrompt: generates valid prompt structure
 * 6. buildSliceContractPrompt: generates valid prompt structure
 * 7. buildPlanCreatePrompt: includes productSpecMd
 * 8. buildPlanCheckerPrompt: includes productSpecMd and product-level dimensions
 */

import { describe, it, expect, vi } from 'vitest';
import { parsePlanMd, groupPlansByWave } from '../shared/plan-parser.js';
import { buildProductSpecPrompt } from '../prompts/product-spec.js';
import { buildSliceContractPrompt } from '../prompts/slice-contract.js';
import { buildPlanCreatePrompt } from '../prompts/plan-create.js';
import { buildPlanCheckerPrompt } from '../prompts/plan-checker.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LEGACY_PLAN = `---
phase: core-platform
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/foo.ts
  - src/bar.ts
autonomous: true
requirements: [REQ-01]
---

<objective>Implement foo and bar</objective>
<context>@src/foo.ts @src/bar.ts</context>
<tasks>
<task type="auto">
  <name>Create foo module</name>
  <files>src/foo.ts</files>
  <action>Create the foo module with export function foo()</action>
  <acceptance_criteria>src/foo.ts contains export function foo</acceptance_criteria>
  <verify><automated>npm test</automated></verify>
  <done>- foo module created</done>
</task>
</tasks>
<verification>npm test</verification>
<success_criteria>All tests pass</success_criteria>`;

const DELIVERY_SLICE_PLAN = `---
phase: harness-evolution
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [REQ-01, REQ-02]
capabilities: ["CEO review skill", "Product-level planning"]
---

## Objective
Deliver the CEO review skill that lets users get a founder-mode perspective on their plan.

## Capabilities
- CEO review with 10-star vision and premise challenges
- Product-level planning that focuses on what to deliver, not how

## Delivery scope
- sunco ceo-review command with --expand/--hold/--selective flags
- Reads all PLAN files, ROADMAP, and design docs
- Writes CEO-REVIEW.md with star rating and scope decision

## Verification intent
- User runs \`sunco ceo-review --phase 25\` and gets a structured review
- Review includes problem restatement, 10-star version, and premise challenges
- Output file CEO-REVIEW.md exists in the phase directory
- Error case: running without a plan shows helpful guidance message

## Technical direction
The CEO review skill follows the established review.skill.ts pattern. It reads phase artifacts via resolvePhaseDir/readPhaseArtifact, sends a product-focused prompt to the agent, and writes the output to the phase directory.

## Dependencies
- Existing plan files for the target phase
- ROADMAP.md for phase context

## Out of scope
- Interactive mode with AskUserQuestion (deferred)
- Integration with eng-review or design-review pipeline`;

// ---------------------------------------------------------------------------
// Tests: parsePlanMd dual-format
// ---------------------------------------------------------------------------

describe('parsePlanMd dual-format', () => {
  it('detects legacy execution format', () => {
    const plan = parsePlanMd(LEGACY_PLAN);

    expect(plan.frontmatter.isDeliverySlice).toBe(false);
    expect(plan.frontmatter.phase).toBe('core-platform');
    expect(plan.frontmatter.files_modified).toEqual(['src/foo.ts', 'src/bar.ts']);
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].name).toBe('Create foo module');
    expect(plan.objective).toContain('foo and bar');
  });

  it('detects delivery-slice format', () => {
    const plan = parsePlanMd(DELIVERY_SLICE_PLAN);

    expect(plan.frontmatter.isDeliverySlice).toBe(true);
    expect(plan.frontmatter.phase).toBe('harness-evolution');
    expect(plan.frontmatter.capabilities).toEqual(['"CEO review skill"', '"Product-level planning"']);
    expect(plan.frontmatter.files_modified).toEqual([]);
    expect(plan.tasks).toHaveLength(0);
  });

  it('extracts delivery-slice sections', () => {
    const plan = parsePlanMd(DELIVERY_SLICE_PLAN);

    expect(plan.objective).toContain('CEO review skill');
    expect(plan.deliveryScope).toContain('sunco ceo-review');
    expect(plan.verificationIntent).toContain('sunco ceo-review --phase 25');
    expect(plan.technicalDirection).toContain('review.skill.ts pattern');
  });

  it('legacy plan has empty delivery-slice fields', () => {
    const plan = parsePlanMd(LEGACY_PLAN);

    expect(plan.deliveryScope).toBe('');
    expect(plan.verificationIntent).toBe('');
    expect(plan.technicalDirection).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: groupPlansByWave with delivery-slice
// ---------------------------------------------------------------------------

describe('groupPlansByWave with delivery-slice', () => {
  it('groups delivery-slice plans by wave', () => {
    const plan1 = parsePlanMd(DELIVERY_SLICE_PLAN);
    const plan2Content = DELIVERY_SLICE_PLAN
      .replace('plan: 01', 'plan: 02')
      .replace('wave: 1', 'wave: 2');
    const plan2 = parsePlanMd(plan2Content);

    const waves = groupPlansByWave([plan1, plan2]);

    expect(waves.size).toBe(2);
    expect(waves.get(1)).toHaveLength(1);
    expect(waves.get(2)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: prompt builders
// ---------------------------------------------------------------------------

describe('buildProductSpecPrompt', () => {
  it('generates a prompt with product-level instructions', () => {
    const prompt = buildProductSpecPrompt({
      contextMd: 'test context',
      researchMd: 'test research',
      requirementsMd: 'test reqs',
      roadmapMd: 'test roadmap',
      phaseGoal: 'Test Phase',
      requirements: ['REQ-01'],
      phaseSlug: 'test',
      paddedPhase: '25',
    });

    expect(prompt).toContain('product architect');
    expect(prompt).toContain('USER language');
    expect(prompt).toContain('DO NOT specify');
    expect(prompt).toContain('File paths or module names');
    expect(prompt).toContain('REQ-01');
  });
});

describe('buildSliceContractPrompt', () => {
  it('generates a prompt that reads the codebase', () => {
    const prompt = buildSliceContractPrompt({
      planContent: DELIVERY_SLICE_PLAN,
      productSpecMd: 'test spec',
      contextMd: 'test context',
      phaseSlug: 'test',
      paddedPhase: '25',
      planNumber: '01',
    });

    expect(prompt).toContain('execution preparation agent');
    expect(prompt).toContain('Read the codebase first');
    expect(prompt).toContain('NEVER guess a file path');
    expect(prompt).toContain('<task type="auto">');
  });
});

describe('buildPlanCreatePrompt with productSpecMd', () => {
  it('includes product spec in the prompt', () => {
    const prompt = buildPlanCreatePrompt({
      contextMd: 'ctx',
      researchMd: 'research',
      requirementsMd: 'reqs',
      roadmapMd: 'roadmap',
      productSpecMd: '# Product Spec\n\nCapability 1: CEO Review',
      phaseGoal: 'Test',
      requirements: ['REQ-01'],
      phaseSlug: 'test',
      paddedPhase: '25',
    });

    expect(prompt).toContain('PRODUCT-SPEC.md');
    expect(prompt).toContain('CEO Review');
    expect(prompt).toContain('delivery slice');
    // files_modified and read_first are in "What NOT to include" section
    expect(prompt).toContain('files_modified');
    expect(prompt).toContain('NOT to include');
  });
});

describe('buildPlanCheckerPrompt with product-level dimensions', () => {
  it('checks product-level dimensions instead of implementation', () => {
    const prompt = buildPlanCheckerPrompt({
      plans: [DELIVERY_SLICE_PLAN],
      contextMd: 'ctx',
      requirementsMd: 'reqs',
      productSpecMd: 'spec',
      phaseRequirements: ['REQ-01'],
    });

    expect(prompt).toContain('capability_alignment');
    expect(prompt).toContain('verification_intent_quality');
    expect(prompt).not.toContain('deep_work_rules');
    expect(prompt).not.toContain('key_links_planned');
  });
});

// ---------------------------------------------------------------------------
// Tests: execute delivery-slice expansion
// ---------------------------------------------------------------------------

describe('execute delivery-slice handling', () => {
  it('parsePlanMd marks delivery-slice with isDeliverySlice=true and empty tasks', () => {
    const plan = parsePlanMd(DELIVERY_SLICE_PLAN);

    // This is the key property that triggers slice-contract expansion in execute.skill.ts
    expect(plan.frontmatter.isDeliverySlice).toBe(true);
    expect(plan.tasks).toHaveLength(0);
    // execute.skill.ts checks: plan.tasks.length > 0 ? buildExecutePrompt : buildRawExecutePrompt
    // With 0 tasks, it should use buildRawExecutePrompt (raw fallback)
  });

  it('legacy plan has tasks and isDeliverySlice=false', () => {
    const plan = parsePlanMd(LEGACY_PLAN);

    expect(plan.frontmatter.isDeliverySlice).toBe(false);
    expect(plan.tasks.length).toBeGreaterThan(0);
    // With tasks > 0, execute uses buildExecutePrompt (structured)
  });

  it('delivery-slice filter in execute identifies correct plans', () => {
    const slicePlan = parsePlanMd(DELIVERY_SLICE_PLAN);
    const legacyPlan = parsePlanMd(LEGACY_PLAN);
    const plans = [slicePlan, legacyPlan];

    // This mirrors execute.skill.ts line: plans.filter(p => p.frontmatter.isDeliverySlice)
    const deliverySlices = plans.filter((p) => p.frontmatter.isDeliverySlice);
    const legacyPlans = plans.filter((p) => !p.frontmatter.isDeliverySlice);

    expect(deliverySlices).toHaveLength(1);
    expect(legacyPlans).toHaveLength(1);
    expect(deliverySlices[0].verificationIntent).toContain('sunco ceo-review');
  });

  it('slice-contract prompt includes plan content and codebase-read instructions', () => {
    const plan = parsePlanMd(DELIVERY_SLICE_PLAN);

    const prompt = buildSliceContractPrompt({
      planContent: plan.raw,
      productSpecMd: '# Spec',
      contextMd: '# Context',
      phaseSlug: 'harness-evolution',
      paddedPhase: '25',
      planNumber: '01',
    });

    // Must instruct agent to READ codebase, not guess
    expect(prompt).toContain('CRITICAL: Read the codebase first');
    expect(prompt).toContain('NEVER guess a file path');
    // Must contain the plan content
    expect(prompt).toContain('CEO review skill');
    // Must define task XML structure for output
    expect(prompt).toContain('<task type="auto">');
    expect(prompt).toContain('<acceptance_criteria>');
  });
});

// ---------------------------------------------------------------------------
// Tests: verify Layer 3 — Verification intent parsing
// ---------------------------------------------------------------------------

describe('verify Layer 3 Verification intent support', () => {
  it('delivery-slice plan exposes verificationIntent for Layer 3', () => {
    const plan = parsePlanMd(DELIVERY_SLICE_PLAN);

    expect(plan.verificationIntent).toBeDefined();
    expect(plan.verificationIntent).toContain('sunco ceo-review --phase 25');
    expect(plan.verificationIntent).toContain('CEO-REVIEW.md');

    // Layer 3 in verify-layers.ts parses these lines for:
    // 1. GREPPABLE patterns (file contains string)
    // 2. EXPORTABLE patterns (file exports symbol)
    // 3. Command patterns (backtick commands)
    // 4. Human-testable (everything else → UAT)
    const lines = plan.verificationIntent
      .split('\n')
      .map((l: string) => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);

    expect(lines.length).toBeGreaterThan(0);
  });

  it('legacy plan has empty verificationIntent', () => {
    const plan = parsePlanMd(LEGACY_PLAN);

    expect(plan.verificationIntent).toBe('');
    expect(plan.frontmatter.isDeliverySlice).toBe(false);
    // Layer 3 falls through to acceptance_criteria XML extraction for legacy
  });

  it('greppable patterns in verification intent are extractable', () => {
    const planWithGreppable = DELIVERY_SLICE_PLAN.replace(
      '## Verification intent\n',
      '## Verification intent\n- src/ceo-review.skill.ts contains export default defineSkill\n',
    );
    const plan = parsePlanMd(planWithGreppable);

    const lines = plan.verificationIntent
      .split('\n')
      .map((l: string) => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);

    // The GREPPABLE pattern: /^(.+?)\s+contains\s+['"]?(.+?)['"]?$/i
    const greppable = lines.filter((l: string) => /^(.+?)\s+contains\s+['"]?(.+?)['"]?$/i.test(l));
    expect(greppable.length).toBeGreaterThan(0);
    expect(greppable[0]).toContain('export default defineSkill');
  });
});
