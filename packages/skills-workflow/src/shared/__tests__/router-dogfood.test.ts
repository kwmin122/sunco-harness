import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
// @ts-expect-error — .mjs has no type declarations; runtime contract stable per Phase 54 schema.
import { decideCompound, validateCompoundArtifact, COMPOUND_SECTIONS } from '../../../../../packages/cli/references/compound/src/compound-router.mjs';

// Phase 55 — Router Dogfood vitest runner.
//
// Consumes the 5 fixture scenarios + retroactive v1.4 backfill under
// test/fixtures/router/ to exercise the Phase 52a schema contract (route-
// decision), Phase 52b classifier outputs (RouteDecision shape), and
// Phase 54 compound-router (decideCompound + validateCompoundArtifact) end-
// to-end. Fixtures are deterministic; same input → same assertion per run.
//
// Gate 55 L3: no new module exports; existing runtime consumed as black box.
// Gate 55 L7: self-test count unchanged (this file is vitest, not --test).
// Gate 55 L2 γ hybrid layout: route-decisions/*.json flat + expected.json for
//   all 5 + expected-compound.md for WRITE scenarios (3/4/5) only.

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const FIXTURES_ROOT = join(REPO_ROOT, 'test', 'fixtures', 'router');

interface Oracle {
  scenario_id: number;
  scenario_name: string;
  last_current_stage: string;
  last_recommended_next: string;
  confidence_band_min?: number;
  confidence_band_max?: number;
  risk_level: string;
  action_command: string;
  action_mode: string;
  compound_decision: 'write' | 'candidate' | 'skip';
  compound_score_min?: number;
  compound_score_max?: number;
  compound_always_on: boolean;
  compound_artifact_expected: boolean;
  compound_input: {
    stage_exit: string;
    event: Record<string, unknown>;
    window: { from: string; to: string };
  };
}

function loadOracle(scenarioDir: string): Oracle {
  return JSON.parse(readFileSync(join(scenarioDir, 'expected.json'), 'utf8'));
}

function loadRouteDecisions(scenarioDir: string) {
  const rdDir = join(scenarioDir, 'route-decisions');
  const files = readdirSync(rdDir).filter(f => f.endsWith('.json')).sort();
  return files.map(f => ({
    path: join(rdDir, f),
    data: JSON.parse(readFileSync(join(rdDir, f), 'utf8')),
  }));
}

function ROUTE_DECISION_VALID(d: any): boolean {
  return (
    d && typeof d === 'object' &&
    d.kind === 'route-decision' &&
    d.version === 1 &&
    typeof d.ts === 'string' &&
    d.freshness && typeof d.freshness.status === 'string' &&
    typeof d.current_stage === 'string' &&
    typeof d.recommended_next === 'string' &&
    typeof d.confidence === 'number' &&
    Array.isArray(d.reason) && d.reason.length >= 1 &&
    d.preconditions && Array.isArray(d.preconditions.satisfied) && Array.isArray(d.preconditions.missing) &&
    d.action && typeof d.action.command === 'string' && typeof d.action.mode === 'string' &&
    d.approval_envelope && typeof d.approval_envelope.risk_level === 'string' &&
    Array.isArray(d.approval_envelope.triggers_required)
  );
}

