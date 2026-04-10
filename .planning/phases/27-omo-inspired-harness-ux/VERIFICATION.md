# Phase 27 (+ Phase 28 on `main`) — 7-Layer Swiss Cheese Verification

**Verified**: 2026-04-11  
**Branch / HEAD**: `main` @ `5622f9628d6f6acc2ebe8d2f7a1e2a894f6e95a6`  
**Verdict**: **WARN**

---

## Executive summary

| Area | Result |
|------|--------|
| `packages/core` + `packages/skills-workflow` build (`npm run build`) | **PASS** (see Build notes) |
| Targeted Vitest suites (Phase 27/28) | **PASS** — 67 tests, 0 failures |
| Forbidden imports (`@anthropic-ai/sdk`) | **PASS** — none under `packages/` |
| OMO “zoo” names (Sisyphus, Hephaestus, Prometheus, Oracle, Librarian, …) | **PASS** — no matches under `packages/` |
| Constraint: new `/sunco:*` commands | **PASS** — 81 command stubs; `git diff 1dadef4..HEAD` shows **no** newly added `packages/cli/commands/sunco/*.md` |
| Constraint: new `*.skill.ts` in workflow | **PASS** — same range: **no** new `packages/skills-workflow/src/*.skill.ts` (edits only) |
| ESM-relative imports (`.js` suffix) | **PASS** — spot-check + repo convention; no audit of every line |
| Product contract **full** 7 layers | **PARTIAL** — only deterministic + BDD-style evidence run here; see §7-Layer table |

**WARN** rationale: Implementation and automated tests align with Phase 27/28 goals, but the **full** 7-layer model from `packages/cli/references/product-contract.md` is not completely satisfied by this run (multi-agent, permission proof, adversarial, cross-model, human gate not executed). Phase 28 advisor **runtime** smoke was **LIMITED** in `.planning/phases/28-claude-code-advisor-harness/EVIDENCE.md` (quota), though unit tests for `AdvisorRunner` pass.

---

## Build

| Package | Command | Status | Notes |
|---------|-----------|--------|--------|
| `@sunco/core` | `npm run build` | **PASS** | `tsup` ESM + DTS OK |
| `@sunco/skills-workflow` | `npm run build` | **PASS** | Requires `@sunco/core` `dist/` present first (workspace `turbo build` orders deps). **Cold** `skills-workflow` build alone after `clean` can fail DTS until `core` is built — use `npm run build` at repo root or build `core` first. |
| Monorepo | `npm run build` (turbo) | **PASS** | All 5 packages in scope succeeded |

- **Errors**: 0 on successful runs.

---

## Tests

| Location | Files | Status | Count |
|----------|--------|--------|-------|
| `packages/core` | `src/state/__tests__/active-work.test.ts`, `src/agent/__tests__/advisor.test.ts` | **PASS** | 17 (10 + 7) |
| `packages/skills-workflow` | `src/__tests__/do-classifier.test.ts`, `do-delegation.test.ts`, `lifecycle-hooks.test.ts`, `active-work-rendering.test.ts` | **PASS** | 50 (19+6+18+7) |
| **Total** | | | **67** |

---

## Acceptance criteria (goal-backward)

### Phase 27 Plan A (from `27-01-PLAN.md` + CONTEXT)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `.sun/active-work.json` API + Zod | ✅ | `active-work.test.ts` (10 cases): read default, atomic write, merge, truncation, append helpers, corrupt JSON degrade, invalid category |
| PostSkill hook + `registerActiveWorkHook` / `createDefaultHookRunner` | ✅ | `lifecycle-hooks.test.ts` (18 tests) including hook id `sunco.active-work.update`, write to artifact, throw swallow |
| Skill dispatch invokes PostSkill | ✅ | Indirect: hooks tests + integration path; `skill-router` grep verified in plan |
| `status` / `next` surface active-work (sections, D-14, footer) | ✅ | `active-work-rendering.test.ts` (7 cases) |

### Phase 27 Plan B (stated in user request)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Deterministic classifier + delegation | ✅ | `do-classifier.test.ts`, `do-delegation.test.ts` |

