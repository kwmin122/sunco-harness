# SUNCO / SUNCO Harness - NotebookLM Source Text

이 문서는 Google NotebookLM에 업로드하기 위한 SUNCO 설명용 단일 소스 텍스트다. 기준은 현재 로컬 저장소 `/Users/min-kyungwook/SUN`의 README, product contract, roadmap, `packages/core`, `packages/skills-harness`, `packages/skills-workflow`, `packages/cli` 구현이다.

## 1. 한 줄 정의

SUNCO는 AI 코딩 에이전트를 위한 "Agent Workspace OS"다. Claude Code, Codex CLI, Cursor 같은 AI 개발 런타임에 명령, 워크플로우, 훅, 에이전트 프롬프트, 품질 게이트를 설치해서 에이전트가 코드를 더 안전하고 일관되게 작성하도록 만드는 harness engineering 도구다.

SUNCO의 핵심 관점은 "AI가 코드를 쓰는 시대에는 사람이 직접 모든 코드를 쓰는 것보다, AI가 실수하지 않도록 작업장을 설계하는 일이 더 중요하다"는 것이다. 이 작업장이 SUNCO다.

## 2. 제품 정체성

SUNCO의 공개 패키지 이름은 `popcoru`다. 설치 명령은 `npx popcoru`이며, package contract상 `npx sunco`도 bin alias로 지원한다. 설치 후 Claude Code에서는 `/sunco:*` 슬래시 명령으로 사용하고, Codex/Cursor에서는 SKILL.md 기반 skill adapter로 사용한다.

제품 설명에서 반복되는 핵심 키워드는 다음과 같다.

- Agent Workspace OS
- harness engineering for AI coding agents
- deterministic first, zero LLM cost where possible
- skill-only architecture
- 7-layer Swiss Cheese verification
- 6-stage review pipeline
- proactive recommender
- context intelligence and smart routing
- crash recovery and infinite execution

## 3. 무엇을 설치하는가

`npx popcoru`는 사용자의 AI 런타임 설정 디렉터리에 SUNCO assets를 복사한다.

Claude Code의 경우 대략 다음 구조가 설치된다.

```text
~/.claude/
  commands/sunco/        # /sunco:* slash command markdown files
  sunco/
    bin/                 # cli.js, sunco-tools.cjs, package.json 등 runtime engine
    agents/              # specialized agent prompt files
    workflows/           # workflow markdown files
    references/          # product contract, verification, config references
    templates/           # output artifact templates
    VERSION              # installed version
  hooks/                 # hook scripts
```

Codex CLI는 `~/.codex/skills/sunco-*/SKILL.md` 형태로, Cursor는 `~/.cursor/skills-cursor/sunco-*/SKILL.md` 형태로 같은 개념의 기능을 제공한다. Antigravity는 asset 설치는 지원하지만 런타임 등록은 partial support로 문서화되어 있다.

현재 저장소 파일 수 기준으로 `packages/cli/commands/sunco`에는 81개 명령 파일이 있고, `packages/cli/workflows`에는 77개 workflow 파일이 있으며, `packages/cli/agents`에는 23개 agent markdown 파일이 있다. README와 product contract 일부에는 과거 기준인 "18 specialized agents"가 남아 있으므로, agent 개수는 문서 간 차이가 있다.

## 4. 저장소 구조

SUNCO는 npm workspace monorepo다.

```text
packages/core             # skill runtime kernel: config, state, skill registry, CLI lifecycle, agent router, UI, recommender
packages/skills-harness   # deterministic harness skills: init, lint, health, agents, guard
packages/skills-workflow  # workflow skills: new, scan, discuss, plan, execute, verify, ship, auto, debug, etc.
packages/skills-extension # extension package placeholder
packages/cli              # popcoru/sunco CLI package, installer assets, slash commands, workflows, hooks
```

루트 `package.json`은 Node.js 22 이상, npm 10.9.2, TypeScript 6.0.2, Turborepo 2.5.4를 사용한다. 루트 명령은 `npm run build`, `npm test`, `npm run lint`, `npm run clean`이다.

