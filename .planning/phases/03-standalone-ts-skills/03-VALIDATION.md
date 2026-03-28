---
phase: 03
slug: standalone-ts-skills
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-28
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (workspace config via turbo) |
| **Config file** | `packages/skills-workflow/vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `cd packages/skills-workflow && npx vitest run` |
| **Full suite command** | `npx turbo test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/skills-workflow && npx vitest run`
- **After every plan wave:** Run `npx turbo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SES-01 | unit | `vitest run src/shared/__tests__/roadmap-parser.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SES-03,04 | unit | `vitest run src/shared/__tests__/handoff.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | SES-01,WF-08 | unit | `vitest run src/__tests__/status.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | SES-02,05 | unit | `vitest run src/__tests__/next.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | IDX-01,02 | unit | `vitest run src/__tests__/note.test.ts src/__tests__/todo.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | IDX-03,04 | unit | `vitest run src/__tests__/seed.test.ts src/__tests__/backlog.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | SES-03,04 | unit | `vitest run src/__tests__/pause.test.ts src/__tests__/resume.test.ts` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 2 | PHZ-01,02,03 | unit | `vitest run src/shared/__tests__/roadmap-writer.test.ts` | ❌ W0 | ⬜ pending |
| 03-06-01 | 06 | 3 | SET-01 | unit | `vitest run src/__tests__/settings-writer.test.ts` | ❌ W0 | ⬜ pending |
| 03-06-02 | 06 | 3 | All | integration | `npx turbo build && npx turbo test` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `packages/skills-workflow/vitest.config.ts` — test framework config
- [ ] `packages/skills-workflow/tsconfig.json` — TypeScript config
- [ ] `packages/skills-workflow/tsup.config.ts` — build config
- [ ] `packages/skills-workflow/package.json` — dependencies (simple-git, vitest)
- [ ] Test directory structure: `src/shared/__tests__/`, `src/__tests__/`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `sunco settings` Ink tree-view rendering | SET-01 | Visual Ink rendering | Run settings, navigate with arrow keys |
| `sunco status` visual progress indicators | SES-01 | Terminal color/format | Run status, verify visual output |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
