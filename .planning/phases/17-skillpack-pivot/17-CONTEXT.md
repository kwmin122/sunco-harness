# Phase 17: Skill Pack Pivot — Claude Code 통합

## 배경

SUNCO v0.1.0은 standalone CLI로 출시했으나, 실제 사용 패턴은
GSD처럼 Claude Code / Codex / Gemini 등에 **스킬팩으로 설치**되어
`/sunco:init`, `/sunco:lint` 형태로 사용하는 것이 맞다.

## 핵심 결정

- **GSD 모델 채택**: `npx popcoru` → `~/.claude/`에 파일 복사 → slash command로 사용
- **Multi-runtime**: Claude Code, Codex, Gemini, Copilot, Cursor, Windsurf, Antigravity 전부 지원
- **기존 엔진 유지**: `dist/` 빌드 결과물을 `~/.claude/sunco/bin/`에 복사
- **44개 스킬 전체 변환**: `.skill.ts` → `.md` 커맨드 파일
- **GSD 기능 전부 커버 + 차별화 기능 추가**

## GSD 대비 차별화 포인트

| 차별화 | 설명 |
|--------|------|
| **Deterministic Harness** | lint, health, guard — LLM 비용 0원으로 코드 품질 강제 |
| **6-Layer Swiss Cheese** | multi-agent → guardrails → BDD → permissions → adversarial → cross-model (Codex) |
| **Blast Radius Analysis** | 코드 의존성 그래프로 변경 영향 범위 사전 분석 |
| **Proactive Recommender** | 50+ 규칙으로 다음 최적 행동 자동 제안 |
| **Headless/CI Mode** | JSON 출력 + exit codes로 CI/CD 파이프라인 통합 |
| **HWPX Document Gen** | 한국 표준 문서 포맷 자체 구현 (zero dep) |
| **Docker Isolation** | 컨테이너 격리 실행으로 안전한 자동화 |
| **HTML Reports** | self-contained 프로젝트 리포트 생성 |
| **Test Generation** | BDD 기준에서 자동 테스트 코드 생성 |
| **Architecture Enforcement** | import 방향, 레이어 위반 실시간 감지 |

## 설치 후 구조

```
~/.claude/
  commands/sunco/           ← .md 커맨드 (Claude Code 자동 스캔)
    help.md                   /sunco:help
    init.md                   /sunco:init
    lint.md                   /sunco:lint
    ...                       (50+ commands)
  sunco/
    bin/                    ← 빌드된 엔진
      cli.js, chunk-*.js
    VERSION
    workflows/              ← 복잡한 워크플로 로직
    templates/              ← 문서 템플릿
    references/             ← 참조 문서
  hooks/
    sunco-check-update.cjs
    sunco-statusline.cjs
    sunco-context-monitor.cjs
    sunco-prompt-guard.cjs
```

## 스킬 분류

### 결정적 스킬 (엔진 호출, LLM 비용 0)
init, lint, health, guard, agents, settings, status, query, graph,
export, headless, validate

### 프롬프트 스킬 (Claude Code가 직접 실행)
new, discuss, plan, execute, verify, review, ship, auto, debug,
diagnose, forensics, doc, scan, research, assume, test-gen,
note, todo, seed, backlog, phase, milestone, release,
quick, fast, do, next, context, pause, resume, progress

### 신규 추가 (GSD 기능 매칭 + 차별화)
workstreams, workspaces, ui-phase, ui-review, manager,
stats, session-report, pr-branch, thread, map-codebase,
profile, audit-uat

## 참고

- GSD 구조: `~/.claude/get-shit-done/` + `~/.claude/commands/gsd/`
- GSD README: 57개 commands, multi-runtime, model profiles
- Superpowers: `/plugin install` 방식 (우리는 GSD 방식 채택)
