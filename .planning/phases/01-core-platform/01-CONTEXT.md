# Phase 1: Core Platform - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

SUN의 커널 구축: CLI 엔진, TOML 설정 시스템, 스킬 시스템(발견/로드/실행), 상태 엔진(.sun/), 에이전트 라우터(다중 provider), 프로액티브 추천 엔진, 인터랙티브 UX 기반. 이 위에 모든 스킬(Phase 2~10)이 올라간다.

32개 요구사항: CLI-01~04, CFG-01~04, SKL-01~06, STE-01~05, AGT-01~06, REC-01~04, UX-01~03

</domain>

<decisions>
## Implementation Decisions

### Monorepo Structure
- **D-01:** Monorepo 구조 — packages/core + packages/skills-harness + packages/skills-workflow + packages/skills-extension
- **D-02:** Turborepo + npm workspaces (빌드 캐시 + 병렬 빌드)
- **D-03:** npm publish는 `sunco` 단일 번들 (tsup으로 전체 번들링, 사용자는 `npm install -g sunco` 하나로 설치)

### Skill Discovery + Activation
- **D-04:** 하이브리드 — 컨벤션 기반 자동 스캔으로 발견, TOML 정책 파일로 활성화. "스킬은 컨벤션으로 발견하고, defineSkill()로 정의하고, TOML 정책으로 활성화하며, 최종 런타임은 항상 '활성 스킬 ID 집합'만 신뢰한다."
- **D-05:** defineSkill() = source of truth (메타데이터 + 실행 로직). TOML = 활성화/환경/정책만. frontmatter 사용 안 함. 진실의 원천은 하나.
- **D-06:** 스킬 ID ≠ CLI command 분리. 내부 참조는 stable skill ID (예: `harness.init`), CLI 명령어는 별도 UX 계층 (예: `init`). alias, rename, subcommand 확장 시 안 깨짐.
- **D-07:** stage = 안전 필터 (experimental | canary | stable | internal). 활성화 단위가 아님. stable이어도 화이트리스트에 없으면 안 켜짐. experimental이어도 화이트리스트에 있으면 경고와 함께 켜짐.
- **D-08:** routable vs directExec 구분. `sun do`/`sun next`/`sun auto` 같은 라우터 스킬은 routable 스킬만 대상으로 함. directExec은 CLI에서 직접 실행.
- **D-09:** 화이트리스트 방식 — "검증된 것만 켠다". 기본 전체 비활성화. 프리셋 + 개별 override로 활성화. 내부 런타임은 항상 최종 `Set<SkillId>`로 해소.
- **D-10:** 프리셋은 시스템 제공 preset registry에서 관리. 사용자 정의 프리셋은 초기 범위 제외. `sunco init`이 프로젝트 타입에 맞는 프리셋 자동 적용.
- **D-11:** 스캔 경로 컨벤션: `packages/skills-*/src/*.skill.ts`
- **D-12:** defineSkill() 최소 필수 필드: id, command, kind (deterministic/prompt/hybrid), stage, category, routing (routable/directExec), execute
- **D-13:** 활성 스킬 해석 순서: scan → metadata validate → preset 펼침 → add 추가 → remove 제거 → stage/provider/platform 필터 → `Set<SkillId>`
- **D-14:** 충돌 정책: 중복 id 발견 → fail-fast, 중복 command 발견 → fail-fast

```toml
# .sun/config.toml 예시
[skills]
preset = "harness"
add = ["workflow.status", "workflow.next"]
remove = ["harness.agents"]
```

### Agent Router + Provider Architecture
- **D-15:** 이중 경로 아키텍처 — Claude Code CLI (execa subprocess) + Vercel AI SDK (직접 API). 둘 다 동일한 AgentProvider 계약 구현. "하나의 provider에 두 통신을 넣는 구조"가 아니라 "같은 계약의 CLI provider와 SDK provider를 병렬로 두는 구조".
- **D-16:** 레이어 분리: Agent Router → Permission Harness → Provider Adapter → Result Normalizer → Cost/Token Tracker. Router는 transport 세부사항을 모름.
- **D-17:** Router는 3가지만 앎 — 누구에게 보낼지, 어떤 권한으로 실행할지, 결과를 어떻게 비교할지. subprocess인지 SDK인지 HTTP인지 신경 안 씀.
- **D-18:** Provider 식별 = family + transport. 예: `{family: 'claude', transport: 'cli'}` → id: `claude-code-cli`. 같은 family끼리 묶어서 fallback/검증 정책 적용 가능.
- **D-19:** PermissionSet 공통 타입 하나. Provider 바깥(Permission Harness)에서 강제. Provider는 자기 transport에 맞게 번역만 함.

