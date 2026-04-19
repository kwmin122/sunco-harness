import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
// @ts-expect-error — vendored .mjs has no type declarations; runtime contract is stable.
import { scanTarget, RULES_ENABLED } from '../../../../../packages/cli/references/backend-excellence/src/detect-backend-smells.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const POS_DIR = path.resolve(REPO_ROOT, 'test/fixtures/backend-rest-sample/positive');
const NEG_DIR = path.resolve(REPO_ROOT, 'test/fixtures/backend-rest-sample/negative');

function byRule(findings: Array<{ rule: string }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of findings) out[f.rule] = (out[f.rule] ?? 0) + 1;
  return out;
}

describe('phase51 backend-rest-sample fixture', () => {
  it('positive directory fires every enabled rule at least once', () => {
    const result = scanTarget(POS_DIR);
    const counts = byRule(result.findings);
    for (const rule of RULES_ENABLED) {
      expect(counts[rule] ?? 0, `rule ${rule} must fire in positive fixture`).toBeGreaterThan(0);
    }
  });

  it('negative directory produces zero findings (silent on all rules)', () => {
    const result = scanTarget(NEG_DIR);
    expect(result.findings.length, 'negative fixture must be silent').toBe(0);
  });

  it('positive fixture scans expected file count', () => {
    const result = scanTarget(POS_DIR);
    expect(result.meta.files_scanned).toBeGreaterThanOrEqual(7);
  });
});
