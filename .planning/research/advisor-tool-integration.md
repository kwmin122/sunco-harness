# Claude Code Advisor Harness — 설계 (Phase 27)

**Date:** 2026-04-10
**Reframed from:** 초기 API-based Advisor Tool 설계 → Claude Code 구독 기반 harness로 재정렬
**Source inspiration (design only):** https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool

---

## 0. 중요 — 전제 정정

**SUNCO는 Claude Code 구독을 사용하며 Anthropic API 결제 경로를 쓰지 않는다.**

이 한 문장이 이전 설계를 뒤엎는다:

| 항목 | 이전 설계 | 수정 후 |
|---|---|---|
| Provider | `@anthropic-ai/sdk` native (API) | 기존 `ClaudeCliProvider` 재사용 |
| 인증 | `ANTHROPIC_API_KEY` | Claude Code 로그인 세션 |
| Beta 헤더 | `advisor-tool-2026-03-01` 필수 | **사용 안 함** |
| Tool type | `advisor_20260301` | **사용 안 함** |
| 과금 단위 | 토큰별 과금, iterations[] 파싱 필수 | 구독 quota, 호출 횟수 bound |
| 구현 위치 | 새 `claude-advisor` provider 디렉토리 | 기존 agent router + CLI subprocess |
| 적용 범위 | 모든 prompt skill opt-in | **`workflow.plan` 하나만 먼저** |

**공식 Advisor Tool 문서는 "제품 패턴의 설계 영감"으로만 사용**. server-side in-request advisor / `advisor_tool_result` 블록 / `usage.iterations[]` 회계는 재현하지 않는다. 제품 효과만 잡는다.

### 제품 효과의 정의

> Sonnet executor가 작업 중 중요한 분기점에서 Opus advisor에게 조언을 구하고, 그 조언을 심각하게 받아들이되 맹목적으로 따르지는 않는다.

이 효과는 API 버전의 공식 Advisor Tool이든, Claude Code subagent든, CLI 재호출이든 **구현 수단과 무관하게 동일**하다. SUNCO의 목표는 후자 2개 중 하나로 이 효과를 얻는 것.

---

## 1. Claude Code subscription 환경에서 "Opus advisor" 구현 경로

Claude Code 구독만 가진 상태에서 Opus 모델로 판단을 보강하는 방법은 3가지:

### 경로 1: Subagent + Task tool (최우선 권장)

Claude Code는 `.claude/agents/<name>.md` 형식의 subagent 정의를 지원하며, frontmatter에 `model: opus`를 명시하면 Task tool 호출 시 해당 subagent가 Opus로 실행된다.

```markdown
# .claude/agents/sunco-advisor.md
---
name: sunco-advisor
description: Strong reviewer model that SUNCO skills call for strategic judgment before substantive work and before declaring done.
model: opus
tools: Read, Grep, Glob
---

You are the SUNCO advisor. You are invoked at critical decision points in a SUNCO workflow:
1. Before a skill commits to an approach
2. Before a skill declares work complete
3. When a skill is stuck (errors recurring, approach not converging)

Give advice that is:
- Concise (under 100 words, enumerated steps)
- Action-oriented (what to do next, not why)
- Bounded to the specific question asked

If you agree with the current approach, say so in one sentence and stop. If you disagree, state the specific claim that would change the decision and the evidence. Do not rewrite the executor's work.

IMPORTANT: At the very end of your response, append exactly this line:
`[sunco-advisor v1 model=opus]`
This signature lets SUNCO verify that the advisor subagent actually ran on Opus.
```

**장점:**
- Claude Code 네이티브 메커니즘, 구독 quota 안에서 처리
- 모델 선택이 subagent 정의에 frontmatter로 박혀있어 runtime 조작 불필요
- 기존 SUNCO의 `ctx.agent.run({ role: ... })`가 이미 Task tool 호출 패턴과 호환

