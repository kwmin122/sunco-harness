import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
// @ts-expect-error — vendored .mjs has no type declarations.
import { extractSpecBlock, generateCrossDomain, generateCrossDomainFindings } from '../../../../../packages/cli/references/cross-domain/src/extract-spec-block.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const UI = path.resolve(REPO_ROOT, 'test/fixtures/cross-domain-conflict/UI-SPEC.md');
const API = path.resolve(REPO_ROOT, 'test/fixtures/cross-domain-conflict/API-SPEC.md');

interface Finding { rule: string; severity: string; match: string; state: string; }

describe('phase51 cross-domain-conflict fixture', () => {
  it('fires all 4 cross-domain check types with correct severity (spec §9 L784)', async () => {
    const ui = await extractSpecBlock(UI, 'ui');
    const api = await extractSpecBlock(API, 'api');
    const { crossDomainBlock } = generateCrossDomain({ ui, api });
    const { findings } = generateCrossDomainFindings({ crossDomainBlock });
    const list = findings as Finding[];

    const missingEndpoint = list.filter(f => f.rule === 'missing-endpoint');
    const orphanEndpoint = list.filter(f => f.rule === 'orphan-endpoint');
    const typeDrift = list.filter(f => f.rule === 'type-drift');
    const errorMismatch = list.filter(f => f.rule === 'error-state-mismatch');

    expect(missingEndpoint.length, 'missing-endpoint must fire').toBeGreaterThanOrEqual(1);
    expect(missingEndpoint[0].severity).toBe('HIGH');

    expect(orphanEndpoint.length, 'orphan-endpoint must fire').toBeGreaterThanOrEqual(1);
    expect(orphanEndpoint[0].severity).toBe('LOW');

    expect(typeDrift.length, 'type-drift must fire').toBeGreaterThanOrEqual(1);
    expect(typeDrift[0].severity).toBe('HIGH');

    expect(errorMismatch.length, 'error-state-mismatch must fire').toBeGreaterThanOrEqual(1);
    expect(errorMismatch[0].severity).toBe('MEDIUM');
  });

  it('all findings are deterministically state=open on initial generation', async () => {
    const ui = await extractSpecBlock(UI, 'ui');
    const api = await extractSpecBlock(API, 'api');
    const { crossDomainBlock } = generateCrossDomain({ ui, api });
    const { findings } = generateCrossDomainFindings({ crossDomainBlock });
    for (const f of findings as Finding[]) {
      expect(f.state).toBe('open');
    }
  });

  it('findings ordered deterministically (rule asc, file asc, line asc, match asc)', async () => {
    const ui = await extractSpecBlock(UI, 'ui');
    const api = await extractSpecBlock(API, 'api');
    const { crossDomainBlock } = generateCrossDomain({ ui, api });
    const { findings } = generateCrossDomainFindings({ crossDomainBlock });
    const sorted = [...findings as Finding[]].sort((a, b) => {
      if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
      return a.match < b.match ? -1 : a.match > b.match ? 1 : 0;
    });
    expect(findings).toEqual(sorted);
  });
});
