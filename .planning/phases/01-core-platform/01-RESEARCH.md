# Phase 1: Core Platform - Research

**Researched:** 2026-03-28
**Domain:** CLI runtime kernel -- TypeScript monorepo, skill system, TOML config, SQLite state, agent router, interactive UX
**Confidence:** HIGH

## Summary

Phase 1 builds the SUNCO kernel: 6 infrastructure modules that every future skill depends on. The scope is 32 requirements across CLI Engine, Config System, Skill System, State Engine, Agent Router, Proactive Recommender, and Interactive UX. This is a greenfield TypeScript monorepo project with no existing code.

The technical surface is well-defined. All core libraries (Commander.js 14, smol-toml 1.6, Zod 4.3, Ink 6.8, better-sqlite3 12.8, Vercel AI SDK 6, execa 9) are stable and verified on npm. The monorepo uses Turborepo 2.8 + npm workspaces with tsup 8.5 for bundling. One critical environment finding: the machine runs Node.js 22.16.0, not 24.x as specified in CLAUDE.md. Node 22 is acceptable per CLAUDE.md ("Node 22 LTS is also acceptable"), and better-sqlite3 has known prebuild issues with Node 24, making Node 22 the safer choice for Phase 1.

**Primary recommendation:** Start with monorepo scaffold (Turborepo + npm workspaces + tsup), then build modules bottom-up: Config System -> State Engine -> Skill System -> Agent Router -> Recommender -> CLI Engine -> UX layer. Each module should be independently testable with Vitest before integration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Monorepo 구조 -- packages/core + packages/skills-harness + packages/skills-workflow + packages/skills-extension
- **D-02:** Turborepo + npm workspaces (빌드 캐시 + 병렬 빌드)
- **D-03:** npm publish는 `sunco` 단일 번들 (tsup으로 전체 번들링, 사용자는 `npm install -g sunco` 하나로 설치)
- **D-04:** 하이브리드 스킬 발견 -- 컨벤션 기반 자동 스캔 발견, TOML 정책 파일 활성화. "스킬은 컨벤션으로 발견하고, defineSkill()로 정의하고, TOML 정책으로 활성화하며, 최종 런타임은 항상 '활성 스킬 ID 집합'만 신뢰한다."
- **D-05:** defineSkill() = source of truth (메타데이터 + 실행 로직). TOML = 활성화/환경/정책만. frontmatter 사용 안 함.
- **D-06:** 스킬 ID =/= CLI command 분리. 내부 참조는 stable skill ID (예: `harness.init`), CLI 명령어는 별도 UX 계층.
- **D-07:** stage = 안전 필터 (experimental | canary | stable | internal). 활성화 단위가 아님.
- **D-08:** routable vs directExec 구분. `sun do`/`sun next`/`sun auto` 같은 라우터 스킬은 routable 스킬만 대상으로 함.
- **D-09:** 화이트리스트 방식 -- "검증된 것만 켠다". 기본 전체 비활성화. 프리셋 + 개별 override로 활성화.
- **D-10:** 프리셋은 시스템 제공 preset registry에서 관리. 사용자 정의 프리셋은 초기 범위 제외.
- **D-11:** 스캔 경로 컨벤션: `packages/skills-*/src/*.skill.ts`
- **D-12:** defineSkill() 최소 필수 필드: id, command, kind (deterministic/prompt/hybrid), stage, category, routing (routable/directExec), execute
- **D-13:** 활성 스킬 해석 순서: scan -> metadata validate -> preset 펼침 -> add 추가 -> remove 제거 -> stage/provider/platform 필터 -> `Set<SkillId>`
- **D-14:** 충돌 정책: 중복 id 발견 -> fail-fast, 중복 command 발견 -> fail-fast
- **D-15:** 이중 경로 아키텍처 -- Claude Code CLI (execa subprocess) + Vercel AI SDK (직접 API). 둘 다 동일한 AgentProvider 계약 구현.
- **D-16:** 레이어 분리: Agent Router -> Permission Harness -> Provider Adapter -> Result Normalizer -> Cost/Token Tracker
- **D-17:** Router는 3가지만 앎 -- 누구에게 보낼지, 어떤 권한으로 실행할지, 결과를 어떻게 비교할지.
- **D-18:** Provider 식별 = family + transport. 예: `{family: 'claude', transport: 'cli'}` -> id: `claude-code-cli`.
- **D-19:** PermissionSet 공통 타입 하나. Provider 바깥(Permission Harness)에서 강제.
- **D-20:** AgentResult 공통 포맷. 모든 provider가 동일 구조 반환.
- **D-21:** 비용 추적: 정확값 + 추정값 둘 다 허용. `estimated: true` 플래그.
- **D-22:** 크로스 검증: 같은 family -> 독립성 낮음 가중치. family 다르면 독립성 높음.
- **D-23:** 역할별 기본 provider: execution -> Claude Code CLI, research/planning/verification -> SDK. Phase 1 하드코딩.
- **D-24:** SDK는 CLI의 보완이지 대체가 아님.
- **D-25:** Phase 1 비스트리밍 + 로그 수집. 스트리밍은 SUN Terminal 연동 시.
- **D-26:** 취소/타임아웃: AbortSignal 지원, provider별 timeout, timeout 시 typed error 반환.
- **D-27:** 에러 분류 체계 (최소 4종): ProviderUnavailableError, PermissionDeniedError, ExecutionTimeoutError, ProviderExecutionError
- **D-28:** 아티팩트: `Artifact { path, kind, description? }` 구조화 타입.
- **D-29:** 권한 강제: Phase 1에서 PermissionSet 6개 필드 전부 hard enforcement (논리적 수준).
- **D-30:** UI 3층 구조: Layer 1 (Ink thin wrappers) -> Layer 2 (reusable shared components) -> Layer 3 (lifecycle-based interaction patterns).
- **D-31:** Layer 1은 Ink 재구현 아님. Ink primitive 그대로 활용 + SUN 톤의 spacing, 색, emphasis만 얹기.
- **D-32:** 4개 핵심 패턴 = 스킬 상태 머신의 view mapping: `idle -> entry -> choice? -> running -> result`. SkillEntry, InteractiveChoice, SkillProgress, SkillResult가 80% 커버.
- **D-33:** 스킬은 Ink를 직접 import하지 않음. ctx.ui를 통해서만 UI 상호작용.
- **D-34:** ctx.ui는 의도 중심 pattern API. `ctx.ui.entry()`, `ctx.ui.ask()`, `ctx.ui.progress()`, `ctx.ui.result()`.
- **D-35:** progress는 ProgressHandle 반환. `update({ completed, message })`, `done({ summary })`.
- **D-36:** ctx.ui.ask()는 UiChoiceResult 반환 (selectedId, selectedLabel, source).
- **D-37:** 세션 레벨 UI (StatusBar)는 스킬 밖 runtime 관심사.
- **D-38:** 2계층 인터페이스 분리: SkillUi (스킬이 아는 것) + UiAdapter (Ink adapter가 구현하는 것).
- **D-39:** UI adapter 교체 가능: InkUiAdapter (기본), SilentUiAdapter (CI/테스트/--json/batch).
- **D-40:** 테마는 얇은 레이어 -- tokens, colors, spacing.