## 5. Core runtime

`@sunco/core`는 SUNCO의 커널이다. 핵심 책임은 다음과 같다.

- `defineSkill()`로 모든 skill 정의를 Zod schema로 검증하고 freeze한다.
- skill metadata는 `id`, `command`, `description`, `kind`, `stage`, `category`, `routing`, `complexity`, `options`, `execute`를 가진다.
- skill kind는 `deterministic`, `prompt`, `hybrid` 중 하나다.
- deterministic skill은 원칙적으로 agent access가 막힌다.
- prompt skill은 agent provider가 필요하다.
- routing은 `routable` 또는 `directExec`로 나뉜다.
- complexity는 `simple`, `standard`, `complex`로 모델 라우팅 힌트를 제공한다.

CLI lifecycle은 다음 순서로 부팅된다.

1. TOML config를 로드한다.
2. `.sun/` 디렉터리를 보장한다.
3. state engine을 초기화한다.
4. preloaded skill을 registry에 등록한다.
5. 개발 모드에서는 `*.skill.ts` 파일도 scan한다.
6. active skill policy를 적용한다.
7. Claude CLI / Claude SDK provider를 감지해 agent router를 만든다.
8. UI adapter와 skill UI를 만든다.
9. recommender engine을 로드한다.

각 skill 실행 시에는 SkillContext가 주입된다. SkillContext에는 config, state, fileStore, agentRouter, recommender, UI, logger, cwd, args, abort signal, 다른 skill 호출용 `ctx.run()`이 들어간다.

## 6. State와 config

Product contract 기준 상태/설정 경로는 다음과 같다.

```text
.planning/STATE.md       # project state
.planning/config.json    # project planning config
.sun/config.toml         # project harness config
~/.sun/config.toml       # global config
~/.sun/                  # global state
```

금지 경로도 명시되어 있다. `.sun/STATE.md`는 쓰지 않고 `.planning/STATE.md`를 써야 한다. `~/.sunco/`가 아니라 `~/.sun/`를 써야 한다. npm global path에 runtime을 설치하는 방식이 아니라 `$HOME/.<runtime>/sunco/`를 사용한다.

## 7. SUNCO Harness란 무엇인가

좁은 의미의 SUNCO harness는 `packages/skills-harness` 패키지다. 목적은 AI나 LLM 호출 없이 deterministic하게 프로젝트를 분석하고 품질 경계를 강제하는 것이다. README 표현으로는 "zero LLM cost backbone"이다.

Harness에는 5개 stable deterministic skill이 있다.

```text
harness.init
harness.lint
harness.health
harness.agents
harness.guard
```

이 5개는 에이전트가 코드를 쓰기 전에 프로젝트 구조, 아키텍처 경계, 문서 신선도, agent instruction 품질, 반복 anti-pattern을 파악하고 강제하는 기반이다.

## 8. Harness 기능 1: init

`sunco init`은 프로젝트를 분석해 `.sun/` workspace를 초기화한다. 수행 내용은 다음과 같다.

- ecosystem detector: Node.js, TypeScript, Deno, Bun, Rust, Go, Python, Java/Kotlin, Ruby, PHP, Swift, Dart, .NET 등을 marker file로 감지한다.
- layer detector: `types`, `config`, `utils`, `domain`, `handler`, `ui`, `infra` 같은 architectural layer를 감지한다.
- convention extractor: naming convention, import style, export style, test organization을 추출한다.
- workspace initializer: `.sun/` 설정과 rules scaffold를 만든다.
- init result를 state에 저장해 lint/guard/health가 재사용한다.

핵심 의도는 "프로젝트 구조를 먼저 deterministic하게 파악하고, 이후 품질 게이트의 기준선을 만든다"는 것이다.

## 9. Harness 기능 2: lint

`sunco lint`는 아키텍처 boundary linter다. init에서 감지한 layer 정보를 기반으로 `eslint-plugin-boundaries` 설정을 생성하고, dependency direction 위반을 검사한다.