**제약:**
- Task tool로 호출하려면 executor가 Claude Code session 안이어야 함
- Subagent는 context를 **명시적으로 pass받음** — full transcript 자동 전달 없음. SUNCO가 advisor prompt를 직접 구성해서 넘겨야 함
- Subagent 응답 시간 예측 불가

**검증 방법:**
- Subagent가 signature line 출력 → SUNCO parser가 확인
- 없으면 "advisor did not run as Opus — verification failed" warning

### 경로 2: 별도 `claude` CLI subprocess with model flag

`claude` CLI가 비대화형 단발 실행 및 model 선택을 지원한다면:

```bash
claude -p --model opus "advisor task context here..."
```

SUNCO의 `ClaudeCliProvider`가 `--model opus`로 별도 프로세스를 spawn하는 방식. **NEEDS VERIFICATION**: `claude` CLI가 현재 버전에서 `--model` 플래그를 지원하는지, 또는 환경변수 `CLAUDE_MODEL=opus` 방식을 지원하는지 확인 필요.

**검증 스텝 (Phase 27 plan-gate 이전에 실행):**
```bash
claude --help | grep -i model
claude -p --model opus "test: say hello and identify your model"
```

**장점:**
- Subagent 정의 파일 관리 불필요
- Executor session과 완전히 분리된 advisor 프로세스

**제약:**
- CLI flag 지원 여부 확인 필요
- Executor session과 context 공유 안 됨 (SUNCO가 명시적으로 넘겨야)
- 구독 quota를 경로 1보다 더 명시적으로 소모

### 경로 3: (최후 수단) 대화형 수동 advisor

Phase 27 범위 밖. Executor가 특정 시점에 "advisor 호출 필요" 상태로 일시정지 → 사용자가 다른 Claude Code 세션 (Opus)에서 수동으로 판단 → SUNCO가 결과 pickup. harness 자동화의 반대.

→ **Phase 27은 경로 1 (subagent) 우선, 경로 2 (CLI flag) 백업으로 설계.**

---

## 2. Phase 27 — Claude Code Advisor Harness (정식 스펙)

### 2.1 Goal

> Claude Code 구독 하에서 `workflow.plan`이 Opus advisor 1회 이상 호출을 포함하도록 한다. 호출 성공 여부는 runtime에 검증 가능해야 한다.

### 2.2 Non-goals (명시적 out of scope)

- 공식 Anthropic API Advisor Tool provider 구현
- `@anthropic-ai/sdk` 의존성 추가
- `ANTHROPIC_API_KEY` 요구
- `advisor-tool-2026-03-01` beta header
- `advisor_20260301` tool type
- `usage.iterations[]` 파싱 production path
- API token 과금 기반 cost tracking
- OpenCode integration
- `workflow.execute`, `workflow.verify`, `workflow.debug`, `workflow.review`에 advisor 적용 (Phase 27+ 후속)
- 모든 prompt skill의 자동 advisor opt-in

### 2.3 Scope

1. **Types:** `AdvisorRequest`, `AdvisorResult`, `AdvisorConfig`
2. **Prompt builder:** 공식 문서의 timing/weight/conciseness 블록 내재화
3. **Runner:** `ClaudeCliProvider` 또는 Task-tool subagent 경로 wrap
4. **Config:** `[agent.advisor]` 섹션 (아래 2.7)
5. **Skill integration:** `workflow.plan` 하나만
6. **Tests:** 비활성 default, 활성 시 호출, cap 강제, timeout, strict mode
7. **Evidence artifact:** `.planning/phases/27-claude-code-advisor-harness/EVIDENCE.md`

### 2.4 대상 파일 (실존 경로 확인됨)