### Claude's Discretion
- TOML 설정 스키마 세부 필드명
- 프리셋 내부 스킬 목록 구성
- 테마 토큰 구체적 값 (색상, spacing 수치)
- SkillContext의 config/state/recommend API 세부 시그니처
- Commander.js 서브커맨드 등록 세부 구현

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-01 | `sunco` 바이너리가 npm으로 설치 가능 (npx sunco / npm install -g sunco) | tsup bin shebang injection + package.json bin field. Turborepo builds all packages, tsup bundles final CLI binary. |
| CLI-02 | Commander.js 기반 서브커맨드 라우팅, 스킬 자동 발견/등록 | Commander.js 14 .addCommand() + lazy loading from skill scanner. D-11 convention path scan -> D-13 resolution pipeline. |
| CLI-03 | `sunco --help` / `sunco <skill> --help`로 도움말 표시 | Commander.js built-in help generation. Skill metadata (description, options) from defineSkill(). |
| CLI-04 | 스킬 미설치/미발견 시 명확한 에러 메시지 + 추천 | Commander.js unknownCommand listener + Levenshtein distance suggestion. |
| CFG-01 | TOML 파일 파싱, 계층적 오버라이드: global -> project -> directory | smol-toml 1.6.1 parse(). Three-layer merge: ~/.sun/config.toml -> .sun/config.toml -> dir/.sun.toml. |
| CFG-02 | 배열 병합 시 상위 레벨 값을 대체(replace), 객체는 deep merge | Custom deepMerge with array-replace semantics. ~30 lines of code. |
| CFG-03 | 설정 값 타입 검증 (Zod 스키마) | Zod 4.3.6 schema with .default() for all fields + z.prettifyError() for user-friendly messages. |
| CFG-04 | `sunco settings` 스킬로 설정 조회/변경 가능 | Deterministic skill using ctx.config read + smol-toml stringify for write. Ink interactive UI. |
| SKL-01 | Skill 인터페이스 정의: name, description, type, execute(ctx) | defineSkill() with D-12 fields. TypeScript interface + Zod runtime validation. |
| SKL-02 | SkillContext 제공: config, state, agentRouter, recommend, run(skillName) | SkillContext interface creation. ctx.agent blocked for deterministic skills (createBlockedAgentProxy). |
| SKL-03 | 스킬 로더가 packages/skills-*에서 자동 발견 + 레지스트리 등록 | D-11 convention scan of `packages/skills-*/src/*.skill.ts`. Metadata extraction -> registry. |
| SKL-04 | 결정적 스킬은 Agent Router를 사용하지 않음 | Runtime type guard: createBlockedAgentProxy() throws on deterministic skill agent access. |
| SKL-05 | Prompt 스킬은 Agent Router를 통해 에이전트 디스패치 | ctx.agent.run() wrapping AgentRouter.dispatch(). Zod schema validation on response. |
| SKL-06 | ctx.run('lint') 형태로 스킬 간 직접 호출 가능 | ctx.run() goes through registry.execute(). Prevents circular calls with call stack tracking. |
| STE-01 | .sun/ 디렉토리 구조 관리 | Directory creation + .gitignore generation. Flat file manager for rules/tribal/scenarios/planning. |
| STE-02 | SQLite WAL 모드로 구조화 상태 저장 | better-sqlite3 12.8.0 with WAL mode, busy_timeout=5000, synchronous=NORMAL. Node 22 compatible. |
| STE-03 | 플랫 파일로 사람이 읽을 수 있는 아티팩트 | File-based read/write for .sun/rules/, .sun/tribal/, etc. Version-controlled content. |
| STE-04 | 병렬 에이전트 쓰기 시 데이터 손상 방지 | SQLite WAL for DB. Optimistic locking with content hashing for flat files. |
| STE-05 | 상태 저장/복원 API | StateAPI interface: get/set/delete/list for SQLite. Separate flat file API for artifacts. |
| AGT-01 | Provider 추상화 레이어: AgentProvider 인터페이스 | AgentProvider interface with id, family, transport, isAvailable(), execute(). D-18 family+transport ID. |
| AGT-02 | Claude Code CLI 첫 번째 provider 구현 | execa 9.6.1 subprocess with claude -p --output-format json. Flags: --allowedTools, --model, --max-turns. |
| AGT-03 | 에이전트 권한 스코핑: PermissionSet | D-19 PermissionSet type with 6 fields (role, readPaths, writePaths, allowTests, allowNetwork, allowGitWrite, allowCommands). |
| AGT-04 | 연구=읽기전용, 계획=.planning/만, 실행=src/만, 검증=읽기+테스트만 | D-23 role-based provider defaults. Permission Harness maps AgentRole -> PermissionSet. |
| AGT-05 | 크로스 검증: 여러 provider에게 독립적으로 검증 요청 가능 | Promise.allSettled() dispatch to multiple providers. D-22 independence weighting by family. |
| AGT-06 | 토큰/비용 추적 (provider별 사용량 기록) | AgentResult.usage field with inputTokens, outputTokens, estimatedCostUsd, estimated, wallTimeMs. State Engine persistence. |
| REC-01 | 룰 엔진 기반 (state, lastResult) -> Recommendation[] 매핑 | Pure function: (state, lastSkillResult) => Recommendation[]. Deterministic, sub-ms. |
| REC-02 | 모든 스킬 실행 끝에 Next Best Action 추천 표시 | CLI Engine lifecycle hook: after skill execute, run recommender, render via ctx.ui.result(). |
| REC-03 | 상태 기반 라우팅: execute 끝->verify, verify 실패->debug, verify 성공->ship | Rule definitions mapping skill outcomes to next recommendations. |
| REC-04 | 추천 규칙 20-50개, 결정적, sub-ms 응답 | Array of RecommendationRule objects. Pattern-match on state + last result. No LLM. |
| UX-01 | 모든 의사결정 지점에서 선택지 제시 (옵션 2-4개 + Recommended 태그) | ctx.ui.ask() with InteractiveChoice pattern. ink-select-input 6.2.0 + custom Recommended badge. |
| UX-02 | 프로액티브 추천: 모든 스킬 실행 끝에 다음 스킬 추천 | REC-02 output rendered via SkillResult pattern with recommendation cards. |
| UX-03 | 시각적 피드백: 진행도 바, 상태 심볼, 스피너, 에러 박스 | ctx.ui.progress() with ProgressHandle. ink-spinner 5.0.0. chalk 5.6.2 for status symbols. Ink Box for error display. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech Stack**: TypeScript (Node.js), Commander.js, TOML, tsup, Vitest -- locked
- **Distribution**: npm (npx sunco / npm install -g sunco) -- `sunco` package name verified
- **First Agent Provider**: Claude Code CLI priority, Provider-agnostic abstraction layer above
- **Clean Room**: GSD code copy forbidden. Concepts only, write from scratch
- **Skill-Only**: All features are skills. No hardcoded commands
- **Deterministic First**: If enforceable via linter/test, do not use LLM
- **Quality**: Each skill is a finished product. Full effort per skill
- **GSD Workflow Enforcement**: No direct repo edits outside GSD workflow unless user explicitly bypasses

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard | Verified |
|---------|---------|---------|--------------|----------|
| Node.js | 22.16.0 (current machine) | Runtime | Native TS strip-types, npm 10.9. CLAUDE.md says "Node 22 LTS is also acceptable". Node 24 has better-sqlite3 prebuild issues. | npm registry 2026-03-28 |
| TypeScript | 6.0.2 | Type system | strict=true by default, es2025 target. Last JS-based TS release. | npm registry 2026-03-28 |
| Commander.js | 14.0.3 | CLI engine | 35M+ weekly downloads, zero deps, excellent TS types, .addCommand() for subcommands | npm registry 2026-03-28 |
| tsup | 8.5.1 | Bundler | esbuild-powered, shebang injection for CLI bins, CJS+ESM dual output | npm registry 2026-03-28 |
| smol-toml | 1.6.1 | TOML parsing | TOML 1.1.0 compliant, zero deps, ESM-native, TomlError with line/column | npm registry 2026-03-28 |
| Zod | 4.3.6 | Schema validation | z.infer<> type derivation, z.prettifyError(), 106M weekly downloads | npm registry 2026-03-28 |
| Vitest | 4.1.2 | Testing | Vite-powered, native TS, built-in mocking, instant watch mode | npm registry 2026-03-28 |
| Turborepo | 2.8.20 | Monorepo build | Build cache + parallel builds, npm workspaces integration | npm registry 2026-03-28 |

