---
phase: 02
slug: harness-skills
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-28
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (workspace config via turbo) |
| **Config file** | `packages/skills-harness/vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `npx vitest run --project skills-harness` |
| **Full suite command** | `npx turbo test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project skills-harness`
- **After every plan wave:** Run `npx turbo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | HRN-01 | unit | `vitest run src/init/__tests__/ecosystem-detector.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | HRN-02 | unit | `vitest run src/init/__tests__/layer-detector.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | HRN-03 | unit | `vitest run src/init/__tests__/convention-extractor.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | HRN-04 | integration | `vitest run src/init/__tests__/workspace-initializer.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | HRN-05 | unit | `vitest run src/lint/__tests__/config-generator.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | HRN-06 | integration | `vitest run src/lint/__tests__/runner.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 3 | HRN-07 | unit | `vitest run src/lint/__tests__/formatter.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 3 | HRN-08 | integration | `vitest run src/lint/__tests__/fixer.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 2 | HRN-09 | unit | `vitest run src/health/__tests__/freshness-checker.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 2 | HRN-10 | integration | `vitest run src/health/__tests__/pattern-tracker.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-03 | 05 | 2 | HRN-11 | unit | `vitest run src/health/__tests__/reporter.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-01 | 06 | 2 | HRN-12 | unit | `vitest run src/agents/__tests__/doc-analyzer.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-02 | 06 | 2 | HRN-13 | unit | `vitest run src/agents/__tests__/suggestion-engine.test.ts` | ❌ W0 | ⬜ pending |
| 02-07-01 | 07 | 4 | HRN-14 | unit | `vitest run src/guard/__tests__/promoter.test.ts` | ❌ W0 | ⬜ pending |
| 02-07-02 | 07 | 4 | HRN-15 | integration | `vitest run src/guard/__tests__/incremental-linter.test.ts` | ❌ W0 | ⬜ pending |
| 02-07-03 | 07 | 4 | HRN-16 | integration | `vitest run src/guard/__tests__/watcher.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/skills-harness/vitest.config.ts` — test framework config
- [ ] Add `vitest` to `packages/skills-harness/devDependencies`
- [ ] `packages/skills-harness/src/init/__tests__/` directory structure
- [ ] `packages/skills-harness/src/lint/__tests__/` directory structure
- [ ] `packages/skills-harness/src/health/__tests__/` directory structure
- [ ] `packages/skills-harness/src/agents/__tests__/` directory structure
- [ ] `packages/skills-harness/src/guard/__tests__/` directory structure
- [ ] Shared test fixtures: mock project directory structure for init detection tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `sunco guard --watch` real-time display | HRN-16 | Live terminal animation | Start watch mode, edit a file, observe output |
| `sunco init` full project detection | HRN-01-04 | Requires real project structure | Run on SUN repo itself |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
