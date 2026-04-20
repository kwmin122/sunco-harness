# SUNCO Compound-Router — Reference Pack

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

## Purpose

This reference pack defines the **contract** for the SUNCO Compound-Router: a post-stage durable-decision consumer that reads RouteDecision logs from `.planning/router/decisions/`, scores whether the observed window warrants a compound artifact, and (when the score crosses threshold) auto-writes a structured retrospective to `.planning/compound/<scope>-<ref>-<date>.md` at `status: proposed`. Sink proposals for memory / rules / backlog / SDI counter are emitted **inside** the compound artifact as structured sections; the proposer never writes to those sinks directly (user ACK required downstream).

The reference pack is the source of truth that the Phase 54 runtime (`src/compound-router.mjs` + `src/sink-proposer.mjs`) consumes. Trigger score math, auto-write path-allowlist, and 8-section artifact template live here.

## File index

- `README.md` — this file. Purpose, file index, clean-room notice.
- `template.md` — 8-section markdown template for the compound artifact. Section names match `schemas/compound.schema.json` `sections` enum (`context`, `learnings`, `patterns_sdi`, `rule_promotions`, `automation`, `seeds`, `memory_proposals`, `approval_log`).
- `src/compound-router.mjs` — runtime engine. Exports `scoreCompound({stage_exit, event, window}) → {score, reasons}`, `runCompound(ctx) → {artifactPath, status, score}`, `validateCompoundArtifact(artifact) → void|throw`. Adapter-injected IO (Phase 52b pattern).
- `src/sink-proposer.mjs` — proposal emitter. Exports `proposeSinks(window, evidence) → {patterns_sdi, rule_promotions}`. Never writes to memory / rules / backlog / SDI counter (proposal-only; enforced by negative-grep in Section 30).

## Consumer map

| Phase | Consumer | What it reads from here |
|-------|----------|-------------------------|
| 54 (this phase) | `commands/sunco/compound.md`, `workflows/compound.md`, `schemas/compound.schema.json` | Template + runtime modules. |
| 55 | Router dogfood fixtures + retroactive v1.4 backfill | All three runtime modules + schema; `test/fixtures/router/<scenario>/expected-compound.md` oracles generated from `template.md`. |
| 56 (provisional) | `workflows/release.md` sub-stage decomposition | Schema `scope: release` lifecycle; artifact path convention. |
| v1.6+ | TBD post-dogfood | Trigger score model tuning (v2 candidate per DESIGN §13 D3). |

## Post-stage durable-decision consumer (G5 (b') naming — strict)

Phase 54 ships compound-router as a **post-stage durable-decision consumer**, not an automatic hook installed into the router pipeline. The distinction matters:

- **Consumer** — reads `.planning/router/decisions/*.json` (durable RouteDecision tier) on demand. `/sunco:compound` is user-invoked. No router pipeline mutation. Zero impact on Phase 52b/53 byte-stable runtime.
- **Hook** (NOT implemented in Phase 54) — would dispatch from `workflows/router.md` Step N post-classification, OR from wrapper rendering layer, OR from `decision-writer.mjs` post-write side-effect. All three would violate the Phase 52b/53 L16 immutability hard-lock on those files. Automatic hook integration deferred until Phase 55 dogfood or later gate.

The consumer reads what the router has already written to the durable tier (RELEASE/COMPOUND/milestone-closed/conflicted/first-in-phase/`--durable` promoted decisions). It does not require the router to emit any new signal; it works against the existing route-decision schema from Phase 52a.

## Trigger score (DESIGN §8.2 L3 split)

Pure deterministic function `scoreCompound({stage_exit, event, window}) → {score: number, reasons: string[]}`. No LLM. No network. No filesystem side-effect (scoring is pure; runCompound does the write).

Contribution table (identical to DESIGN §8.2):

| Contribution | Delta | Source |
|--------------|-------|--------|
| SDI-observational (pattern observed ≥2 times, NOT in spec/rules) | +2 | L3 split |
| spec-rule-prescriptive (pattern violates/extends existing spec/rule) | +3 | L3 split |
| pattern already codified | -1 | dedupe |
| RELEASE exited successfully | +6 | always-on |
| MILESTONE CLOSED | +5 | always-on |
| PROCEED CHANGES_REQUIRED + mitigations ACKed | +3 | conditional |
| post-judge fix commit in window | +3 | conditional |
| CI failure recovered | +2 | conditional |
| rollback anchor used | +2 | conditional |
| new plan debt | +1 | conditional |
| gate RED/YELLOW | +1 | conditional |
| user corrected direction ≥2 times | +1 | conditional |
| docs-only, no new decisions | -3 | dampener |
| no new debt/gate/rollback | -2 | dampener |
| window too short (<1 commit) | -2 | dampener |