### Agent Router

| Library | Version | Purpose | Why Standard | Verified |
|---------|---------|---------|--------------|----------|
| Vercel AI SDK (`ai`) | 6.0.141 | Provider-agnostic AI | 20M+ monthly downloads, unified API for 20+ providers, agent abstraction v6 | npm registry 2026-03-28 |
| @ai-sdk/anthropic | latest | Anthropic provider for AI SDK | Official Vercel AI SDK provider for Claude models | npm registry |
| @anthropic-ai/sdk | 0.80.0 | Direct Anthropic API | Escape hatch for Claude-specific features | npm registry 2026-03-28 |
| execa | 9.6.1 | Subprocess execution | Promise-based, streaming, AbortSignal support. For Claude Code CLI subprocess. | npm registry 2026-03-28 |

### State Engine

| Library | Version | Purpose | Why Standard | Verified |
|---------|---------|---------|--------------|----------|
| better-sqlite3 | 12.8.0 | SQLite WAL | Fastest Node.js SQLite, synchronous API, prebuilds for Node 20/22/23/24 (22 safest) | npm registry 2026-03-28 |

### Terminal UI

| Library | Version | Purpose | Why Standard | Verified |
|---------|---------|---------|--------------|----------|
| Ink | 6.8.0 | React for terminal | Component-based CLI rendering, Flexbox via Yoga. Used by Claude Code, Shopify CLI, Prisma. | npm registry 2026-03-28 |
| React | 19.2.4 | Ink peer dependency | Ink 6 requires React >= 19.0.0 | npm registry 2026-03-28 |
| ink-spinner | 5.0.0 | Loading indicators | Spinner component for Ink | npm registry 2026-03-28 |
| ink-select-input | 6.2.0 | Selection prompts | Multi-option selection, perfect for InteractiveChoice pattern | npm registry 2026-03-28 |
| ink-text-input | 6.0.0 | Text input | User input in interactive contexts | npm registry 2026-03-28 |
| chalk | 5.6.2 | Color output | For non-Ink contexts and status symbols | npm registry 2026-03-28 |
| cli-progress | 3.12.0 | Progress bars | For long-running deterministic operations | npm registry 2026-03-28 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| glob | 13.0.6 | File globbing | Skill scanner convention path matching |
| picomatch | 4.x | Fast glob matching | Permission path matching in Agent Router |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | node:sqlite (built-in) | node:sqlite is Stability 1.1 in Node 22, 1.2 in Node 25. Not stable enough yet. better-sqlite3 is proven. Revisit when node:sqlite reaches stable. |
| better-sqlite3 | sql.js (WASM) | No native addon issues but slower for write-heavy workloads. better-sqlite3 is 2-5x faster. |
| Custom deep merge | deep-merge-ts | Custom is ~30 lines with array-replace semantics. Library adds dependency for trivial logic. Write custom. |
| Ink | blessed/neo-blessed | Unmaintained since 2017. Ink is the standard. |
| cosmiconfig | Custom TOML loader | SUN is TOML-only. cosmiconfig's multi-format search is wasted complexity. |

**Installation (dev setup):**
```bash
# Root package.json (workspace root)
npm init -w packages/core -w packages/skills-harness -w packages/skills-workflow -w packages/skills-extension -w packages/cli

# Core dependencies (in packages/core)
npm install commander@14.0.3 smol-toml@1.6.1 zod@4.3.6 better-sqlite3@12.8.0 execa@9.6.1 glob@13.0.6 picomatch@4

# AI dependencies (in packages/core)
npm install ai@6 @ai-sdk/anthropic @anthropic-ai/sdk@0.80.0

# UI dependencies (in packages/core)
npm install ink@6.8.0 react@19.2.4 ink-spinner@5.0.0 ink-select-input@6.2.0 ink-text-input@6.0.0 chalk@5.6.2 cli-progress@3.12.0

# Dev dependencies (root)
npm install -D typescript@6.0.2 tsup@8.5.1 vitest@4.1.2 turbo@2.8.20 @types/better-sqlite3 @types/react
```

## Architecture Patterns

### Recommended Project Structure

