# Phase 34: Codex Layer 6 Integration - Context

**Gathered:** 2026-04-11
**Status:** Decisions locked. Ready for planning + implementation.
**Upstream:** Phase 33 Wave 1 completed (alias infra + 6 absorptions landed); Layer 6 currently uses `providers.slice(0, 2)` which may pick two same-family providers
**External input:** User directive 2026-04-11 "통합하자. 하지만 Layer 6에 넣자."
**Director:** Opus 4.6 · **Implementer:** Sonnet 4.6 subagent

<domain>
## Phase Boundary

Phase 34 makes SUNCO's **Layer 6: Cross-Model Verification** actually live up to its name by integrating the local `codex` CLI (OpenAI) as a real cross-family provider. Currently Layer 6 calls `ctx.agent.crossVerify(..., providers.slice(0, 2))` — which can accidentally pick two Claude-family providers (both `claude-code-cli` and `claude-sdk`) and silently degrade to same-model "cross"-review. Phase 34 fixes this.

Codex is integrated **only as a verification signal** (Layer 6). It is **NOT** a default executor, planner, or general agent. All other skills continue running on Claude Code exactly as today.

### What's in scope

- New `CodexCliProvider` in `packages/core/src/agent/providers/codex-cli.ts` (subprocess wrapper around `codex review`)
- Provider registration + barrel exports
- Registry / router API to expose provider **family** metadata (`listProvidersWithFamily()` or equivalent)
- `runLayer6CrossModel` rewrite: prefer a true cross-family pair (claude + openai), deterministic selection not `slice(0, 2)`
- `verify.skill.ts` gains `--require-codex` flag
- Layer 6 outcome logic:
  - **Normal mode** + codex available → run codex review, parse findings, compare to prior layers
  - **Normal mode** + codex unavailable → fallback to skeptical reviewer (existing) + WARN finding: `"Layer 6 ran same-family fallback — install codex CLI for true cross-model"`
  - **`--require-codex`** + codex unavailable or failed → Layer 6 **FAIL** (severity high, blocks `--strict`)
  - **`--skip-cross-model`** → still skips Layer 6 entirely (existing behavior, unchanged)
- Read-only enforcement: `codex review` is inherently read-only, but we also set `sandbox_permissions=["disk-full-read-access"]` via `-c` for belt-and-suspenders
- Tests for provider availability, Layer 6 selection, `--require-codex` FAIL path

### What's explicitly out of scope

- **No Layer 8.** User explicitly rejected. 7-layer Swiss cheese stays.
- **No `OPENAI_API_KEY`, no `@openai` SDK, no HTTP API path.** Local `codex` CLI only.
- **No `anthropic-beta` headers, no `@anthropic-ai/sdk`.** (Already banned.)
- **No Codex for execution / planning / fixing.** Review-only.
- **No Claude Code slash-command invocation.** SUNCO TypeScript runtime cannot reliably invoke `/codex:review` slash commands via Claude Code plugin. Use the `codex` CLI directly instead.
- **No manual Codex plugin gate artifact** (originally proposed as a fallback). Since `codex` CLI is confirmed installed locally (`/opt/homebrew/bin/codex`) with a stable `codex review` non-interactive subcommand, the automatic path is the primary and only path. If a future environment lacks `codex`, the skeptical-reviewer fallback covers it — a manual markdown artifact is overkill.
- **No changes to Layers 1-5 or Layer 7.** Layer 6 only.
- **No changes to the existing verify output format, except** Layer 6 findings now have a more accurate `provider` field.
- **No changes to recommender rules.** (Layer 6 is a signal, not a workflow step.)
- **No parallel execution with Phase 33 Wave 2/3.** Wave 2 and Wave 3 are staged after Phase 34 to avoid verify.skill.ts merge surface overlap.

## Codex CLI facts (verified 2026-04-11)

```
$ which codex
/opt/homebrew/bin/codex

$ codex review --help
Usage: codex review [OPTIONS] [PROMPT]
Options:
  --uncommitted          Review staged/unstaged/untracked changes
  --base <BRANCH>        Review changes against base branch
  --commit <SHA>         Review changes introduced by a commit
  --title <TITLE>        Optional commit title for review summary
  -c key=value           Override config (nested dotted path, TOML value)
  --enable <FEATURE>     Enable a feature
  --disable <FEATURE>    Disable a feature
  [PROMPT]               Custom review instructions; `-` reads from stdin
```