| 파일 | 변경 내용 |
|---|---|
| `packages/core/src/agent/types.ts` | `AdvisorConfig`, `AdvisorRequest`, `AdvisorResult`, `AdvisorWarning` 추가 |
| `packages/core/src/agent/advisor.ts` **(신규)** | Runner + prompt builder + signature verifier |
| `packages/core/src/agent/providers/claude-cli.ts` | `--model` 플래그 또는 subagent 경로 선택 로직 추가 |
| `packages/core/src/agent/router.ts` | `runAdvisor()` 메서드 추가, 호출 카운터 |
| `packages/core/src/config/types.ts` | `AdvisorConfigSchema` 추가 |
| `packages/skills-workflow/src/plan.skill.ts` | advisor 2회 호출 통합 (초안 전, 초안 후) |
| `packages/skills-workflow/src/shared/advisor-prompt.ts` **(신규)** | Timing/weight/conciseness 블록 + SUNCO context template |
| `.claude/agents/sunco-advisor.md` **(신규)** | Opus subagent 정의 (경로 1 사용 시) |
| `__tests__/agent/advisor.test.ts` **(신규)** | Unit + integration |
| `.planning/phases/27-claude-code-advisor-harness/EVIDENCE.md` **(신규)** | Runtime 검증 결과 |

### 2.5 Types

```typescript
// packages/core/src/agent/types.ts

export interface AdvisorConfig {
  enabled: boolean;                 // 기본 false
  transport: 'subagent' | 'cli-flag';  // 경로 1 or 경로 2
  subagentName?: string;            // default: 'sunco-advisor'
  modelHint?: string;               // 기본 'opus', CLI flag 경로에서만 사용
  maxCallsPerSkill: number;         // 기본 2
  timeoutMs: number;                // 기본 120_000 (2분)
  maxTurns: number;                 // 기본 1 (single exchange)
  maxPromptChars: number;           // 기본 20_000
  strict: boolean;                  // 기본 false (failure → warning, continue)
  requireSignature: boolean;        // 기본 true (signature line 필수)
  signaturePattern: string;         // default '[sunco-advisor v1 model=opus]'
}

export interface AdvisorRequest {
  skillId: string;                  // 호출 skill 식별
  phaseId?: string;                 // 현재 phase
  question: string;                 // advisor에게 물어볼 구체 질문
  context: {
    goal: string;                   // 현재 skill의 goal 1-2줄
    evidence: string[];             // 최대 5개의 evidence snippet (file path + quote)
    decision?: string;              // 이미 내린 결정 (리뷰 모드)
    alternatives?: string[];        // 고려 중인 대안
  };
}

export interface AdvisorResult {
  success: boolean;                 // 실행 성공 여부 (응답 수신)
  verified: boolean;                // signature로 Opus 실행 확인됨
  advice?: string;                  // advisor 응답 본문 (signature 제거된)
  rawResponse?: string;             // 디버그용 원문
  warnings: AdvisorWarning[];
  durationMs: number;
  transport: 'subagent' | 'cli-flag';
}

export type AdvisorWarning =
  | { code: 'disabled';           message: string }
  | { code: 'cap_exceeded';       message: string }
  | { code: 'timeout';            message: string }
  | { code: 'prompt_too_long';    message: string }
  | { code: 'no_signature';       message: string }
  | { code: 'unverified_model';   message: string }
  | { code: 'transport_error';    message: string }
  | { code: 'parse_error';        message: string };
```

### 2.6 Runner — `packages/core/src/agent/advisor.ts`