지원 옵션은 다음과 같다.

```text
sunco lint
sunco lint --fix
sunco lint --json
sunco lint --files <glob>
```

특징:

- LLM을 사용하지 않는다.
- `.sun/rules/`에 있는 rule을 로드한다.
- source root 기준으로 `src/**/*.{ts,tsx,js,jsx}`를 검사한다.
- violation을 agent-readable 구조로 만든다.
- 사람이 이해할 수 있는 fix instruction도 제공한다.
- `--json` 출력은 agent consumption에 적합하다.
- 결과는 `lint.lastResult` state에 저장되어 recommender가 다음 단계 제안에 사용할 수 있다.

핵심 철학은 코드 주석에 적힌 "Linter teaches while blocking"이다. 즉, lint는 막기만 하는 게 아니라 무엇을 왜 고쳐야 하는지 설명한다.

## 10. Harness 기능 3: health

`sunco health`는 코드베이스 health score를 계산한다. 점수는 0-100이다.

검사 영역:

- documentation freshness: 문서가 코드보다 오래되었는지, broken reference가 있는지 확인한다.
- anti-pattern tracking: `any`, `console.log`, TODO류 패턴의 발생 수와 추세를 추적한다.
- convention scoring: init에서 추출된 convention과 실제 파일들의 일치 정도를 평가한다.
- trend: 이전 snapshot과 비교해 improving, degrading, stable, first-run을 판단한다.

지원 옵션:

```text
sunco health
sunco health --json
sunco health --no-snapshot
sunco health --deep
```

`--deep`은 deterministic health 위에 agent-based entropy detection을 추가한다. README, CLAUDE.md, 최근 git log, source file list, existing health report를 프롬프트로 묶어 doc-code mismatch, dead import, stale TODO, convention drift, dead code를 찾도록 한다. 다만 health skill 자체는 deterministic skill이므로 agent provider가 없으면 graceful하게 skip한다.

## 11. Harness 기능 4: agents

`sunco agents`는 agent instruction file 분석기다. 후보 파일은 `CLAUDE.md`, `agents.md`, `AGENTS.md`, `.claude/agents.md`, `.cursorrules`, `.cursor/rules`, `.claude/rules/*.md`, 그리고 packages/apps/services/src 아래의 nested `CLAUDE.md`다.

분석 항목:

- line count
- section count
- instruction density
- contradiction count
- efficiency score 0-100
- line-numbered suggestions

중요한 제약:

- read-only 분석이다.
- agent docs를 자동 수정하지 않는다.
- vague suggestion이 아니라 line range 기반 suggestion을 낸다.
- root CLAUDE.md는 memory strategy contract상 60라인 이하를 목표로 한다.

목적은 agent가 읽는 instructions 자체를 품질 관리 대상으로 다루는 것이다.

## 12. Harness 기능 5: guard

`sunco guard`는 실시간 feedback loop다. lint, anti-pattern detection, tribal knowledge warning, rule promotion suggestion, file watcher를 결합한다.

지원 모드:

```text
sunco guard
sunco guard --watch
sunco guard --json
sunco guard --draft-claude-rules
```

single-run scan은 프로젝트를 분석해 lint violation, regex anti-pattern, tribal warning, promotion suggestion을 출력한다. watch mode는 chokidar로 `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.jsx` 변경을 감지하고 변경 파일 단위로 analyzeFile을 실행한다.

promotion suggestion은 반복 anti-pattern을 permanent lint rule로 승격할 후보를 제안한다. 원칙은 suggest-only다. 다만 `--draft-claude-rules`를 명시하면 promotion candidate를 `.claude/rules/*.md` 초안으로 생성한다.

tribal knowledge는 `.sun/tribal/` 패턴을 읽어 soft warning으로 출력하는 구조다.

## 13. Workflow skill 계층

`packages/skills-workflow`는 deterministic harness 위에 agent-powered workflow를 얹는다. 현재 코드상 주요 workflow skill은 다음과 같다.