function assertScenario(scenarioDirName: string) {
  const scenarioDir = join(FIXTURES_ROOT, scenarioDirName);
  const oracle = loadOracle(scenarioDir);
  const rds = loadRouteDecisions(scenarioDir);
  expect(rds.length).toBeGreaterThanOrEqual(1);
  for (const rd of rds) {
    expect(ROUTE_DECISION_VALID(rd.data), `Schema-valid RouteDecision at ${rd.path}`).toBe(true);
  }
  const last = rds[rds.length - 1].data;
  expect(last.current_stage, `scenario ${oracle.scenario_id}: last current_stage`).toBe(oracle.last_current_stage);
  expect(last.recommended_next, `scenario ${oracle.scenario_id}: last recommended_next`).toBe(oracle.last_recommended_next);
  expect(last.approval_envelope.risk_level, `scenario ${oracle.scenario_id}: risk_level`).toBe(oracle.risk_level);
  expect(last.action.command, `scenario ${oracle.scenario_id}: action.command`).toBe(oracle.action_command);
  expect(last.action.mode, `scenario ${oracle.scenario_id}: action.mode`).toBe(oracle.action_mode);
  if (oracle.confidence_band_min !== undefined) {
    expect(last.confidence).toBeGreaterThanOrEqual(oracle.confidence_band_min);
  }
  if (oracle.confidence_band_max !== undefined) {
    expect(last.confidence).toBeLessThanOrEqual(oracle.confidence_band_max);
  }

  const result = decideCompound(oracle.compound_input);
  expect(result.decision, `scenario ${oracle.scenario_id}: compound decision`).toBe(oracle.compound_decision);
  expect(result.alwaysOn, `scenario ${oracle.scenario_id}: compound alwaysOn`).toBe(oracle.compound_always_on);
  if (oracle.compound_score_min !== undefined) {
    expect(result.score).toBeGreaterThanOrEqual(oracle.compound_score_min);
  }
  if (oracle.compound_score_max !== undefined) {
    expect(result.score).toBeLessThanOrEqual(oracle.compound_score_max);
  }

  if (oracle.compound_artifact_expected) {
    const ecPath = join(scenarioDir, 'expected-compound.md');
    expect(existsSync(ecPath), `scenario ${oracle.scenario_id}: expected-compound.md present`).toBe(true);
    const md = readFileSync(ecPath, 'utf8');
    expect(md).toMatch(/^---\s*\n/);
    expect(md).toMatch(/kind:\s*compound/);
    expect(md).toMatch(/version:\s*1/);
    expect(md).toMatch(/clean_room_notice:\s*true/);
    expect(md).toMatch(/generated_by:\s*sunco-compound-router/);
    for (const section of COMPOUND_SECTIONS) {
      expect(md, `scenario ${oracle.scenario_id}: section heading ## ${section}`).toMatch(new RegExp(`^## ${section}\\b`, 'm'));
    }
    expect(md).toMatch(/Clean-room notice/);
    expect(md).toMatch(/compound-engineering-plugin/);
  } else {
    const ecPath = join(scenarioDir, 'expected-compound.md');
    expect(existsSync(ecPath), `scenario ${oracle.scenario_id}: SKIP → no expected-compound.md`).toBe(false);
  }
}

describe('Phase 55 router dogfood — scenario 1 greenfield → BRAINSTORM (skip)', () => {
  it('fixture route-decisions exist and are schema-valid', () => {
    assertScenario('01-greenfield-brainstorm');
  });
  it('deterministic: 10 iterations byte-identical decideCompound output', () => {
    const oracle = loadOracle(join(FIXTURES_ROOT, '01-greenfield-brainstorm'));
    const runs = Array.from({ length: 10 }, () => JSON.stringify(decideCompound(oracle.compound_input)));
    expect(new Set(runs).size).toBe(1);
  });
});

describe('Phase 55 router dogfood — scenario 2 bugfix mid-phase → WORK (skip)', () => {
  it('fixture route-decisions exist and are schema-valid', () => {
    assertScenario('02-bugfix-work');
  });
  it('PLAN → WORK ordering preserved across timestamps', () => {
    const rds = loadRouteDecisions(join(FIXTURES_ROOT, '02-bugfix-work'));
    expect(rds.length).toBeGreaterThanOrEqual(2);
    expect(rds[0].data.current_stage).toBe('PLAN');
    expect(rds[rds.length - 1].data.current_stage).toBe('WORK');
  });
});

describe('Phase 55 router dogfood — scenario 3 release completion → COMPOUND (always-on write)', () => {
  it('fixture route-decisions exist and compound artifact oracle present', () => {
    assertScenario('03-release-compound');
  });
  it('expected-compound.md validates against schema structure', () => {
    const artifact = {
      kind: 'compound', version: 1, scope: 'release', ref: 'v1.0.0',
      window: { from: '2026-04-21T10:00:00.000Z', to: '2026-04-21T14:00:00.000Z' },
      status: 'proposed',
      source_evidence: [
        'test/fixtures/router/03-release-compound/route-decisions/2026-04-21T120000-RELEASE.json',
        'test/fixtures/router/03-release-compound/route-decisions/2026-04-21T130000-COMPOUND.json',
      ],
      sections: [...COMPOUND_SECTIONS],
      clean_room_notice: true,
      generated_by: 'sunco-compound-router',
    };
    expect(() => validateCompoundArtifact(artifact)).not.toThrow();
  });
});