```
sunco/
├── package.json                    # Workspace root (npm workspaces)
├── turbo.json                      # Turborepo pipeline config
├── tsconfig.base.json              # Shared TS config
├── vitest.workspace.ts             # Vitest workspace config
├── packages/
│   ├── core/                       # @sunco/core -- all infrastructure modules
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── cli/                # CLI Engine (Commander.js setup)
│   │       │   ├── program.ts      # Commander.js program creation
│   │       │   ├── skill-router.ts # Skill -> subcommand registration
│   │       │   └── lifecycle.ts    # Pre/post skill execution hooks
│   │       ├── config/             # Config System
│   │       │   ├── loader.ts       # TOML file discovery + loading
│   │       │   ├── merger.ts       # Three-layer deep merge
│   │       │   ├── schema.ts       # Zod schemas for config
│   │       │   └── types.ts        # Config TypeScript types
│   │       ├── skill/              # Skill System
│   │       │   ├── define.ts       # defineSkill() factory
│   │       │   ├── scanner.ts      # Convention-based skill discovery
│   │       │   ├── registry.ts     # Skill registry (Map<SkillId, Skill>)
│   │       │   ├── resolver.ts     # D-13 resolution pipeline
│   │       │   ├── context.ts      # SkillContext creation
│   │       │   ├── preset.ts       # Preset registry + expansion
│   │       │   └── types.ts        # Skill TypeScript types
│   │       ├── state/              # State Engine
│   │       │   ├── database.ts     # SQLite WAL setup + schema
│   │       │   ├── file-store.ts   # Flat file read/write for .sun/
│   │       │   ├── api.ts          # StateAPI interface implementation
│   │       │   ├── directory.ts    # .sun/ directory management
│   │       │   └── types.ts
│   │       ├── agent/              # Agent Router
│   │       │   ├── router.ts       # AgentRouter dispatch logic
│   │       │   ├── permission.ts   # PermissionHarness enforcement
│   │       │   ├── provider.ts     # AgentProvider interface
│   │       │   ├── providers/
│   │       │   │   ├── claude-cli.ts    # Claude Code CLI provider
│   │       │   │   └── claude-sdk.ts    # Vercel AI SDK Anthropic provider
│   │       │   ├── result.ts       # AgentResult normalization
│   │       │   ├── tracker.ts      # Cost/token tracking
│   │       │   ├── errors.ts       # Typed error hierarchy
│   │       │   └── types.ts
│   │       ├── recommend/          # Proactive Recommender
│   │       │   ├── engine.ts       # Rule engine: (state, result) => Recommendation[]
│   │       │   ├── rules.ts        # 20-50 recommendation rules
│   │       │   └── types.ts
│   │       ├── ui/                 # Interactive UX
│   │       │   ├── primitives/     # Layer 1: Ink thin wrappers
│   │       │   │   ├── Box.tsx
│   │       │   │   ├── Text.tsx
│   │       │   │   └── Badge.tsx
│   │       │   ├── components/     # Layer 2: Reusable blocks
│   │       │   │   ├── StatusSymbol.tsx
│   │       │   │   ├── ErrorBox.tsx
│   │       │   │   └── RecommendationCard.tsx
│   │       │   ├── patterns/       # Layer 3: Lifecycle interaction patterns
│   │       │   │   ├── SkillEntry.tsx
│   │       │   │   ├── InteractiveChoice.tsx
│   │       │   │   ├── SkillProgress.tsx
│   │       │   │   └── SkillResult.tsx
│   │       │   ├── session/        # Session-level UI
│   │       │   │   └── StatusBar.tsx
│   │       │   ├── theme/          # Design tokens
│   │       │   │   ├── tokens.ts
│   │       │   │   └── colors.ts
│   │       │   ├── hooks/          # React hooks
│   │       │   │   ├── useSelection.ts
│   │       │   │   └── useKeymap.ts
│   │       │   └── adapters/       # UI abstraction layer
│   │       │       ├── SkillUi.ts       # Skill-facing contract
│   │       │       ├── UiAdapter.ts     # Renderer-facing contract
│   │       │       ├── InkUiAdapter.ts  # Default: Ink-based rendering
│   │       │       └── SilentUiAdapter.ts  # CI/test/--json mode
│   │       └── errors/             # Shared error types
│   │           └── index.ts
│   ├── skills-harness/             # @sunco/skills-harness (Phase 2, stub now)
│   │   ├── package.json
│   │   └── src/
│   │       └── (empty -- Phase 2)
│   ├── skills-workflow/            # @sunco/skills-workflow (Phase 3+, stub now)
│   │   ├── package.json
│   │   └── src/
│   │       └── (empty -- later phases)
│   ├── skills-extension/           # @sunco/skills-extension (v2, stub now)
│   │   ├── package.json
│   │   └── src/
│   │       └── (empty -- v2)
│   └── cli/                        # @sunco/cli -- entry point, npm bin
│       ├── package.json            # "bin": { "sunco": "./dist/cli.js" }
│       ├── tsup.config.ts          # Bundle everything into single executable
│       └── src/
│           └── cli.ts              # Entry point: import core, register skills, run
```

### Pattern 1: defineSkill() Factory

**What:** Every skill is defined via defineSkill() which validates metadata at build time and provides type-safe execute context.
**When to use:** Always. This is the only way to create a skill.

```typescript
// packages/skills-harness/src/settings.skill.ts
import { defineSkill } from '@sunco/core';

export default defineSkill({
  id: 'core.settings',
  command: 'settings',
  kind: 'deterministic',
  stage: 'stable',
  category: 'core',
  routing: 'directExec',
  description: 'TOML 설정 조회/변경',
  options: [
    { flags: '--show-resolved', description: '최종 병합된 설정 표시' },
  ],

  async execute(ctx) {
    // ctx.config -- merged TOML config (readonly)
    // ctx.state  -- StateAPI (read/write .sun/)
    // ctx.ui     -- SkillUi (entry/ask/progress/result)
    // ctx.agent  -- BLOCKED (deterministic skill)
    // ctx.run    -- call other skills
    // ctx.log    -- structured logging

    await ctx.ui.entry({ title: 'Settings', description: '현재 설정 확인' });

    const config = ctx.config;
    // ... render settings via ctx.ui.result()
  },
});
```

### Pattern 2: Skill Scanner -> Resolution Pipeline (D-13)

**What:** Convention-based discovery followed by policy-based activation filtering.
**When to use:** At CLI startup, before subcommand registration.

```typescript
// Resolution pipeline (D-13)
async function resolveActiveSkills(
  scanPaths: string[],
  policyConfig: SkillPolicyConfig,
): Promise<Set<string>> {
  // Step 1: Scan packages/skills-*/src/*.skill.ts
  const discovered = await scanSkillFiles(scanPaths);

  // Step 2: Validate metadata (defineSkill() output)
  const validated = discovered.filter(s => validateSkillMeta(s));

  // Step 3: Expand preset -> skill IDs
  const fromPreset = expandPreset(policyConfig.preset);

  // Step 4: Add explicit additions
  const withAdds = new Set([...fromPreset, ...policyConfig.add]);

  // Step 5: Remove explicit removals
  for (const id of policyConfig.remove) withAdds.delete(id);

  // Step 6: Filter by stage/provider/platform
  const filtered = [...withAdds].filter(id => {
    const skill = validated.find(s => s.id === id);
    if (!skill) return false;
    return isStageAllowed(skill.stage) && isPlatformMatch(skill);
  });

  // Step 7: Check for conflicts (D-14)
  checkDuplicateIds(filtered);
  checkDuplicateCommands(filtered);

  return new Set(filtered);
}
```