- `workflow.new`: 아이디어에서 새 프로젝트 요구사항과 로드맵 생성
- `workflow.scan`: 기존 코드베이스 7개 분석 문서 생성
- `workflow.discuss`: phase decision과 gray area를 CONTEXT.md로 정리
- `workflow.assume`: agent가 실행 전에 무엇을 할지 preview
- `workflow.research`: phase research 수행 및 RESEARCH.md 생성
- `workflow.plan`: BDD acceptance criteria 기반 PLAN.md 생성, plan-checker revision loop 포함
- `workflow.ultraplan`: Claude Code `/ultraplan` 브라우저 리뷰용 prompt export/import
- `workflow.execute`: PLAN.md를 wave/worktree 기반으로 실행
- `workflow.review`: multi-provider cross-review
- `workflow.verify`: Swiss cheese verification
- `workflow.validate`: coverage audit
- `workflow.test-gen`: test generation
- `workflow.ship`: verification 후 PR/ship
- `workflow.release`: version bump, changelog, publish
- `workflow.milestone`: milestone lifecycle 관리
- `workflow.auto`: discuss → plan → execute → verify chain 자동화
- `workflow.quick`, `workflow.fast`, `workflow.do`: lightweight / immediate / natural language routing
- `workflow.debug`, `workflow.diagnose`, `workflow.forensics`: failure diagnosis and forensics
- `workflow.status`, `workflow.progress`, `workflow.next`, `workflow.context`: project orientation
- `workflow.note`, `workflow.todo`, `workflow.seed`, `workflow.backlog`: idea/task capture
- `workflow.pause`, `workflow.resume`: session handoff and recovery
- `workflow.phase`, `workflow.settings`: phase/config management
- `workflow.query`, `workflow.export`, `workflow.graph`, `workflow.doc`: CI/query/report/graph/doc utilities

## 14. Lifecycle flow

SUNCO의 기본 제품 흐름은 다음과 같다.

```text
sunco new
  -> questions
  -> research
  -> PROJECT.md / REQUIREMENTS.md / ROADMAP.md

sunco discuss <phase>
  -> gray areas and decisions
  -> CONTEXT.md

sunco plan <phase>
  -> PLAN.md with BDD acceptance criteria
  -> plan checker validation loop

sunco execute <phase>
  -> wave-based execution
  -> isolated worktrees
  -> lint gate
  -> SUMMARY.md

sunco verify <phase>
  -> Swiss Cheese verification

sunco ship <phase>
  -> PR with evidence
```

`sunco auto`는 이 체인을 가능한 범위까지 자동으로 진행하고, blocker나 사람 판단이 필요한 gray area에서 멈춘다.

## 15. Verification model

Product contract는 "7-Layer Swiss Cheese Verification"을 source of truth로 둔다.

7개 layer:

1. Multi-Agent Generation: 독립 검증을 여러 agent가 수행한다.
2. Deterministic Guardrails: lint, type check, build 등 zero LLM cost 검증.
3. BDD Acceptance Criteria: PLAN.md acceptance criteria 기반 behavioral check.
4. Permission Scoping: agent가 선언된 permission scope 안에서 동작했는지 확인.
5. Adversarial Verification: red-team agent가 implementation을 공격적으로 검토.
6. Cross-Model Verification: 다른 model/provider가 blind spot을 검토.
7. Human Eval Gate: 사람이 최종 sign-off한다.

README의 과거 섹션에는 5-layer라는 표현도 남아 있지만 product contract는 7-layer를 단일 진실로 선언한다.

## 16. Review pipeline

Product contract의 review pipeline은 6-stage다.

```text
idea -> discuss -> plan -> execute -> verify -> ship
```

각 단계는 품질 gate와 artifact를 가진다.

- idea/new: PROJECT.md, REQUIREMENTS.md, ROADMAP.md
- discuss: CONTEXT.md
- plan: PLAN.md
- execute: code changes, SUMMARY.md
- verify: VERIFICATION.md / structured verification result
- ship: PR body and evidence