```typescript
import type { AdvisorConfig, AdvisorRequest, AdvisorResult, AdvisorWarning } from './types.js';
import { buildAdvisorPrompt, stripSignature, extractSignature } from '../../skills-workflow/src/shared/advisor-prompt.js';

export class AdvisorRunner {
  private callCounts = new Map<string, number>();  // skillId → count

  constructor(
    private cfg: AdvisorConfig,
    private cliProvider: ClaudeCliProvider,
  ) {}

  async run(req: AdvisorRequest): Promise<AdvisorResult> {
    const started = Date.now();
    const warnings: AdvisorWarning[] = [];

    if (!this.cfg.enabled) {
      return this.disabled(started);
    }

    const count = this.callCounts.get(req.skillId) ?? 0;
    if (count >= this.cfg.maxCallsPerSkill) {
      warnings.push({ code: 'cap_exceeded', message: `Cap ${this.cfg.maxCallsPerSkill} reached for ${req.skillId}` });
      return this.fail(warnings, started);
    }
    this.callCounts.set(req.skillId, count + 1);

    const prompt = buildAdvisorPrompt(req);
    if (prompt.length > this.cfg.maxPromptChars) {
      warnings.push({
        code: 'prompt_too_long',
        message: `Advisor prompt ${prompt.length} > cap ${this.cfg.maxPromptChars}`,
      });
      if (this.cfg.strict) return this.fail(warnings, started);
      // non-strict: truncate evidence and retry
    }

    try {
      const response = await this.invokeTransport(prompt);
      const { verified, advice, warning } = this.verifySignature(response);
      if (warning) warnings.push(warning);

      if (!verified && this.cfg.requireSignature) {
        if (this.cfg.strict) return this.fail(warnings, started);
      }

      return {
        success: true,
        verified,
        advice,
        rawResponse: response,
        warnings,
        durationMs: Date.now() - started,
        transport: this.cfg.transport,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = /timeout/i.test(msg);
      warnings.push({
        code: isTimeout ? 'timeout' : 'transport_error',
        message: msg,
      });
      if (this.cfg.strict) throw new Error(`Advisor strict mode: ${msg}`);
      return this.fail(warnings, started);
    }
  }

  private async invokeTransport(prompt: string): Promise<string> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.cfg.timeoutMs);
    try {
      if (this.cfg.transport === 'subagent') {
        // Delegate to ClaudeCliProvider's Task-tool subagent invocation
        return await this.cliProvider.runSubagent({
          agentName: this.cfg.subagentName ?? 'sunco-advisor',
          prompt,
          maxTurns: this.cfg.maxTurns,
          signal: ac.signal,
        });
      } else {
        // CLI flag path — spawn `claude -p --model <hint>` subprocess
        return await this.cliProvider.runOneShot({
          modelFlag: this.cfg.modelHint ?? 'opus',
          prompt,
          signal: ac.signal,
        });
      }
    } finally {
      clearTimeout(timer);
    }
  }

  private verifySignature(response: string) {
    const pattern = this.cfg.signaturePattern;
    const found = response.includes(pattern);
    const advice = stripSignature(response, pattern).trim();
    const warning: AdvisorWarning | undefined = found
      ? undefined
      : { code: 'no_signature', message: `Advisor response missing signature: ${pattern}` };
    return { verified: found, advice, warning };
  }

  private disabled(started: number): AdvisorResult {
    return {
      success: false,
      verified: false,
      warnings: [{ code: 'disabled', message: 'Advisor disabled by config' }],
      durationMs: Date.now() - started,
      transport: this.cfg.transport,
    };
  }

  private fail(warnings: AdvisorWarning[], started: number): AdvisorResult {
    return {
      success: false,
      verified: false,
      warnings,
      durationMs: Date.now() - started,
      transport: this.cfg.transport,
    };
  }

  resetCounts(): void {
    this.callCounts.clear();
  }
}
```

### 2.7 Config — `[agent.advisor]` section

```toml
# .sun/config.toml
[agent.advisor]
enabled = false                   # 기본 OFF — opt-in만 허용
transport = "subagent"            # "subagent" | "cli-flag"
subagent_name = "sunco-advisor"
model_hint = "opus"
max_calls_per_skill = 2
timeout_ms = 120000
max_turns = 1
max_prompt_chars = 20000
strict = false                    # true면 advisor 실패가 skill 실패
require_signature = true
signature_pattern = "[sunco-advisor v1 model=opus]"
```

### 2.8 Prompt builder — `packages/skills-workflow/src/shared/advisor-prompt.ts`

공식 advisor tool 문서의 3 블록을 SUNCO 맥락에 맞게 변용 (영어 유지 — system prompt 언어는 영향 측정 어려움, docs verbatim이 가장 안전):

```typescript
export const ADVISOR_TIMING_BLOCK = `You are a strong reviewer model (Opus) invoked by SUNCO at critical decision points. Your role is strategic: help the executor avoid wrong approaches and confirm when it is safe to proceed.