### Pattern 3: Agent Router Dispatch

**What:** Provider-agnostic dispatch with permission enforcement, error typing, and cost tracking.
**When to use:** Every prompt/hybrid skill.

```typescript
// Agent Router usage in a prompt skill
export default defineSkill({
  id: 'sample.prompt',
  kind: 'prompt',
  // ...

  async execute(ctx) {
    const result = await ctx.agent.run({
      role: 'research',
      prompt: 'Analyze this codebase architecture',
      permissions: {
        role: 'research',
        readPaths: ['src/**', '.planning/**'],
        writePaths: [],
        allowTests: false,
        allowNetwork: false,
        allowGitWrite: false,
        allowCommands: [],
      },
      expectedSchema: AnalysisOutputSchema,
      timeout: 60_000,
    });

    // result is typed AgentResult
    // result.usage has token/cost info
    // result.artifacts has structured file references
    await ctx.state.set('analysis.result', result);
  },
});
```

### Pattern 4: Three-Layer Config Merge

**What:** TOML config loaded from 3 layers with object deep-merge and array replace semantics.
**When to use:** Every CLI invocation.

```typescript
// Config loading order
function loadConfig(cwd: string): SunConfig {
  const global = loadToml(path.join(os.homedir(), '.sun', 'config.toml'));
  const project = loadToml(path.join(findProjectRoot(cwd), '.sun', 'config.toml'));
  const directory = loadToml(path.join(cwd, '.sun.toml'));

  // Merge: global <- project <- directory (last wins)
  const raw = deepMerge(deepMerge(global, project), directory);

  // Validate with Zod (all fields have .default())
  return SunConfigSchema.parse(raw);
}

// Custom deepMerge: objects merge recursively, arrays REPLACE
function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)
        && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}
```

### Pattern 5: UI Adapter Pattern (D-38/D-39)

**What:** Skills call ctx.ui (SkillUi interface), which delegates to a UiAdapter. Default is InkUiAdapter; tests/CI use SilentUiAdapter.
**When to use:** All skill UI interactions.

```typescript
// Skill-facing API (what skills see)
interface SkillUi {
  entry(input: SkillEntryInput): Promise<void>;
  ask(input: AskInput): Promise<UiChoiceResult>;
  progress(input: ProgressInput): ProgressHandle;
  result(input: ResultInput): Promise<void>;
}

// Renderer-facing API (what adapters implement)
interface UiAdapter {
  mountPattern(pattern: UiPattern): Promise<UiOutcome>;
  update(handleId: string, patch: UiPatch): void;
  dispose(handleId: string): void;
}

// Factory: select adapter based on environment
function createUiAdapter(flags: CliFlags): UiAdapter {
  if (flags.json || flags.silent || !process.stdout.isTTY) {
    return new SilentUiAdapter();
  }
  return new InkUiAdapter();
}
```

### Anti-Patterns to Avoid

- **Direct Ink import in skills:** Skills must use ctx.ui only. Direct Ink usage bypasses the adapter layer, breaks testability, and prevents future SUN Terminal integration.
- **Agent access in deterministic skills:** The createBlockedAgentProxy() pattern MUST be enforced. Any deterministic skill touching ctx.agent.run() should throw at runtime.
- **Config mutation after initialization:** Config is frozen (Readonly<SunConfig>) after merge. Skills read but never write config. `sunco settings` writes to TOML files, not to the runtime config object.
- **Custom provider abstraction on top of AI SDK:** SUN's Agent Router adds permission scoping and cost tracking. It does NOT replace Vercel AI SDK's provider abstraction. Do not reimplement what AI SDK already solves.
- **Hardcoded commands:** Every user-facing command must be a skill registered via defineSkill(). No Commander.js commands registered outside the skill system.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI parsing | Custom arg parser | Commander.js 14 | Subcommands, help generation, option types, completion -- all solved |
| TOML parsing | Regex/custom parser | smol-toml 1.6.1 | TOML 1.1.0 spec is complex (dates, inline tables, multiline strings) |
| Schema validation | Manual type checks | Zod 4.3.6 | Type inference, error formatting, composability |
| Subprocess management | Raw child_process | execa 9.6.1 | Timeout, signal handling, streaming, error normalization |
| AI provider abstraction | Custom HTTP clients per provider | Vercel AI SDK 6 | 20+ provider adapters, streaming, structured output, tool calling |
| Terminal UI framework | Raw ANSI escape codes | Ink 6.8.0 | Component model, layout engine, input handling, accessibility |
| SQLite access | Raw SQL file operations | better-sqlite3 12.8.0 | WAL mode, prepared statements, serialization, busy handling |
| Progress bars | Manual cursor manipulation | cli-progress 3.12.0 / Ink components | Terminal width handling, ETA calculation, multi-bar support |

**Key insight:** Phase 1 is infrastructure. Every hour spent building what a library already solves is an hour not spent on the skill system design and UX quality that actually differentiates SUNCO.

## Common Pitfalls

### Pitfall 1: better-sqlite3 Native Addon on Node 24
**What goes wrong:** better-sqlite3 requires native compilation. Node 24 has known prebuild issues (missing binaries for N-API 137, V8 API changes requiring C++20).
**Why it happens:** better-sqlite3 prebuilds lag behind new Node.js major releases.
**How to avoid:** Use Node.js 22 LTS for Phase 1. CLAUDE.md explicitly allows this: "Node 22 LTS is also acceptable (EOL Apr 2027)". The current machine already has Node 22.16.0. Add `engines: { "node": ">=22" }` to package.json.
**Warning signs:** `npm install` fails with `node-gyp` errors or "no prebuilt binaries found" warnings.

### Pitfall 2: TOML Config Merge Array Semantics
**What goes wrong:** Users expect arrays to concatenate across layers (global `ignorePaths = ["node_modules"]` + project `ignorePaths = ["dist"]` = `["node_modules", "dist"]`). But the decision is array REPLACE.
**Why it happens:** No TOML spec defines merge semantics. Every tool invents its own.
**How to avoid:** Document merge rules in generated config comments. Implement `sunco settings --show-resolved` early to display final merged config with source annotations. Every Zod schema field must have `.default()`.
**Warning signs:** Users report "my global setting disappeared" -- they expected merge, got replace.

### Pitfall 3: Skill Loading Startup Latency
**What goes wrong:** Loading 49 skill modules at startup adds 200-500ms. User types `sunco status` and waits.
**Why it happens:** Each skill file import triggers TS transpilation and module resolution.
**How to avoid:** Lazy-load skills. Register only metadata (id, command, description) from the scanner at startup. The actual skill module (execute function) loads only when invoked. Target: `sunco --help` in <100ms.
**Warning signs:** Startup exceeds 100ms. Benchmark in CI with Vitest.