```ts
type AgentRole = 'research' | 'planning' | 'execution' | 'verification';
type PermissionSet = {
  role: AgentRole;
  readPaths: string[];
  writePaths: string[];
  allowTests: boolean;
  allowNetwork: boolean;
  allowGitWrite: boolean;
  allowCommands: string[];
};
```

- **D-20:** AgentResult 공통 포맷. 모든 provider가 동일 구조 반환.

```ts
type Artifact = {
  path: string;
  kind: 'created' | 'modified' | 'report';
  description?: string;
};

type AgentResult = {
  providerId: string;
  success: boolean;
  outputText: string;
  artifacts: Artifact[];
  warnings: string[];
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
    estimated: boolean;
    wallTimeMs: number;
  };
  raw?: unknown;
};
```

- **D-21:** 비용 추적: 정확값 + 추정값 둘 다 허용. CLI는 토큰 정보 불완전할 수 있으므로 `estimated: true` 플래그.
- **D-22:** 크로스 검증: 같은 family (예: claude-code-cli + claude-sdk) → 독립성 낮음 가중치. family 다르면 독립성 높음.
- **D-23:** 역할별 기본 provider: execution → Claude Code CLI (코드 조작 강점), research/planning/verification → SDK (비용 효율). Phase 1 하드코딩, 나중에 TOML 정책화.
- **D-24:** SDK는 CLI의 보완이지 대체가 아님. CLI = 코드 작업형, SDK = 직접 생성형.
- **D-25:** Phase 1 비스트리밍 + 로그 수집. 스트리밍은 SUN Terminal 연동 시.
- **D-26:** 취소/타임아웃: AbortSignal 지원, provider별 timeout, timeout 시 typed error 반환 (AgentResult 아님), CLI kill / SDK cancel 공통 처리. 처음부터 넣어야 나중에 안 꼬임.
- **D-27:** 에러 분류 체계 (최소 4종): ProviderUnavailableError, PermissionDeniedError, ExecutionTimeoutError, ProviderExecutionError
- **D-28:** 아티팩트: `Artifact { path, kind, description? }` 구조화 타입. bare `string[]` 아님. Phase 7에서 `'test-result'` 등 kind 확장.
- **D-29:** 권한 강제: Phase 1에서 PermissionSet 6개 필드 전부 hard enforcement (논리적 수준). 프로세스/OS 레벨 샌드박싱은 Phase 1 밖.

```ts
interface AgentProvider {
  id: string;
  family: 'claude' | 'openai' | 'google' | 'custom';
  transport: 'cli' | 'sdk';
  isAvailable(): Promise<boolean>;
  execute(request: AgentRequest, context: AgentExecutionContext): Promise<AgentResult>;
}
```

### Interactive UX Architecture
- **D-30:** UI 3층 구조: Layer 1 (Ink thin wrappers) → Layer 2 (reusable shared components) → Layer 3 (lifecycle-based interaction patterns). 핵심 제품 단위는 컴포넌트가 아니라 인터랙션 패턴.
- **D-31:** Layer 1은 Ink 재구현 아님. Ink primitive 그대로 활용 + SUN 톤의 spacing, 색, emphasis만 얹기. API 표면적 최소화. 목표는 UI toolkit이 아니라 상호작용 일관성 확보.
- **D-32:** 4개 핵심 패턴 = 스킬 상태 머신의 view mapping: `idle → entry → choice? → running → result`. SkillEntry, InteractiveChoice, SkillProgress, SkillResult가 80% 커버. 나머지는 예외 패턴 (ReviewAndProceed, MultiStepFlow 등).
- **D-33:** 스킬은 Ink를 직접 import하지 않음. ctx.ui를 통해서만 UI 상호작용. 결정적 스킬도 에이전트 스킬도 같은 ctx.ui 계약 사용 → UX 통일성.
- **D-34:** ctx.ui는 의도 중심 pattern API. `ctx.ui.entry()`, `ctx.ui.ask()`, `ctx.ui.progress()`, `ctx.ui.result()`. primitive API (renderBox, renderText) 아님.
- **D-35:** progress는 ProgressHandle 반환. `update({ completed, message })`, `done({ summary })` 메서드. long-running skill UX 지원.

```ts
const progress = ctx.ui.progress({ title: '스캔 중...', total: 10 });
progress.update({ completed: 3, message: 'package.json 분석 완료' });
progress.done({ summary: '10개 항목 스캔 완료' });
```

- **D-36:** ctx.ui.ask()는 UiChoiceResult 반환. 단순 string 아님.

```ts
type UiChoiceResult = {
  selectedId: string;
  selectedLabel: string;
  source: 'keyboard' | 'default' | 'noninteractive';
};
```