## 17. Recommender

`@sunco/core`의 recommender는 deterministic rule engine이다. 마지막 skill 실행 결과와 project state를 보고 다음 action을 제안한다.

예시:

- init 성공 후 lint high, health medium 추천
- lint 성공 후 health high, guard medium 추천
- lint 실패 후 debug high, lint 재실행 medium 추천
- discuss 성공 후 plan high, research medium 추천
- research 성공 후 plan high, discuss medium 추천
- plan 성공 후 execute high, review medium, ultraplan low 추천
- execute 성공 후 verify high, ship low 추천
- verify 성공 후 ship high 추천
- verify 실패 후 debug high, execute medium 추천

이 구조 덕분에 사용자는 `/sunco:next` 또는 추천 UI를 통해 workflow의 다음 단계를 잃지 않는다.

## 18. Hooks

Product contract의 hook contract는 다음과 같다.

- `sunco-check-update.cjs`: SessionStart에서 version update check
- `sunco-statusline.cjs`: StatusLine에서 terminal status 표시
- `sunco-context-monitor.cjs`: PostToolUse에서 context window usage warning
- `sunco-prompt-guard.cjs`: PreToolUse에서 Write/Edit prompt injection detection
- `sunco-mode-router.cjs`: UserPromptSubmit에서 SUNCO Mode auto-routing interceptor

현재 파일 시스템에는 추가로 `sunco-mode-banner.cjs`도 존재한다. 이 파일은 product contract hook table에는 아직 포함되어 있지 않으므로 문서/contract 업데이트 대상일 수 있다.

## 19. SUNCO Mode

`/sunco:mode`는 auto-routing mode다. Claude Code에서는 `UserPromptSubmit` hook을 통해 non-slash 자연어 입력을 intercept하고 `/sunco:do`로 라우팅한다. Codex/Cursor에서는 SKILL.md instruction과 keyword matcher 기반으로 비슷한 routing을 구현한다.

Phase 24c에는 cross-runtime natural language routing 보강이 들어갔다.

- built-in routing rules: bug/error -> debug, ship/deploy -> ship, test/verify -> verify, review -> review, plan/design -> plan, status/progress -> status, lint/architecture -> lint, health/score -> health
- `CLAUDE.md`의 `## Skill routing` 섹션을 parse해 custom routing rule을 prepend한다.
- keyword matcher는 사용자 입력에서 proactive skill suggestion을 만든다.

## 20. Context intelligence와 infinite execution

README의 v0.6 Light Harness 설명과 roadmap Phase 17-21은 context window를 운영 대상으로 본다.

주요 개념:

- Green / Yellow / Orange / Red 4-tier context zone
- Orange zone에서 auto-pause / handoff 생성
- 완료된 phase artifact는 Orange에서 summary 로딩, Red에서 skip
- status line에 context zone과 usage 표시
- `.sun/sessions/`에 session 기록
- context rotation과 adaptive timeout으로 긴 실행을 이어감
- skill×model success tracking으로 smart routing 개선
- harness loading이 전체 context의 5% 이하가 되도록 관리

## 21. Operational resilience

SUNCO는 agent workflow가 실패하거나 멈출 수 있음을 전제로 설계되어 있다.

관련 기능:

- crash recovery: auto mode가 중단되면 checkpoint에서 재개
- stuck detection: 같은 skill 실패 반복 등 무한 루프 감지
- budget guard: budget threshold에 따라 warning/stop/downgrade
- adaptive timeout: skill complexity에 따라 timeout 조정
- session recorder: skill invocation, duration, model tier, outcome 기록

## 22. Debug Iron Law Engine

최근 Phase 23a 구현은 debugging discipline을 강화한다. 핵심 문구는 "No fixes without confirmed root cause"다.

구현 요소:

- bug pattern classification: failure type을 분류한다.
- error sanitizer: error output에서 민감정보를 제거한다.
- debug learnings: 이전 debug session의 symptom/root cause/fix를 저장하고 검색한다.
- IronLawState: root cause confirmed 여부, hypothesis list, editBlocked 여부를 보관한다.
- Iron Law Gate: PreToolUse hook으로 Edit/Write tool을 막고, root cause가 확인되기 전에는 수정을 차단한다.
- `sunco debug --quick`은 빠른 진단을 위해 Iron Law 경로를 skip한다.

이 기능은 agent가 "일단 수정해보기"를 하지 못하게 하고, 근본 원인 확인 전에는 편집을 막는 안전장치다.

## 23. Review Army

Phase 23b Review Army는 specialist review를 확장한다. specialist id는 다음 8개다.

- security
- performance
- architecture
- correctness
- testing
- api-design
- migration
- maintainability

adaptive specialist gate는 specialist별 historical hit rate를 보고, 일정 횟수 이상 zero finding이 반복되면 일부 specialist를 gate해서 token을 절약한다. 다만 core specialist인 security와 correctness는 gated 대상에서 제외된다.

관련 prompt builder로 testing, API, migration, maintainability 검증 프롬프트가 추가되었다.

## 24. Learnings + Timeline

Phase 24a는 cross-session intelligence를 확장한다.

Universal learnings:

- 저장 위치: `.sun/learnings.jsonl`
- type: pitfall, pattern, preference, architecture, tool, operational
- source: observed, user-stated, inferred, cross-model
- confidence 1-10
- observed/inferred learning은 30일마다 confidence가 decay된다.
- key+type 기준으로 deduplicate한다.

Skill timeline:

- 저장 위치: `.sun/timeline.jsonl`
- skill start/completion event, branch, outcome, duration, session, timestamp를 기록한다.
- 최근 skill sequence에서 반복 패턴을 찾아 다음 skill을 예측한다.
- 기본 workflow chain discuss -> plan -> execute -> verify -> ship도 예측한다.

Context recovery:

- branch 기준 last session과 recent timeline을 읽는다.
- confidence가 높은 learning을 가져온다.
- context compaction 이후 "welcome back briefing"을 만든다.

## 25. Smart Review

Phase 24b는 review가 단순 diff check가 아니라 intent와 plan 대비 결과를 보는 방향으로 확장한다.

Scope drift detector:

- commit messages, plan content, PR description에서 intent keyword를 추출한다.
- changed files가 stated intent와 얼마나 관련 있는지 본다.
- out-of-scope file 비율이 높으면 `DRIFT_DETECTED`를 반환한다.
- requirement가 intent/diff에서 빠졌으면 `REQUIREMENTS_MISSING`를 반환한다.

Plan completion auditor:

- PLAN.md에서 checkbox, numbered step, bold imperative를 task로 추출한다.
- task에 포함된 file path와 changed files를 비교한다.
- 각 task를 DONE, PARTIAL, NOT_DONE, CHANGED로 분류한다.
- completion percent와 summary를 만든다.

## 26. Ultraplan integration

Phase 22는 Claude Code의 `/ultraplan` 브라우저 기반 plan review와 SUNCO plan pipeline을 연결한다.

기본 모드:

```text
sunco ultraplan --phase 5
```

기존 PLAN.md 파일을 읽어 `NN-ULTRAPLAN-PROMPT.md`를 phase directory에 생성한다. 이것은 브라우저에서 inline comment나 richer review를 하기 위한 prompt다.

Draft 모드:

```text
sunco ultraplan --phase 5 --draft
```

기존 PLAN.md 없이 CONTEXT/RESEARCH/REQUIREMENTS/ROADMAP 기반으로 새 plan draft prompt를 만든다.

Import 모드:

```text
sunco ultraplan --phase 5 --import --file result.md
```

Ultraplan 결과를 SUNCO PLAN.md 파일로 가져온다. 안전상 unstructured markdown, 예를 들어 "looks good" 요약은 reject한다. `PLAN_SEPARATOR` 또는 frontmatter+XML 구조를 가진 출력만 받아들인다.

## 27. CLI headless mode