### Pitfall 4: Claude Code CLI Not Installed
**What goes wrong:** User installs sunco but doesn't have Claude Code CLI. Prompt skills fail silently or with cryptic errors.
**Why it happens:** Claude Code CLI is a separate install. Not all users will have it.
**How to avoid:** `isAvailable()` on ClaudeCliProvider checks `command -v claude`. When unavailable, the Agent Router falls back to SDK provider (direct API). If no provider is available, fail with a clear message: "No AI provider available. Install Claude Code CLI or configure an API key."
**Warning signs:** `AGT-02` tests pass in dev but fail in CI where Claude Code CLI is not installed.

### Pitfall 5: Ink Rendering Performance with Large Outputs
**What goes wrong:** Ink re-renders the entire component tree on state changes. Skills producing long output (e.g., lint results for 1000 files) cause terminal flicker.
**Why it happens:** React's reconciliation on every state update in terminal context.
**How to avoid:** Use Ink's `<Static>` component for already-rendered output (scrollback). Paginate large results: show first 20, "Show more" option. For non-interactive batch output, use SilentUiAdapter which bypasses Ink entirely.
**Warning signs:** Terminal flickers or slows down during long skill output.

### Pitfall 6: Circular Skill Invocation via ctx.run()
**What goes wrong:** Skill A calls ctx.run('B'), Skill B calls ctx.run('A'). Infinite loop.
**Why it happens:** ctx.run() allows arbitrary skill chaining.
**How to avoid:** Maintain a call stack in SkillContext. Before executing ctx.run(), check if the target skill is already on the stack. If so, throw CircularSkillInvocationError.
**Warning signs:** Process hangs or crashes with stack overflow during skill execution.

### Pitfall 7: smol-toml Comment Loss on Config Write
**What goes wrong:** `sunco settings set agent.timeout 30000` parses TOML, modifies, stringifies -- losing all user comments and formatting.
**Why it happens:** smol-toml parse/stringify round-trip does not preserve comments (TOML spec limitation).
**How to avoid:** For config writes, use line-level text manipulation (regex/string replace on the specific key) instead of parse-modify-stringify. Only use stringify for generating NEW config files (during `sunco init`).
**Warning signs:** Users complain "my config comments disappeared."

### Pitfall 8: ESM Module Resolution in Monorepo
**What goes wrong:** Cross-package imports fail with "Cannot find module" because TypeScript path aliases don't match Node.js runtime resolution.
**Why it happens:** TypeScript `paths` in tsconfig.json don't affect runtime. Node.js needs actual file paths.
**How to avoid:** Use npm workspaces package references (`@sunco/core` in package.json dependencies). tsup bundles resolve these. For dev mode, use TypeScript project references or `tsx` with proper module resolution. Set `"type": "module"` in all package.json files.
**Warning signs:** `tsc` passes but runtime throws "ERR_MODULE_NOT_FOUND".

## Code Examples

### Monorepo Root package.json
```json
{
  "name": "sunco-monorepo",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "dev": "turbo run dev",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.8.20",
    "typescript": "^6.0.2",
    "vitest": "^4.1.2"
  }
}
```

### turbo.json
```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

### packages/cli/package.json (npm publish target)
```json
{
  "name": "sunco",
  "version": "0.1.0",
  "description": "에이전트가 실수를 덜 하게 판을 깔아주는 워크스페이스 OS",
  "type": "module",
  "bin": {
    "sunco": "./dist/cli.js"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=22"
  },
  "dependencies": {
    "@sunco/core": "workspace:*"
  }
}
```

### packages/cli/tsup.config.ts (Single-bundle for npm)
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  shims: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Bundle all workspace dependencies into single file
  noExternal: [/@sunco\/.*/],
  // Keep native addons external
  external: ['better-sqlite3'],
});
```

### SQLite State Engine Setup
```typescript
// Source: better-sqlite3 docs + project research ARCHITECTURE.md
import Database from 'better-sqlite3';
import path from 'node:path';

export function openStateDB(sunDir: string): Database.Database {
  const db = new Database(path.join(sunDir, 'state.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      status TEXT CHECK(status IN ('success', 'failure', 'partial')),
      data_json TEXT,
      artifacts_json TEXT
    );

    CREATE TABLE IF NOT EXISTS state_kv (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      input_tokens INTEGER,
      output_tokens INTEGER,
      estimated_cost_usd REAL,
      estimated BOOLEAN DEFAULT 0,
      wall_time_ms INTEGER
    );
  `);
}
```

### Claude Code CLI Provider
```typescript
// Source: Claude Code CLI reference docs (code.claude.com)
import { execa, type ExecaError } from 'execa';
import type { AgentProvider, AgentRequest, AgentResult } from '../types.js';

export class ClaudeCliProvider implements AgentProvider {
  readonly id = 'claude-code-cli';
  readonly family = 'claude' as const;
  readonly transport = 'cli' as const;