### Consolidation (user request)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `quick --speed`, debug flags, status `--brief`, verify `--coverage`, note flags | ✅ | Exercised indirectly by build + suite; no dedicated single test file in this list — **WARN** if strict proof per flag is required |

### Phase 28 (user request)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `AdvisorRunner`, `advisor-prompt.ts`, plan.skill integration, default off | ✅ | `advisor.test.ts`; sources: `packages/core/src/agent/advisor.ts`, `packages/skills-workflow/src/shared/advisor-prompt.ts`, `plan.skill.ts`; `.claude/agents/sunco-advisor.md` exists |
| Advisor transport in production | ⚠️ | `EVIDENCE.md`: subagent invocation did not return model text (usage limit) — **not** a code failure |

---

## 7-Layer Swiss Cheese (product contract)

Reference: `packages/cli/references/product-contract.md` — Verification Model.

| Layer | Name | This run | Notes |
|-------|------|----------|-------|
| 1 | Multi-Agent Generation | **Not run** | No parallel verifier agents spawned |
| 2 | Deterministic Guardrails | **PASS** | `npm run build` (core + skills-workflow + turbo), targeted `vitest` |
| 3 | BDD Acceptance Criteria | **PASS** | Plan-linked behaviors covered by listed tests |
| 4 | Permission Scoping | **Not verified** | No agent permission matrix audit |
| 5 | Adversarial Verification | **Not run** | No red-team pass |
| 6 | Cross-Model Verification | **Not run** | No second provider review |
| 7 | Human Eval Gate | **Not run** | Sign-off pending human |

**Interpretation**: Layers **2–3** are satisfied by this verification. Layers **1, 4–7** are **out of scope** for an automated CI-style pass unless explicitly invoked — hence overall **WARN** relative to the **full** 7-layer definition.

---

## Forbidden / policy checks

| Check | Result |
|-------|--------|
| `grep @anthropic-ai/sdk` under `packages/` | **0** matches |
| OMO zoo proper names (listed in `27-CONTEXT.md`) | **0** matches in `packages/` |
| Incidental strings | `OMOUX-01` requirement id in `do.skill.ts` comment; test fixture `slug: 'omo-ux'` in `active-work-rendering.test.ts` — **not** the banned external agent zoo names; optional cleanup for naming purity |

---

## Constraint checks (Phase 27 CONTEXT D-02 / D-03)

| Check | Result |
|-------|--------|
| New `packages/cli/commands/sunco/*.md` since pre–Phase 27 baseline (`1dadef4`) | **None** (`git diff --diff-filter=A …` empty) |
| New `packages/skills-workflow/src/*.skill.ts` in same range | **None** |
| Command count vs contract | **81** files under `packages/cli/commands/sunco/` — matches contract “81” |
| ESM `import … from '…/*.js'` | Convention observed on sampled paths |

---

## Goal assessment

- **Phase 27**: The codebase delivers the **state surface** (active-work artifact, lifecycle hook, status/next rendering) and **routing surface** (classifier + do/review wiring per tests). Recommender rule changes are covered indirectly via `packages/core/src/recommend` in broader tests; this run did not execute `rules.test.ts` alone — **minor gap** if recommender-only regression is a hard gate.

- **Phase 28**: `AdvisorRunner` and prompt plumbing exist; advisor is **disabled by default** in design; unit tests pass. **Live** Claude Code advisor output was **not** confirmed in `EVIDENCE.md`.

---

## Regressions

No failures observed in the **specified** test files. Full-repo `turbo test` was **not** run in this verification.

---

## Verdict

**WARN** — **Implementation + deterministic verification PASS** for Phases 27–28 scope (build, listed tests, policy grep, no new commands/skills in tracked range). **Not** a full product-contract 7-layer sign-off: layers 1, 4–7 unexecuted; Phase 28 live advisor smoke **LIMITED**; consolidation flags not each asserted by a dedicated test in this list.

To reach **PASS** on the strict 7-layer definition: run remaining layers (or document waiver), confirm advisor transport with a successful model response, and optionally expand tests for consolidation flags and recommender rules.