describe('Phase 55 router dogfood — scenario 4 incident recovery → COMPOUND (score ≥5 write)', () => {
  it('fixture route-decisions exist and score composition crosses threshold', () => {
    assertScenario('04-incident-recovery');
  });
  it('score breakdown: CI +2 + rollback +2 + post-judge fix +3 = 7', () => {
    const oracle = loadOracle(join(FIXTURES_ROOT, '04-incident-recovery'));
    const result = decideCompound(oracle.compound_input);
    expect(result.score).toBe(7);
    expect(result.decision).toBe('write');
    expect(result.alwaysOn).toBe(false);
  });
});

describe('Phase 55 router dogfood — scenario 5 milestone close → COMPOUND (always-on write)', () => {
  it('fixture route-decisions exist and compound artifact oracle present', () => {
    assertScenario('05-milestone-close');
  });
  it('MILESTONE_CLOSED +5 always-on override', () => {
    const oracle = loadOracle(join(FIXTURES_ROOT, '05-milestone-close'));
    const result = decideCompound(oracle.compound_input);
    expect(result.alwaysOn).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(5);
    expect(result.decision).toBe('write');
  });
});

describe('Phase 55 router dogfood — retroactive v1.4 backfill', () => {
  const retroDir = join(FIXTURES_ROOT, 'retroactive-v1.4');
  const rdDir = join(retroDir, 'route-decisions');

  it('≥5 retroactive RouteDecision fixtures (DESIGN §11 31d)', () => {
    const files = readdirSync(rdDir).filter(f => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const f of files) {
      const rd = JSON.parse(readFileSync(join(rdDir, f), 'utf8'));
      expect(ROUTE_DECISION_VALID(rd), `schema-valid: ${f}`).toBe(true);
      expect(f).toMatch(/-retroactive\.json$/);
    }
  });

  it('BACKFILL-PROVENANCE.md present in fixture tree (Gate 55 U2 Codex-strict)', () => {
    expect(existsSync(join(retroDir, 'BACKFILL-PROVENANCE.md'))).toBe(true);
  });

  it('durable tier .planning/router/decisions/ contains ONLY .keep (U2 negative assertion)', () => {
    const durableDir = join(REPO_ROOT, '.planning', 'router', 'decisions');
    const entries = readdirSync(durableDir);
    expect(entries.length).toBe(1);
    expect(entries[0]).toBe('.keep');
  });

  it('retroactive v1.4 compound artifact validates against Phase 54 schema', () => {
    const artifactPath = join(REPO_ROOT, '.planning', 'compound', 'release-v0.12.0-20260420.md');
    expect(existsSync(artifactPath)).toBe(true);
    const md = readFileSync(artifactPath, 'utf8');
    expect(md).toMatch(/kind:\s*compound/);
    expect(md).toMatch(/scope:\s*release/);
    expect(md).toMatch(/ref:\s*v0\.12\.0/);
    expect(md).toMatch(/status:\s*proposed/);
    expect(md).toMatch(/clean_room_notice:\s*true/);
    expect(md).toMatch(/generated_by:\s*sunco-compound-router/);
    for (const section of COMPOUND_SECTIONS) {
      expect(md, `retroactive v1.4 artifact section ## ${section}`).toMatch(new RegExp(`^## ${section}\\b`, 'm'));
    }
    // Structural validation via validateCompoundArtifact
    const artifact = {
      kind: 'compound', version: 1, scope: 'release', ref: 'v0.12.0',
      window: { from: '2026-03-27T00:00:00.000Z', to: '2026-04-20T00:00:00.000Z' },
      status: 'proposed',
      source_evidence: [
        'test/fixtures/router/retroactive-v1.4/route-decisions/2026-03-27T090000-PLAN-retroactive.json',
        'test/fixtures/router/retroactive-v1.4/route-decisions/2026-04-05T140000-PROCEED-retroactive.json',
        'test/fixtures/router/retroactive-v1.4/route-decisions/2026-04-12T100000-VERIFY-retroactive.json',
        'test/fixtures/router/retroactive-v1.4/route-decisions/2026-04-19T170000-RELEASE-retroactive.json',
        'test/fixtures/router/retroactive-v1.4/route-decisions/2026-04-20T120000-COMPOUND-retroactive.json',
      ],
      sections: [...COMPOUND_SECTIONS],
      clean_room_notice: true,
      generated_by: 'sunco-compound-router',
    };
    expect(() => validateCompoundArtifact(artifact)).not.toThrow();
  });
});