  async isAvailable(): Promise<boolean> {
    try {
      await execa('claude', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  async execute(
    request: AgentRequest,
    signal?: AbortSignal,
  ): Promise<AgentResult> {
    const startTime = Date.now();

    const args: string[] = [
      '-p',                           // Non-interactive print mode
      '--output-format', 'json',      // Structured JSON output
    ];

    // Permission scoping via --allowedTools
    if (request.permissions.allowCommands.length > 0) {
      args.push('--allowedTools', ...this.buildAllowedTools(request.permissions));
    }

    // Model override
    if (request.model) {
      args.push('--model', request.model);
    }

    // Max turns limit
    if (request.maxTurns) {
      args.push('--max-turns', String(request.maxTurns));
    }

    try {
      const result = await execa('claude', args, {
        input: request.prompt,
        timeout: request.timeout ?? 120_000,
        signal,
      });

      const parsed = JSON.parse(result.stdout);
      return this.normalizeResult(parsed, startTime);
    } catch (error) {
      if ((error as ExecaError).timedOut) {
        throw new ExecutionTimeoutError('claude-code-cli', request.timeout ?? 120_000);
      }
      if ((error as ExecaError).isCanceled) {
        throw new ExecutionTimeoutError('claude-code-cli', 0, 'Cancelled via AbortSignal');
      }
      throw new ProviderExecutionError('claude-code-cli', error);
    }
  }

  private buildAllowedTools(permissions: PermissionSet): string[] {
    const tools: string[] = [];
    if (permissions.readPaths.length > 0) tools.push('Read');
    if (permissions.writePaths.length > 0) tools.push('Edit', 'Write');
    if (permissions.allowTests) tools.push('Bash(npm test *)', 'Bash(npx vitest *)');
    if (permissions.allowGitWrite) tools.push('Bash(git *)');
    for (const cmd of permissions.allowCommands) tools.push(`Bash(${cmd})`);
    return tools;
  }
}
```

### Proactive Recommender Engine
```typescript
// Pure function: deterministic, sub-ms, no LLM
interface RecommendationRule {
  id: string;
  match: (state: ProjectState, lastResult: SkillResult) => boolean;
  recommend: () => Recommendation;
  priority: number;
}

interface Recommendation {
  skillId: string;
  label: string;
  description: string;
  isRecommended: boolean;
}

const rules: RecommendationRule[] = [
  {
    id: 'after-execute-verify',
    match: (state, result) =>
      result.skillId?.startsWith('workflow.execute') && result.status === 'success',
    recommend: () => ({
      skillId: 'workflow.verify',
      label: 'sunco verify',
      description: '실행 결과를 5겹 필터로 검증합니다',
      isRecommended: true,
    }),
    priority: 10,
  },
  // ... 20-50 rules
];

export function getRecommendations(
  state: ProjectState,
  lastResult: SkillResult,
  limit = 4,
): Recommendation[] {
  return rules
    .filter(r => r.match(state, lastResult))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map(r => r.recommend());
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| eslintrc + plugins | ESLint 10 flat config only | Feb 2026 | eslintrc completely removed. defineConfig() mandatory. |
| cosmiconfig multi-format | TOML-only (smol-toml) | Project decision | Simpler, more predictable. 50 lines replaces a library. |
| Jest for TS projects | Vitest | 2024-2025 | Native TS, faster, better DX. Industry standard for 2026. |
| inquirer.js prompts | Ink 6 React components | 2024 | Component model, Flexbox layout, testability via adapter. |
| child_process.spawn | execa 9 | 2024-2025 | Promise-based, timeout, signal, streaming, error normalization. |
| Raw provider SDKs | Vercel AI SDK 6 | 2025-2026 | Unified API for 20+ providers, structured output, agent abstraction. |
| better-sqlite3 only | better-sqlite3 now, node:sqlite future | node:sqlite at 1.2 RC | Watch node:sqlite stabilization. Migrate when stable (likely Node 26). |

**Deprecated/outdated:**
- **cosmiconfig:** Unnecessary for TOML-only config
- **eslintrc format:** Fully removed in ESLint 10
- **Jest:** Slower, heavier, worse TS DX than Vitest in 2026
- **inquirer.js:** Ink provides component-based alternative
- **blessed/neo-blessed:** Unmaintained since 2017

## Open Questions

1. **tsup bundling of native addons (better-sqlite3)**
   - What we know: tsup bundles JS dependencies but cannot bundle native .node addons. better-sqlite3 must be `external` in tsup config.
   - What's unclear: How does `npx sunco` handle the native addon? Does the user need a C++ compiler if no prebuild exists for their platform?
   - Recommendation: Mark better-sqlite3 as an `optionalDependency` with a fallback path. At install time, prebuild-install fetches the binary. If it fails, provide a clear error message. Consider adding `"optionalDependencies": { "better-sqlite3": "^12.8.0" }` and a JS-based fallback for read-only state operations. Test the npm install flow on a clean machine.

2. **Turborepo + tsup single-bundle publish strategy**
   - What we know: D-03 says npm publish is a single `sunco` bundle. Turborepo builds all packages, tsup bundles `packages/cli` with `noExternal: [/@sunco\/.*/]` to inline workspace deps.
   - What's unclear: Whether `tsup` can correctly bundle Ink (React JSX) + Commander.js + all core modules into a single ESM file without issues.
   - Recommendation: Validate the bundling strategy early in Phase 1 with a minimal hello-world skill. If bundling issues arise, fall back to publishing as a package with dependencies (not a single file).

3. **Skill scanner: build-time vs runtime discovery**
   - What we know: D-11 says scan `packages/skills-*/src/*.skill.ts`. The architecture research suggests static manifest (compiled into binary) over runtime scanning.
   - What's unclear: Whether D-04's "convention-based auto scan" means runtime filesystem scan or build-time code generation.
   - Recommendation: Hybrid approach. At build time (tsup), a prebuild script scans convention paths and generates a manifest file. At runtime, the CLI reads this manifest (fast) rather than scanning the filesystem. This satisfies both D-04's "auto scan" spirit and the <100ms startup requirement.

4. **Claude Code CLI JSON output structure**
   - What we know: `claude -p --output-format json` returns structured JSON with metadata (token usage, costs, result text).
   - What's unclear: The exact JSON schema of the output (field names, nesting). Claude Code CLI is not a stable API.
   - Recommendation: Parse defensively with Zod. Accept unknown extra fields (z.passthrough()). Build an adapter that can be updated independently. Write integration tests against the real CLI output format.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 22.16.0 | None needed (22 is acceptable per CLAUDE.md) |
| npm | Package management | Yes | 10.9.2 | -- |
| git | Version control | Yes | 2.50.1 | -- |
| TypeScript | Type system | No (global) | -- | Dev dependency, installed via npm |
| Turborepo | Monorepo builds | No (global) | -- | Dev dependency, installed via npm (`npx turbo`) |
| Claude Code CLI | Agent provider (AGT-02) | No | -- | Falls back to SDK provider (direct API via AI SDK). D-15 dual-path architecture handles this. |
| C++ compiler | better-sqlite3 compilation | Yes (Xcode CLT) | Apple clang | Needed only if prebuilds unavailable |

**Missing dependencies with no fallback:**
- None -- all external dependencies are either installed or installable via npm.

**Missing dependencies with fallback:**
- Claude Code CLI: Not installed. SDK provider serves as fallback per D-15. Phase 1 integration tests for CLI provider should be skippable in CI.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.workspace.ts` (workspace root) + per-package `vitest.config.ts` -- Wave 0 creation |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx turbo run test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-01 | npm install + bin entry point works | integration | `npx vitest run packages/cli/tests/install.test.ts -x` | Wave 0 |
| CLI-02 | Subcommand routing matches skills | unit | `npx vitest run packages/core/tests/cli/skill-router.test.ts -x` | Wave 0 |
| CLI-03 | --help output includes all active skills | unit | `npx vitest run packages/core/tests/cli/help.test.ts -x` | Wave 0 |
| CLI-04 | Unknown command shows suggestion | unit | `npx vitest run packages/core/tests/cli/unknown-cmd.test.ts -x` | Wave 0 |
| CFG-01 | Three-layer TOML merge | unit | `npx vitest run packages/core/tests/config/loader.test.ts -x` | Wave 0 |
| CFG-02 | Array replace + object deep merge | unit | `npx vitest run packages/core/tests/config/merger.test.ts -x` | Wave 0 |
| CFG-03 | Zod validation with defaults | unit | `npx vitest run packages/core/tests/config/schema.test.ts -x` | Wave 0 |
| CFG-04 | Settings skill reads/writes config | integration | `npx vitest run packages/core/tests/config/settings.test.ts -x` | Wave 0 |
| SKL-01 | defineSkill() validates metadata | unit | `npx vitest run packages/core/tests/skill/define.test.ts -x` | Wave 0 |
| SKL-02 | SkillContext provides all APIs | unit | `npx vitest run packages/core/tests/skill/context.test.ts -x` | Wave 0 |
| SKL-03 | Scanner discovers skills from convention paths | unit | `npx vitest run packages/core/tests/skill/scanner.test.ts -x` | Wave 0 |
| SKL-04 | Deterministic skill cannot access agent | unit | `npx vitest run packages/core/tests/skill/blocked-agent.test.ts -x` | Wave 0 |
| SKL-05 | Prompt skill dispatches through router | integration | `npx vitest run packages/core/tests/skill/prompt-dispatch.test.ts -x` | Wave 0 |
| SKL-06 | ctx.run() chains skills, detects circular | unit | `npx vitest run packages/core/tests/skill/chaining.test.ts -x` | Wave 0 |
| STE-01 | .sun/ directory creation + structure | unit | `npx vitest run packages/core/tests/state/directory.test.ts -x` | Wave 0 |
| STE-02 | SQLite WAL mode + schema creation | unit | `npx vitest run packages/core/tests/state/database.test.ts -x` | Wave 0 |
| STE-03 | Flat file read/write in .sun/ | unit | `npx vitest run packages/core/tests/state/file-store.test.ts -x` | Wave 0 |
| STE-04 | Concurrent write safety | integration | `npx vitest run packages/core/tests/state/concurrency.test.ts -x` | Wave 0 |
| STE-05 | State save/restore API | unit | `npx vitest run packages/core/tests/state/api.test.ts -x` | Wave 0 |
| AGT-01 | AgentProvider interface contract | unit | `npx vitest run packages/core/tests/agent/provider.test.ts -x` | Wave 0 |
| AGT-02 | Claude CLI provider execution | integration | `npx vitest run packages/core/tests/agent/claude-cli.test.ts -x` | Wave 0 (skip if no CLI) |
| AGT-03 | PermissionSet enforcement | unit | `npx vitest run packages/core/tests/agent/permission.test.ts -x` | Wave 0 |
| AGT-04 | Role-based permission presets | unit | `npx vitest run packages/core/tests/agent/role-presets.test.ts -x` | Wave 0 |
| AGT-05 | Cross-validation with multiple providers | unit (mock) | `npx vitest run packages/core/tests/agent/cross-validate.test.ts -x` | Wave 0 |
| AGT-06 | Token/cost tracking persistence | unit | `npx vitest run packages/core/tests/agent/tracker.test.ts -x` | Wave 0 |
| REC-01 | Rule engine: state + result -> recommendations | unit | `npx vitest run packages/core/tests/recommend/engine.test.ts -x` | Wave 0 |
| REC-02 | Recommendations display after skill | integration | `npx vitest run packages/core/tests/recommend/lifecycle.test.ts -x` | Wave 0 |
| REC-03 | State-based routing rules | unit | `npx vitest run packages/core/tests/recommend/rules.test.ts -x` | Wave 0 |
| REC-04 | 20-50 rules, sub-ms response | unit (perf) | `npx vitest run packages/core/tests/recommend/performance.test.ts -x` | Wave 0 |
| UX-01 | Interactive choice with Recommended tag | unit | `npx vitest run packages/core/tests/ui/choice.test.ts -x` | Wave 0 |
| UX-02 | Recommendation display in result pattern | unit | `npx vitest run packages/core/tests/ui/result.test.ts -x` | Wave 0 |
| UX-03 | Progress bar, spinner, error box rendering | unit | `npx vitest run packages/core/tests/ui/feedback.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose` (relevant package)
- **Per wave merge:** `npx turbo run test` (full suite)
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `vitest.workspace.ts` -- workspace-level Vitest config
- [ ] `packages/core/vitest.config.ts` -- core package Vitest config
- [ ] `packages/cli/vitest.config.ts` -- CLI package Vitest config
- [ ] All test files listed above (35 test files)
- [ ] `packages/core/tests/fixtures/` -- shared test fixtures (sample TOML configs, mock skills, mock providers)
- [ ] Framework install: `npm install -D vitest@4.1.2` (root dev dependency)

## Sources

### Primary (HIGH confidence)
- [Commander.js npm](https://www.npmjs.com/package/commander) -- v14.0.3, subcommand API, TypeScript types
- [smol-toml npm](https://www.npmjs.com/package/smol-toml) -- v1.6.1, TOML 1.1.0, parse/stringify
- [Zod npm](https://www.npmjs.com/package/zod) -- v4.3.6, schema validation, prettifyError
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) -- v12.8.0, engine support (Node 20/22/23/24/25)
- [Ink GitHub](https://github.com/vadimdemedes/ink) -- v6.8.0, React 19 peer dependency
- [Vercel AI SDK](https://ai-sdk.dev/) -- v6.0.141, agent abstraction, generateText
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference) -- all flags verified: -p, --output-format json, --allowedTools, --model, --max-turns, --max-budget-usd
- [execa npm](https://www.npmjs.com/package/execa) -- v9.6.1
- [Turborepo docs](https://turborepo.dev/docs/guides/tools/typescript) -- TypeScript monorepo setup
- [Vitest npm](https://www.npmjs.com/package/vitest) -- v4.1.2

### Secondary (MEDIUM confidence)
- [better-sqlite3 Node 24 issues](https://github.com/WiseLibs/better-sqlite3/issues/1384) -- prebuild gaps for Node 24 N-API 137
- [node:sqlite stabilization discussion](https://github.com/nodejs/node/issues/57445) -- currently 1.1 Active Development
- [Turborepo + tsup monorepo starter](https://github.com/zsh77/turborepo-starter-with-tsup/) -- reference setup
- [Vercel AI SDK 6 agents guide](https://www.dplooy.com/blog/vercel-ai-sdk-agents-complete-2026-implementation-guide) -- generateText patterns

### Tertiary (LOW confidence)
- Claude Code CLI JSON output schema: The exact output structure from `--output-format json` is not formally documented as a stable API. Parse defensively with Zod.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified on npm registry with current versions and compatibility
- Architecture: HIGH -- patterns derived from CONTEXT.md locked decisions + project research ARCHITECTURE.md
- Pitfalls: HIGH -- combination of project research PITFALLS.md + verified Node 24/better-sqlite3 issue
- Agent Router: MEDIUM -- Claude Code CLI output schema is not formally stable; Vercel AI SDK patterns verified
- UI layer: HIGH -- Ink 6 + React 19 combination verified, adapter pattern well-defined in CONTEXT.md

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable ecosystem, no fast-moving dependencies)