Existing install at `~/.codex/` has `auth.json`, `config.toml`, full session state — authentication flows through without SUNCO touching credentials.

## Expected Layer 6 call path (automatic mode)

```
verify.skill.ts: runLayer6CrossModel(ctx, diff, prior)
  ↓
verify-layers.ts: selectCrossFamilyProviders(registry)
  → returns { primary: claude-code-cli, secondary: codex-cli } if both available
  → returns { primary: claude-code-cli, secondary: null } if codex unavailable
  → returns null if no claude (should never happen)
  ↓
if secondary is codex-cli:
  ctx.agent.crossVerify({ ..., providers: [primary, secondary] })
  → CodexCliProvider.execute() spawns: codex review --base HEAD~1 - < prompt.txt
  → Parse output into VerifyFinding[] with source: 'cross-model', provider: 'codex-cli'
elif require_codex:
  return { passed: false, findings: [{ severity: 'high', description: 'codex CLI unavailable but --require-codex set' }] }
else:
  runSkepticalReviewer(...)  // existing fallback
  findings.push({ severity: 'low', description: 'Layer 6 ran same-family fallback — install codex CLI for true cross-model' })
```
</domain>

<decisions>
## Locked Decisions (2026-04-11, director)

### Architecture

- **D-01: Layer 6, not Layer 8.** User directive. Swiss cheese model stays 7 layers.
- **D-02: Automatic CLI integration is primary, not manual gate.** `codex review` CLI confirmed installed with stable non-interactive flags. Manual markdown artifact was originally proposed as fallback for environments without `codex`, but the skeptical-reviewer existing fallback already covers that. Manual gate is NOT implemented.
- **D-03: Codex is verification-only.** Never invoked for planning, execution, auto-fix, or rescue in this phase. `/codex:rescue` and `/codex:adversarial-review` ideas are deferred to a future phase if needed.
- **D-04: Subprocess transport via execa**, matching `ClaudeCliProvider` pattern. Pass prompt via stdin (`-` as PROMPT arg), read stdout for review output, parse into `VerifyFinding[]`.
- **D-05: Provider family metadata exposed via new registry method.** Currently `ctx.agent.listProviders()` returns only IDs (strings). Add `listProvidersWithFamily(): Array<{ id, family }>` on `AgentRouterApi` so Layer 6 can deterministically pick cross-family pairs.
- **D-06: Layer 6 provider selection is deterministic, not `providers.slice(0, 2)`.** Replace with `selectCrossFamilyProviders()` helper that picks 1 claude + 1 openai when available, falls back to single-provider skeptical reviewer otherwise.
- **D-07: Read-only hard-enforced.** `CodexCliProvider.execute()` sets `-c 'sandbox_permissions=["disk-full-read-access"]'` so Codex cannot write files even if prompted. Verification must never mutate state.
- **D-08: Output parsing.** Reuse existing `parseExpertFindings(text, 'cross-model', 6)` from verify-layers.ts. If Codex output is freeform (not structured), `parseExpertFindings` already has heuristics; if it drops content, wrap the raw text in a single `severity: 'low'` finding as the final fallback (don't lose data).

### `--require-codex` semantics

- **D-09: `--require-codex` is opt-in strict mode** for pre-ship / release-quality verification. Default is off.
- **D-10: `--require-codex` + codex unavailable → Layer 6 FAIL** with a high-severity finding. Overrides normal mode's WARN fallback.
- **D-11: `--require-codex` + codex returns empty/garbage → Layer 6 FAIL.** Half-worked codex runs are not acceptable in strict mode.
- **D-12: `--skip-cross-model` takes precedence over `--require-codex`** if both are set. User explicitly said "skip everything" wins over "require codex". If user wants both gates enforced, they should use `--strict` which blocks `--skip-cross-model`.
- **D-13: `--strict` interaction:** `--strict` already prevents `--skip-cross-model` from silently skipping Layer 6. `--strict` does NOT imply `--require-codex`. The two are orthogonal — `--strict` means "don't skip any layer", `--require-codex` means "Layer 6 MUST be a true cross-model signal". A team wanting maximum rigor uses both.

### Authentication

- **D-14: Inherit existing Codex auth.** `~/.codex/auth.json` and `~/.codex/config.toml` are whatever the user set up via `codex login`. SUNCO does NOT manage credentials, does NOT prompt for keys, does NOT write to `~/.codex/`.
- **D-15: `OPENAI_API_KEY` must NOT be set, read, or required by SUNCO.** If the user has it exported in their shell env, fine — Codex CLI may use it. SUNCO itself never reads it.

### Testing

- **D-16: Unit tests for `CodexCliProvider.isAvailable()` and `.execute()`** using execa mocks. Match the existing `claude-cli.test.ts` pattern.
- **D-17: Unit test for `selectCrossFamilyProviders()`** — pure function, easy to test with fake registry.
- **D-18: Integration test for Layer 6** — mock providers and assert:
  - Codex available → Layer 6 uses codex
  - Codex unavailable, normal mode → skeptical fallback + WARN finding
  - Codex unavailable, `--require-codex` → Layer 6 FAIL finding
  - `--skip-cross-model` → Layer 6 skipped entirely (existing behavior preserved)
- **D-19: No SDK/API import sanity grep** in the test or in a CI forbidden-scan step.

### Scope control

- **D-20: Single wave, single plan, 8 tasks.** No parallel. Sequential execution by Sonnet.
- **D-21: Phase 33 Wave 2/3 NOT included.** Still deferred.
- **D-22: No changes to config schema or state schema.** (Codex behavior is controlled via `~/.codex/` and CLI flags, not SUNCO config.)
</decisions>

<canonical_refs>
## Canonical References

### Files to modify

**@sunco/core:**
- `packages/core/src/agent/providers/codex-cli.ts` **(new)**
- `packages/core/src/agent/providers/index.ts` or whichever barrel exports providers
- `packages/core/src/agent/router.ts` — add `listProvidersWithFamily()` method
- `packages/core/src/agent/types.ts` — add `listProvidersWithFamily` to `AgentRouterApi` interface
- `packages/core/src/index.ts` — export `CodexCliProvider` (if it's in the public API)
- `packages/core/src/agent/__tests__/codex-cli.test.ts` **(new)**

**@sunco/skills-workflow:**
- `packages/skills-workflow/src/shared/verify-layers.ts` — add `selectCrossFamilyProviders()` helper, rewrite `runLayer6CrossModel`
- `packages/skills-workflow/src/shared/verify-types.ts` — if needed, add `requireCodex` to LayerOptions
- `packages/skills-workflow/src/verify.skill.ts` — add `--require-codex` flag, plumb through to Layer 6 call
- `packages/skills-workflow/src/__tests__/verify.test.ts` — extend mocks and add 3+ new cases

**@sunco/cli:**
- `packages/cli/src/cli.ts` — register `CodexCliProvider` in agent router at boot

### SUNCO rules
- `CLAUDE.md` · `.claude/rules/conventions.md` · `.claude/rules/tech-stack.md` · `.claude/rules/architecture.md`
- `packages/cli/references/product-contract.md` — 7-layer Swiss cheese definition (stays unchanged)

### External
- Codex plugin repo: https://github.com/openai/codex-plugin-cc (reference only, NOT used as transport)
- `codex review --help` output (already captured in this CONTEXT)
</canonical_refs>

<code_context>
## Existing Code Insights

### What's there already
- `AgentFamily` union already includes `'openai'` (`packages/core/src/agent/types.ts:20`)
- `AgentProvider` interface has `family: AgentFamily` + `transport: AgentTransport` (`types.ts:206`)
- `ClaudeCliProvider` at `packages/core/src/agent/providers/claude-cli.ts` is a 130-line template: `isAvailable()` via `which`, `execute()` via `execa`, normalized result
- `runLayer6CrossModel` at `verify-layers.ts:1018` currently uses `crossVerify(..., providers.slice(0, 2))`
- `runSkepticalReviewer` already exists as the single-provider fallback
- `parseExpertFindings(text, 'cross-model', 6)` already parses and tags findings
- `ctx.agent.listProviders()` returns string IDs — add `listProvidersWithFamily()` in router.ts
- `verify.skill.ts` imports `runLayer6CrossModel` (line 39) and already handles `--skip-cross-model` — adding `--require-codex` follows the same pattern

### Test infrastructure
- `packages/core/src/agent/__tests__/claude-cli.test.ts` exists — template for `codex-cli.test.ts`
- `packages/core/src/agent/__tests__/router.test.ts` exists — extend to cover `listProvidersWithFamily`
- `packages/skills-workflow/src/__tests__/verify.test.ts` exists with `mockRunLayer6` — extend to cover the new flags

### Integration point
- `packages/cli/src/cli.ts` is where providers get registered at boot (same place Phase 32 removed `fastSkill`/`progressSkill`). Add `CodexCliProvider` registration next to `ClaudeCliProvider`.
</code_context>

<specifics>
## Specific Ideas

### CodexCliProvider shape (template from claude-cli.ts)

```ts
// packages/core/src/agent/providers/codex-cli.ts
import { execa } from 'execa';
import { ProviderExecutionError } from '../errors.js';
import { normalizeResult } from '../result.js';
import type {
  AgentProvider, AgentRequest, AgentExecutionContext,
  AgentResult, AgentFamily, AgentTransport,
} from '../types.js';

export class CodexCliProvider implements AgentProvider {
  readonly id = 'codex-cli';
  readonly family: AgentFamily = 'openai';
  readonly transport: AgentTransport = 'cli';

  async isAvailable(): Promise<boolean> {
    try {
      await execa('which', ['codex']);
      return true;
    } catch {
      return false;
    }
  }

  async execute(request: AgentRequest, context: AgentExecutionContext): Promise<AgentResult> {
    const baseRef = (request.meta?.baseRef as string | undefined) ?? 'HEAD~1';
    const args = [
      'review',
      '--base', baseRef,
      '-c', 'sandbox_permissions=["disk-full-read-access"]',  // D-07 read-only hard-enforce
      '-',  // read prompt from stdin
    ];

    const start = Date.now();
    try {
      const result = await execa('codex', args, {
        input: request.prompt,
        cwd: context.cwd,
        timeout: context.timeout,
        cancelSignal: context.signal,
      });

      return normalizeResult({
        providerId: this.id,
        family: this.family,
        outputText: result.stdout,
        durationMs: Date.now() - start,
        // Codex doesn't surface cost; leave undefined
      });
    } catch (err) {
      throw new ProviderExecutionError(this.id, err);
    }
  }
}
```

### Router extension

```ts
// packages/core/src/agent/router.ts (addition)
async listProvidersWithFamily(): Promise<Array<{ id: string; family: AgentFamily }>> {
  const checks = await Promise.all(
    Array.from(this.providers.entries()).map(async ([id, provider]) => ({
      id,
      family: provider.family,
      available: await provider.isAvailable(),
    })),
  );
  return checks.filter((c) => c.available).map(({ id, family }) => ({ id, family }));
}
```

### selectCrossFamilyProviders helper

```ts
// packages/skills-workflow/src/shared/verify-layers.ts (new helper)
export function selectCrossFamilyProviders(
  available: Array<{ id: string; family: AgentFamily }>,
): { primary: string; secondary: string | null; isCrossFamily: boolean } | null {
  const claude = available.find((p) => p.family === 'claude');
  if (!claude) return null;  // no primary available — catastrophic

  const openai = available.find((p) => p.family === 'openai');
  if (openai) {
    return { primary: claude.id, secondary: openai.id, isCrossFamily: true };
  }

  // No cross-family pair available
  return { primary: claude.id, secondary: null, isCrossFamily: false };
}
```

### Layer 6 rewrite skeleton

```ts
export async function runLayer6CrossModel(
  ctx: SkillContext,
  diff: string,
  previousFindings: VerifyFinding[],
  opts: { requireCodex?: boolean } = {},
): Promise<LayerResult> {
  const start = Date.now();
  const findings: VerifyFinding[] = [];

  try {
    const available = await ctx.agent.listProvidersWithFamily();
    const selection = selectCrossFamilyProviders(available);
    const prompt = buildCrossModelPrompt(diff, previousFindings);

    if (!selection) {
      // No providers at all — shouldn't happen
      findings.push({ layer: 6, source: 'cross-model', severity: 'high',
        description: 'Layer 6: no providers available' });
    } else if (selection.isCrossFamily && selection.secondary) {
      // True cross-family pair (claude + openai/codex)
      try {
        const results = await ctx.agent.crossVerify(
          { role: 'verification', prompt, permissions: VERIFICATION_PERMISSIONS,
            timeout: CROSS_MODEL_TIMEOUT, maxTurns: 3,
            meta: { baseRef: 'HEAD~1' } },
          [selection.primary, selection.secondary],
        );
        for (const r of results) {
          findings.push(...parseExpertFindings(r.outputText, 'cross-model', 6));
        }
      } catch (err) {
        ctx.log.warn('Cross-family crossVerify failed', { error: err });
        if (opts.requireCodex) {
          findings.push({ layer: 6, source: 'cross-model', severity: 'high',
            description: `--require-codex set but cross-model verify failed: ${String(err)}` });
        } else {
          await runSkepticalReviewer(ctx, prompt, findings);
          findings.push({ layer: 6, source: 'cross-model', severity: 'low',
            description: 'Layer 6 cross-family run failed; fell back to same-family skeptical reviewer' });
        }
      }
    } else {
      // Only claude family available — no codex
      if (opts.requireCodex) {
        findings.push({ layer: 6, source: 'cross-model', severity: 'high',
          description: '--require-codex set but codex CLI is unavailable. Install codex: https://github.com/openai/codex-plugin-cc' });
      } else {
        ctx.log.info('Layer 6: no cross-family provider, falling back to skeptical reviewer');
        await runSkepticalReviewer(ctx, prompt, findings);
        findings.push({ layer: 6, source: 'cross-model', severity: 'low',
          description: 'Layer 6 ran same-family fallback — install codex CLI for true cross-model verification' });
      }
    }
  } catch (err) {
    findings.push({ layer: 6, source: 'cross-model', severity: 'low',
      description: `Layer 6 execution error: ${err instanceof Error ? err.message : String(err)}` });
  }

  const hasCriticalOrHigh = findings.some((f) => f.severity === 'critical' || f.severity === 'high');
  return {
    layer: 6,
    name: 'Cross-Model Verification',
    findings,
    passed: !hasCriticalOrHigh,
    durationMs: Date.now() - start,
  };
}
```

### verify.skill.ts flag wiring

```ts
// Add to options
{ flags: '--require-codex', description: 'Fail Layer 6 if codex cross-model verification is unavailable (pre-ship strict mode)' },

// In execute, when calling runLayer6CrossModel:
const layer6 = await runLayer6CrossModel(ctx, diff, priorFindings, {
  requireCodex: ctx.args['require-codex'] === true,
});
```
</specifics>

<deferred>
## Deferred

- `/codex:rescue` integration (user-triggered autofix from Codex — Phase 35+ candidate, risky)
- `/codex:adversarial-review` integration (stronger review mode than plain `/codex:review` — could be `verify --adversarial` flag in a later phase)
- Codex for planning / execution / general agent use — explicitly out (user directive)
- Multi-provider Layer 6 beyond pairs (claude + openai + google, etc.) — wait for 3rd family to prove value
- Codex cost reporting (`codex review` doesn't surface cost today)
- `--require-codex` as a config default (currently opt-in flag only; could become a project config option later)
- Phase 33 Wave 2 (export/assume/test-gen absorption) — next priority after Phase 34
- Phase 33 Wave 3 (diagnose/forensics/review arsenal/compound hook) — after Wave 2
</deferred>

---

*Phase: 34-codex-layer6*
*Context locked: 2026-04-11 by director (Opus 4.6)*
*Implementation: Sonnet 4.6 subagent*
