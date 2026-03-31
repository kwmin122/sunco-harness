# SUNCO Handoff — 2026-03-31

## 현재 상태

**프로젝트**: SUNCO — 에이전트 워크스페이스 OS
**v0.2.0**: npm published as `popcoru` (Claude Code 스킬팩)
**브랜치**: main
**GitHub**: https://github.com/kwmin122/sunco-harness
**npm**: https://www.npmjs.com/package/popcoru

## 완료된 것

| Phase | 내용 | 상태 |
|-------|------|------|
| 1-10 | Core → Harness → Skills → Init → Context → Execute → Verify → Ship → Compose → Debug | 완료 |
| 11 | Planning Quality | 완료 |
| 12 | Operational Resilience | 완료 |
| 13 | Headless + CI/CD + HTML Report | 완료 |
| 14 | Context Optimization (output, acceptance, GC, CodeGraph, adaptive replan, Docker) | 완료 |
| 15 | Document Generation (HWPX + doc skill) | 완료 |
| 16 | Publish Ready (package, README, CI, E2E) | 완료 |
| 17 | **Skill Pack Pivot** (installer, 57 commands, workflows, references, templates) | **완료** |

## v0.2.0 배포 (2026-03-31)

- npm publish: popcoru@0.2.0
- 57 slash commands (.md)
- 23 engine files (deterministic skills)
- 4 hooks (check-update, statusline, context-monitor, prompt-guard)
- 9 workflows + 6 references + 7 templates
- 6-layer Swiss cheese verification (Layer 6: Codex cross-model)
- Responsive ASCII art logo
- Install/uninstall cycle tested

## Phase 17 커밋 이력

| 커밋 | 내용 |
|------|------|
| `fd48fba` | Wave 1: installer + hooks + 50 commands |
| `ffc894f` | Wave 2: 7 new commands + workflows/references/templates |
| `f7c189e` | Wave 3: installer fix + integration test |
| `7afc265` | Minor validation fixes |

## 프로젝트 구조

```
packages/
  core/           — CLI 엔진, config, state, skill system
  skills-harness/ — 결정적 스킬 (lint, guard, health)
  skills-workflow/ — 워크플로 스킬 (plan, execute, verify)
  cli/            — 스킬팩 인스톨러 + 커맨드 + 훅
    bin/install.cjs          ← npm entry point
    commands/sunco/*.md      ← 57 커맨드
    hooks/*.cjs              ← 4 훅
    workflows/*.md           ← 9 워크플로
    references/*.md          ← 6 참조 문서
    templates/*.md           ← 7 아티팩트 템플릿
    dist/                    ← 빌드된 엔진
```

## 빌드/테스트 명령어

```bash
npx turbo build              # 빌드
npx vitest run               # 883 tests
node packages/cli/bin/install.cjs --help  # 인스톨러 테스트
```

## 다음 제품: SUNCO HQ

별도 레포지토리에서 진행 예정.
AI 에이전트를 회사처럼 조직 운영하는 컨트롤 플레인.
SUNCO 스킬팩(popcoru)을 각 에이전트에 주입.
Stack: Node.js + PostgreSQL + React + Swift/AppKit.