Call SUNCO's attention to:
- The single most load-bearing assumption that could be wrong.
- The evidence in the context that contradicts the current approach (if any).
- The smallest concrete next step that would reduce uncertainty.

Do NOT rewrite the executor's work. Do NOT produce a full plan. Do NOT speculate beyond the evidence provided.`;

export const ADVISOR_WEIGHT_BLOCK = `The executor will give your advice serious weight. Therefore be conservative: if the current approach looks correct given the evidence, say so in one sentence. If you disagree, state the specific claim that breaks the tie and the file/snippet that proves it.`;

export const ADVISOR_CONCISENESS_BLOCK =
  `Respond in under 100 words. Use enumerated steps, not explanations. Append the signature line [sunco-advisor v1 model=opus] at the very end of your response.`;

export function buildAdvisorPrompt(req: AdvisorRequest): string {
  const parts: string[] = [];
  parts.push(ADVISOR_TIMING_BLOCK);
  parts.push(ADVISOR_WEIGHT_BLOCK);
  parts.push(ADVISOR_CONCISENESS_BLOCK);
  parts.push('');
  parts.push(`## Skill\n${req.skillId}`);
  if (req.phaseId) parts.push(`## Phase\n${req.phaseId}`);
  parts.push(`## Goal\n${req.context.goal}`);
  if (req.context.decision) parts.push(`## Current decision\n${req.context.decision}`);
  if (req.context.alternatives?.length) {
    parts.push(`## Alternatives considered\n${req.context.alternatives.map(a => `- ${a}`).join('\n')}`);
  }
  if (req.context.evidence.length) {
    parts.push(`## Evidence\n${req.context.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`);
  }
  parts.push(`## Question\n${req.question}`);
  return parts.join('\n\n');
}

export function stripSignature(response: string, pattern: string): string {
  return response.replace(pattern, '').trim();
}

export function extractSignature(response: string, pattern: string): boolean {
  return response.includes(pattern);
}
```

### 2.9 `workflow.plan` 통합

`packages/skills-workflow/src/plan.skill.ts`는 현재 구조 유지하고 2개 지점에 advisor 호출 삽입:

```typescript
// 1. 초안 생성 전 — product/scope/risk 조언
if (ctx.config.agent.advisor?.enabled) {
  const pre = await ctx.agent.runAdvisor({
    skillId: 'workflow.plan',
    phaseId: phase.id,
    question: 'Before I draft plans, is there a load-bearing assumption in CONTEXT.md that would invalidate the current scope?',
    context: {
      goal: phase.goal,
      evidence: [
        `CONTEXT.md goal: ${contextSummary.goal}`,
        `ROADMAP position: ${phase.position}`,
        `Blockers noted: ${contextSummary.blockers.join(', ') || 'none'}`,
      ],
    },
  });
  if (pre.advice) {
    planningNotes.push(`### Advisor (pre-draft)\n${pre.advice}`);
    if (!pre.verified) ctx.ui.warn('Advisor signature missing — Opus execution unverified');
  }
}

// 2. Plan draft 작성 후 — plan-level critique
const draft = await generatePlanDraft(...);

if (ctx.config.agent.advisor?.enabled) {
  const post = await ctx.agent.runAdvisor({
    skillId: 'workflow.plan',
    phaseId: phase.id,
    question: 'Given the plan draft below, which task is most likely to fail its done_when criterion?',
    context: {
      goal: phase.goal,
      decision: 'Plan draft created',
      evidence: [
        `Task count: ${draft.tasks.length}`,
        `BDD criteria count: ${draft.bddCount}`,
        `First task: ${draft.tasks[0]?.title}`,
      ],
    },
  });
  if (post.advice) {
    planningNotes.push(`### Advisor (post-draft)\n${post.advice}`);
    if (!post.verified) ctx.ui.warn('Advisor signature missing — Opus execution unverified');
  }
}