Thresholds:
- `score >= 5` → auto-create compound artifact, `status: proposed`
- `2 <= score < 5` → "compound candidate" note on stdout (no write)
- `score < 2` AND not RELEASE/MILESTONE → silent skip
- RELEASE or MILESTONE CLOSED → always-on (threshold override; always writes artifact)

## Auto-write boundary (path-allowlist)

`compound-router.mjs` writer accepts ONLY paths matching:

- `<repoRoot>/.planning/compound/<scope>-<ref>-<date>.md` (pattern)
- `<repoRoot>/.planning/compound/*.md` (drafts / ad_hoc)

Any other path — including `.claude/rules/`, memory files, `.planning/backlog/` (999.x), SDI counter state, STATE.md, ROADMAP.md, REQUIREMENTS.md, CHANGELOG.md, phase CONTEXT/PLAN/VERIFICATION/SUMMARY — throws `CompoundWriterPathError`. This is enforced at the writer boundary, not at the command boundary, so agents cannot accidentally route `repo_mutate_official` writes through compound-router.

## Sink proposer boundary (proposal-only)

`sink-proposer.mjs` emits proposals as two structured sections **inside the compound artifact**:

- `## patterns_sdi` — observational patterns (L3 +2 source). Each pattern: name + occurrence count + proposed SDI counter delta (`+1 toward PIL 999.x promotion`).
- `## rule_promotions` — spec-rule-prescriptive patterns (L3 +3 source). Each promotion: target `.claude/rules/<file>` + diff preview as code-fenced markdown.

The proposer NEVER writes to:
- `memory/` (user auto-memory system)
- `.claude/rules/` (agent behavior rules)
- `.planning/backlog/` (999.x parking lot)
- SDI counter state (internal to PIL 999.1)

Enforced by negative-grep in Section 30 smoke (source has zero matches for `writeFile.*memory\|\.claude/rules\|backlog` excluding hard-lock comments).

## 8 required sections

Stable ordering in `template.md` + `schemas/compound.schema.json`:

1. `context` — what happened in the window; source_evidence references
2. `learnings` — explicit takeaways
3. `patterns_sdi` — SDI-observational proposals (sink-proposer output)
4. `rule_promotions` — spec-rule-prescriptive proposals (sink-proposer output)
5. `automation` — candidate automations (none = empty section with "no automation candidates" placeholder)
6. `seeds` — forward-looking ideas with trigger conditions (none = empty section placeholder)
7. `memory_proposals` — memory auto-memory candidates (none = empty section placeholder)
8. `approval_log` — user ACK trail per proposal (populated as user reviews)

## Phase 54 scope (what this pack is and is not)

**Is** — contract + runtime for the post-stage durable-decision consumer. Schema + 2 src modules + 2 `.md` reference docs + template. Static smoke assertions (Section 30 "Compound-Router (Phase 54)") check structural invariants: schema validity, template section markers, scoring determinism, auto-write boundary, sink-proposer proposal-only, 9-path clean-room scope, Phase 52a/52b/53 byte-stability.

**Is not** — automatic hook installed in router pipeline, wrapper-visible compound hints, architecture.md namespace doc update, `.claude/rules/` promotion, Phase 55 dogfood fixtures, Phase 56 release-router decomposition. Those land in later phases or deferred backlog.

## Hard-locks honored in this pack

From Gate 54 v1 + strict-side union absorption:

- `.github/workflows/ci.yml` untouched (v1.4 Path-A continuation through 52a/52b/53/54)
- `.claude/rules/` NOT touched (U4 Codex-strict defer; architecture.md namespace update deferred)
- `workflows/router.md` + `commands/sunco/router.md` + `references/router/src/*.mjs` + 5 `references/router/*.md` byte-identical from Phase 52b (L10 immutability extension)
- 4 wrapper files (`do/next/mode/manager.md`) + `hooks/sunco-mode-router.cjs` byte-identical from Phase 53 (no wrapper-visible compound hints per U1)
- 7 existing stage commands (`brainstorming/plan/execute/verify/proceed-gate/ship/release.md`) byte-identical from `7791d33` (R1 regression guarantee)
- `commands/sunco/auto.md` byte-identical (frozen until Phase 57)
- 8 existing schemas untouched (`finding, cross-domain, ui-spec, api-spec, data-spec, event-spec, ops-spec, route-decision`)
- `.planning/router/DESIGN-v1.md` unchanged in Phase 54 (L16 immutability; drift → 54-CONTEXT errata)
- Memory files unchanged (sink proposals live inside compound artifact; no memory write)
- SDI counter unchanged at 2 (pre-planned 2-commit split; NOT SDI-2 per Gate 52b B4 + Phase 53 precedent)
- No new npm dependency (local structural validator; no AJV)