`sunco headless <command>`는 CI/CD용 실행 모드다. Silent UI adapter를 사용하고 JSON stdout을 낸다. exit code는 다음 의미를 가진다.

- 0: success
- 1: error
- 2: blocked

예시:

```text
sunco headless query
sunco headless verify --phase 3 --timeout 600000
```

## 28. Safety and gates

Product contract에는 4개 gate가 정의되어 있다.

- plan-gate: plan 진행 전 product contract compliance 확인
- artifact-gate: implementation 후 release artifact validation
- proceed-gate: verify 후 ship/release 전 최종 go/no-go
- dogfood-gate: SUNCO가 자기 원칙을 자기 repo에도 적용하는지 확인

또한 `careful`, `freeze`, `unfreeze` 같은 safety command가 CLI assets에 존재한다. destructive command warning, edit directory boundary 같은 보호 기능을 제공한다.

## 29. 문서상 주의할 점

현재 저장소는 빠르게 변경 중이라 README, roadmap, product contract 간 일부 숫자가 다르다.

확인된 차이:

- README 상단은 81 commands라고 말한다.
- `packages/cli/commands/sunco` 실제 파일 수는 81이다.
- `packages/cli/workflows` 실제 파일 수는 77이다.
- README 하단의 older section에는 18 specialized agents라고 되어 있지만 현재 `packages/cli/agents` 파일 수는 23이다.
- product contract는 hook 5개를 표준으로 적고 있지만 현재 hook 파일은 6개이며 `sunco-mode-banner.cjs`가 추가로 있다.
- roadmap은 Phase 23/24가 상단 phase list에는 완료로 들어가 있지만 상세 section/progress table은 일부 오래된 상태일 수 있다.
- product contract는 7-layer verification을 source of truth로 선언한다. 따라서 README나 older docs의 5-layer 표현보다 product contract를 우선해야 한다.

NotebookLM에서 답변할 때는 product contract와 실제 파일 수를 우선하고, README는 제품 설명/마케팅 문맥으로 해석하는 것이 안전하다.

## 30. 왜 중요한가

SUNCO의 핵심 가치는 "AI agent가 바로 코드를 고치게 만드는 것"이 아니라 "AI agent가 올바른 순서로 판단하고, deterministic gate를 통과하고, 컨텍스트와 비용을 관리하고, 검증 증거를 남기게 만드는 것"이다.

일반적인 AI coding workflow는 다음 문제가 있다.

- 요구사항이 흐려진다.
- 에이전트가 구현 전에 계획을 충분히 검증하지 않는다.
- 테스트/빌드/리뷰를 사후에 대충 한다.
- 긴 작업에서 context가 소실된다.
- agent instruction 자체가 비대해지거나 모순된다.
- 실패 시 root cause 없이 패치부터 한다.
- ship 전에 검증 증거가 부족하다.

SUNCO는 이 문제를 skill system, deterministic harness, workflow chain, recommender, verification model, hooks, context recovery, learnings/timeline으로 해결하려는 도구다.

## 31. NotebookLM에 물어볼 만한 질문

- SUNCO와 일반 Claude Code slash command bundle의 차이는 무엇인가?
- deterministic harness와 agent-powered workflow는 어떻게 분리되어 있는가?
- `sunco init`, `sunco lint`, `sunco health`, `sunco agents`, `sunco guard`는 각각 어떤 역할인가?
- SUNCO의 7-layer Swiss Cheese verification은 어떤 layer로 구성되는가?
- SUNCO Mode는 Claude Code와 Codex/Cursor에서 어떻게 다르게 동작하는가?
- Phase 23a Iron Law Engine은 debugging workflow를 어떻게 바꾸는가?
- Review Army의 8 specialist는 무엇이고 adaptive gating은 왜 필요한가?
- Universal learnings와 skill timeline은 context recovery에 어떻게 쓰이는가?
- Product contract와 README가 충돌할 때 어떤 문서를 우선해야 하는가?
- SUNCO를 팀에 도입한다면 가장 먼저 어떤 command를 실행해야 하는가?