// Planning artifacts에 advisor summary 포함
await writePlanningArtifact(phase.id, 'ADVISOR-NOTES.md', planningNotes.join('\n\n'));
```

### 2.10 Tests — `__tests__/agent/advisor.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AdvisorRunner } from '../../packages/core/src/agent/advisor.js';

describe('AdvisorRunner', () => {
  const baseCfg = {
    enabled: true,
    transport: 'subagent' as const,
    subagentName: 'sunco-advisor',
    maxCallsPerSkill: 2,
    timeoutMs: 5_000,
    maxTurns: 1,
    maxPromptChars: 10_000,
    strict: false,
    requireSignature: true,
    signaturePattern: '[sunco-advisor v1 model=opus]',
  };

  it('returns disabled result when config.enabled is false', async () => {
    const runner = new AdvisorRunner({ ...baseCfg, enabled: false }, mockProvider());
    const result = await runner.run(dummyReq());
    expect(result.success).toBe(false);
    expect(result.warnings[0].code).toBe('disabled');
  });

  it('invokes subagent and verifies signature', async () => {
    const provider = mockProvider({
      runSubagent: vi.fn().mockResolvedValue('1. Check CONTEXT.md scope\n[sunco-advisor v1 model=opus]'),
    });
    const runner = new AdvisorRunner(baseCfg, provider);
    const result = await runner.run(dummyReq());
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.advice).toBe('1. Check CONTEXT.md scope');
  });

  it('flags missing signature', async () => {
    const provider = mockProvider({
      runSubagent: vi.fn().mockResolvedValue('Just some advice without signature.'),
    });
    const runner = new AdvisorRunner(baseCfg, provider);
    const result = await runner.run(dummyReq());
    expect(result.verified).toBe(false);
    expect(result.warnings.some(w => w.code === 'no_signature')).toBe(true);
  });

  it('enforces maxCallsPerSkill', async () => {
    const provider = mockProvider();
    const runner = new AdvisorRunner({ ...baseCfg, maxCallsPerSkill: 1 }, provider);
    await runner.run(dummyReq());
    const second = await runner.run(dummyReq());
    expect(second.success).toBe(false);
    expect(second.warnings.some(w => w.code === 'cap_exceeded')).toBe(true);
  });

  it('handles timeout without failing skill in non-strict mode', async () => {
    const provider = mockProvider({
      runSubagent: vi.fn().mockRejectedValue(new Error('Operation timed out')),
    });
    const runner = new AdvisorRunner({ ...baseCfg, strict: false }, provider);
    const result = await runner.run(dummyReq());
    expect(result.success).toBe(false);
    expect(result.warnings.some(w => w.code === 'timeout')).toBe(true);
  });

  it('throws in strict mode on transport error', async () => {
    const provider = mockProvider({
      runSubagent: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const runner = new AdvisorRunner({ ...baseCfg, strict: true }, provider);
    await expect(runner.run(dummyReq())).rejects.toThrow(/strict mode/);
  });

  it('truncates oversized prompt in non-strict mode', async () => {
    // ...
  });
});

function dummyReq(): AdvisorRequest {
  return {
    skillId: 'workflow.plan',
    phaseId: '27',
    question: 'q',
    context: { goal: 'g', evidence: ['e1'] },
  };
}

function mockProvider(overrides?: Partial<ClaudeCliProvider>): ClaudeCliProvider {
  return {
    runSubagent: vi.fn().mockResolvedValue('stub'),
    runOneShot: vi.fn().mockResolvedValue('stub'),
    ...overrides,
  } as any;
}
```

### 2.11 EVIDENCE.md — runtime 검증 artifact

Phase 27 verify layer에서 반드시 생성:

```markdown
# Phase 27 — Advisor Harness Runtime Evidence

**Date:** YYYY-MM-DD
**Environment:** Claude Code CLI version `claude --version` output

## Transport verification

### Subagent path
- `.claude/agents/sunco-advisor.md` exists: YES/NO
- Frontmatter `model: opus` present: YES/NO
- Task tool invocation succeeded: YES/NO
- Signature `[sunco-advisor v1 model=opus]` in response: YES/NO

### CLI flag path (if tested)
- `claude --help` mentions --model flag: YES/NO
- `claude -p --model opus "hello"` succeeded: YES/NO
- Response identifies as Opus: YES/NO

## Workflow.plan integration
- Advisor called pre-draft: YES/NO (N times)
- Advisor called post-draft: YES/NO (N times)
- ADVISOR-NOTES.md written to phase directory: YES/NO

## Cap/timeout/strict behavior
- maxCallsPerSkill=2 enforced: YES/NO
- Timeout triggered at cfg value: YES/NO
- Non-strict mode: failure becomes warning: YES/NO
- Strict mode: failure throws: YES/NO

## Verdict
- [ ] PASS — advisor demonstrably runs on Opus in Claude Code env
- [ ] LIMITED — advisor runs but Opus cannot be verified via signature
- [ ] BLOCKED — neither transport works in current env; phase must not claim advisor works

## Verdict rationale
(fill in)
```

**중요:** `BLOCKED`면 Phase 27은 **PASS로 마감되지 않는다**. 검증 없는 claim은 "Advisor Tool이 작동하는 척"이라는 사용자가 경고한 안티패턴.

---

## 3. 리스크 & 확인 필요사항

### 3.1 NEEDS VERIFICATION (Phase 27 plan 작성 전 확인)

1. **Claude Code CLI subagent 정의 파일 위치** — `.claude/agents/` vs `.claude/subagents/`. 현재 사용자 환경에서 확인:
   ```bash
   ls -la ~/.claude/agents/ 2>/dev/null
   ls -la .claude/agents/ 2>/dev/null
   ```

2. **Task tool이 SUNCO skill context에서 직접 호출 가능한지** — `ClaudeCliProvider`가 이미 subprocess로 `claude`를 띄우는 구조이므로, 내부에서 Task tool 호출은 executor session의 일부가 아니라 nested process가 됨. Subagent 정의가 nested invocation에도 유효한지 확인.

3. **`claude -p --model opus` 플래그 지원 여부** — `claude --help` 출력 확인 필요. 만약 미지원이면 경로 2 폐기, 경로 1 단일 transport로 한정.

4. **Subagent model frontmatter가 구독 환경에서 Opus 강제 가능한지** — 이론상 가능하지만 구독 quota나 모델 제한 정책이 적용될 수 있음. 실제 호출로 signature 확인.

5. **Subagent 응답에 임의 텍스트를 포함시킬 수 있는지** — Opus가 `[sunco-advisor v1 model=opus]` 서명을 실제로 출력하는지 테스트. 모델이 서명을 거부하거나 수정하면 verification 전략 재설계.

6. **Timeout 구현 방법** — `ClaudeCliProvider`가 현재 execa를 쓰는지 확인. `AbortController` 지원 필요.

### 3.2 위험 신호

- **Opus 구독 quota 빠른 소진** — `maxCallsPerSkill=2`로도 `/sunco:auto` 같은 multi-phase pipeline에서 누적 시 고갈 가능. Phase 27 이후 `/sunco:auto` 재활성화 전에 **session-level cap** 추가 plan 필요 (Phase 27.1 또는 별도).

- **Signature 위조 불가능성** — Sonnet도 `[sunco-advisor v1 model=opus]` 문자열을 생성할 수 있음. 서명만으로는 "Opus가 실제로 실행됐다"를 증명 못 함. 보완:
  - CLI subprocess 경우 `claude -p --model opus`의 exit output/metadata에서 모델 ID 파싱
  - Subagent 경우 Claude Code statusline 로그 캡처
  - 최소한 **"Sonnet executor가 자기 자신에게 advisor 행세를 못하도록"** `ctx.agent.runAdvisor()` 내부에서 executor provider와 다른 경로를 강제

- **Prompt size 20K char cap** — 큰 phase의 CONTEXT.md는 이 cap을 넘길 수 있음. evidence 선별 로직이 핵심. `packages/skills-workflow/src/shared/context-zones.ts` (기존)와 통합 필수.

### 3.3 SUNCO 핵심 원칙 저촉 여부

| 원칙 | 저촉? | 코멘트 |
|---|---|---|
| Skill-Only | ❌ | runner는 provider 확장, skill 구조 그대로 |
| Deterministic First | ❌ | advisor는 명시적 opt-in, 기본 OFF |
| Clean Room | ❌ | public docs의 prompt pattern만 차용 |
| Korean-first | ❌ | system prompt는 영어 (verbatim 안전), UI 메시지는 한글 |
| Quality | ✅ | advisor는 품질 보강 layer |

---

## 4. Phase 27 plan 작성 전 필수 실행

```bash
# Verification commands (반드시 먼저 실행)

# 1. Claude CLI 버전
claude --version

# 2. CLI flag 지원 확인
claude --help 2>&1 | grep -iE 'model|subagent|task'

# 3. Subagent 디렉토리 확인
ls -la ~/.claude/agents/ 2>/dev/null || echo "no global agents dir"
ls -la .claude/agents/ 2>/dev/null || echo "no project agents dir"

# 4. 기존 SUNCO claude-cli provider 구조
# (Read /Users/min-kyungwook/SUN/packages/core/src/agent/providers/claude-cli.ts)

# 5. 실제 subagent Opus 호출 smoke test
#    .claude/agents/sunco-advisor.md 만들고 수동 Task 호출 → signature 확인
```

**이 5가지 확인이 끝나기 전에는 Phase 27 plan을 작성하지 않는다.** 검증 실패 시 transport 설계가 근본부터 바뀐다.

---

## 5. 공식 Advisor Tool과의 차이 명시

| 측면 | 공식 Advisor Tool (API) | SUNCO Harness (Claude Code) |
|---|---|---|
| 결제 | API token billing | Claude Code 구독 |
| 호출 단위 | `/v1/messages` 내부 server tool | 별도 subagent/subprocess round-trip |
| Context 전달 | 자동 (full transcript) | 수동 (SUNCO가 구성) |
| Advisor 응답 visibility | `advisor_tool_result` 블록 in response | raw stdout/subagent return |
| Usage 회계 | `iterations[]` 분리 | 호출 수만 카운트 |
| Caching | `caching: {type,ttl}` on tool definition | 없음 |
| Streaming | pause during sub-inference | 전체 pause (round-trip 동안) |
| Signature 검증 | 불필요 (server 보장) | 필수 (sunco-advisor signature) |
| 적용 scope | tool 배열에 한 줄 | skill별 opt-in |

**요약:** SUNCO 버전은 공식 API 버전보다 거칠다. Latency 높고 context 전달 수동이고 signature 검증 필요. 그러나 **결제 모델이 맞고**, **제품 효과 (Sonnet exec + Opus judgment)는 동일**하다. Phase 27의 약속은 이것만이다.

---

## 6. 후속 Phase (Phase 27 이후)

Phase 27이 PASS 판정을 받으면:

- **27.1** — `workflow.execute`에 ship-blocker advisor (결과물 작성 후 1회)
- **27.2** — `workflow.verify`의 critical layer 실패 시 advisor
- **27.3** — Session-level cap (`advisor.maxCallsPerSession`)
- **27.4** — Evidence-based cost tracking (구독 quota 소진 추정)

Phase 27 BLOCKED/LIMITED 판정 시:
- 재설계 필요 — 경로 3 (수동 advisor) 검토, 또는 Anthropic API billing 도입 결정

---

## 7. 참조

- Advisor Tool 공식 문서 (**설계 영감 only**, 구현 대상 아님): https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool
- SUNCO 기존 provider: `packages/core/src/agent/providers/claude-cli.ts`
- SUNCO agent router: `packages/core/src/agent/router.ts`
- SUNCO plan skill: `packages/skills-workflow/src/plan.skill.ts`
- SUNCO config: `packages/core/src/config/types.ts`
- 관련 사용자 메모리: `feedback_model_preference.md` (Opus=계획/디버깅, Sonnet=구현/단순작업)