- **D-37:** 세션 레벨 UI (StatusBar)는 스킬 밖 runtime 관심사. 스킬은 `ctx.usage.report()` / `ctx.events.emit()`으로 데이터만 제공, 세션 UI가 소비.
- **D-38:** 2계층 인터페이스 분리:

```ts
// A. Skill-facing API (스킬이 아는 것)
interface SkillUi {
  entry(input: SkillEntryInput): Promise<void>;
  ask(input: AskInput): Promise<UiChoiceResult>;
  progress(input: ProgressInput): ProgressHandle;
  result(input: ResultInput): Promise<void>;
}

// B. Renderer-facing internals (Ink adapter가 구현하는 것)
interface UiAdapter {
  mountPattern(pattern: UiPattern): Promise<UiOutcome>;
  update(handleId: string, patch: UiPatch): void;
  dispose(handleId: string): void;
}
```

- **D-39:** UI adapter 교체 가능: InkUiAdapter (기본), SilentUiAdapter (CI/테스트/--json/batch), 미래의 SunTerminalUiAdapter. 스킬 로직 그대로, adapter만 교체.
- **D-40:** 테마는 얇은 레이어 — tokens, colors, spacing. 디자인 시스템 과설계 아님.

```
packages/core/src/ui/
├── primitives/        # Layer 1: Ink thin wrappers
├── components/        # Layer 2: reusable blocks
├── patterns/          # Layer 3: lifecycle interaction patterns (핵심)
├── session/           # runtime/session-level UI (StatusBar)
├── theme/             # thin design tokens
├── hooks/             # selection, keymap, paging
└── adapters/
    ├── SkillUi.ts         # skill-facing contract
    ├── UiAdapter.ts       # renderer-facing contract
    ├── InkUiAdapter.ts
    └── SilentUiAdapter.ts
```

### Claude's Discretion
- TOML 설정 스키마 세부 필드명
- 프리셋 내부 스킬 목록 구성
- 테마 토큰 구체적 값 (색상, spacing 수치)
- SkillContext의 config/state/recommend API 세부 시그니처
- Commander.js 서브커맨드 등록 세부 구현

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tech Stack
- `CLAUDE.md` §Technology Stack — 전체 기술 스택 확정 (Node 24, TS 6, Commander.js 14, tsup 8.5, Vitest 4.1, Ink 6.8, smol-toml 1.6, Zod 4.3, chokidar 5, simple-git 3.33, execa 9, Vercel AI SDK 6, @anthropic-ai/sdk 0.80)
- `CLAUDE.md` §Architecture Decision: AI SDK as Primary — Vercel AI SDK + 직접 SDK escape hatch 전략

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 1 요구사항 32개 (CLI-01~04, CFG-01~04, SKL-01~06, STE-01~05, AGT-01~06, REC-01~04, UX-01~03)

### Project Context
- `.planning/PROJECT.md` §Non-Negotiables — 10가지 불변 원칙
- `.planning/PROJECT.md` §Skill Catalog — 49개 스킬 + 6개 인프라 모듈 전체 목록
- `.planning/PROJECT.md` §Constraints — 기술 스택 제약, clean room, skill-only 등

### Roadmap
- `.planning/ROADMAP.md` §Phase 1: Core Platform — 목표, 의존성, 성공 기준 5개

### Research (참고)
- `.planning/research/` — 프로젝트 리서치 결과 (스택, 아키텍처, 함정 등)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 없음 — 그린필드 프로젝트. CLAUDE.md만 존재.

### Established Patterns
- 없음 — Phase 1에서 모든 패턴 수립.

### Integration Points
- npm registry: `sunco` 패키지명 확보 완료
- Claude Code CLI: 로컬 설치 기반 execa subprocess 연동
- Vercel AI SDK: @ai-sdk/anthropic provider

</code_context>

<specifics>
## Specific Ideas

- "스킬은 컨벤션으로 발견하고, defineSkill()로 정의하고, TOML 정책으로 활성화하며, 최종 런타임은 항상 '활성 스킬 ID 집합'만 신뢰한다." — Skill System 핵심 문장
- "3번으로 가되, '하나의 Claude provider에 두 통신 방식을 욱여넣는 구조'가 아니라, '같은 계약을 구현하는 CLI provider와 SDK provider를 병렬로 두는 구조'로 가라." — Agent Router 핵심 문장
- "공유 컴포넌트 + 공통 인터랙션 패턴 + 얇은 테마 레이어. UI 라이브러리가 아니라 interaction system이어야 한다." — UX 핵심 문장
- 스킬 상태 머신: `idle → entry → choice? → running → result` — UI 패턴의 근거

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-platform*
*Context gathered: 2026-03-28*
