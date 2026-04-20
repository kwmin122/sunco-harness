# Compound-Router Workflow (Phase 54)

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

Internal deterministic pipeline invoked by `/sunco:compound`. Contract source: `packages/cli/references/compound/{README,template}.md` + `schemas/compound.schema.json` (Phase 54). Runtime: `packages/cli/references/compound/src/{compound-router,sink-proposer}.mjs` (Phase 54).

This workflow is a **post-stage durable-decision consumer** — NOT an automatic hook installed into the router pipeline. It reads what Phase 52b's `decision-writer.mjs` has already promoted to the durable tier under `.planning/router/decisions/`, scores whether to produce a compound artifact, and writes `.planning/compound/*.md` on threshold crossing. Zero mutation of Phase 52b/53 runtime assets (Gate 54 L10 immutability).

## Module map

| Module | Purpose | Shape |
|--------|---------|-------|
| `compound-router.mjs` | Pure scoring + decision + validation + write. Adapter-injected IO. Atomic tmp-in-same-dir rename. Path-allowlist at writer boundary. | `scoreCompound(input) → { score, reasons }` + `decideCompound(input) → { decision, score, reasons, alwaysOn }` + `runCompound(ctx) → { decision, score, reasons, artifactPath }` + `validateCompoundArtifact(artifact)` + `assertInCompoundAllowlist(absPath, repoRoot)` |
| `sink-proposer.mjs` | Pure proposal emitter. Emits three structured record arrays: `patterns_sdi`, `rule_promotions`, `memory_proposals`. Never writes to sinks. Markdown renderers for compound artifact sections. | `proposeSinks(input) → { patterns_sdi, rule_promotions, memory_proposals }` + `renderProposalSections(proposals) → { patterns_sdi: md, rule_promotions: md, memory_proposals: md }` |

## Pipeline (deterministic, 6 steps)

```
Step 1  Load durable RouteDecisions  read .planning/router/decisions/*.json + filter by --ref/--window
Step 2  Derive scoring input         build { stage_exit, event, window } from observed decisions
Step 3  Decide                       compound-router.decideCompound(input) → WRITE | CANDIDATE | SKIP
Step 4  Propose sinks                sink-proposer.proposeSinks(input) → 3-bucket records (proposal-only)
Step 5  Write compound artifact      compound-router.runCompound(ctx) → .planning/compound/*.md (WRITE only)
Step 6  Present to user              stdout: artifact path + decision + proposal counts
```

No LLM participates in Steps 1–5. Step 6 presentation layer is deterministic summary; no LLM rendering.

## Trigger score model (DESIGN §8.2 L3 split)

Exactly the contribution table in `references/compound/README.md` §Trigger score. L3 split maps 1:1 to sink buckets:

| Observation type | Score contribution | Sink bucket |
|------------------|-------------------|-------------|
| SDI-observational (+2 per pattern) | `patterns_sdi` | SDI counter delta proposal |
| spec-rule-prescriptive (+3 per pattern) | `rule_promotions` | `.claude/rules/<file>` diff preview proposal |
| already-codified (-1 per pattern) | — (dedupe; no sink) | (none) |
| memory-candidate (no score contribution) | `memory_proposals` | `memory/<file>` body proposal |

Always-on overrides (threshold bypassed):
- `stage_exit === 'RELEASE'` — RELEASE stage exit always writes compound artifact
- `event.milestone_closed === true` — milestone closure always writes compound artifact

## Auto-write boundary (Gate 54 L2)

The writer accepts ONLY these target paths:

- `<repoRoot>/.planning/compound/<scope>-<ref>-<YYYYMMDD>.md` (scope/ref pattern)
- `<repoRoot>/.planning/compound/*.md` (general compound dir; no subdirs)

Any other path — including `<repoRoot>/memory/`, `<repoRoot>/.claude/rules/`, `<repoRoot>/.planning/backlog/`, `<repoRoot>/.planning/STATE.md`, `<repoRoot>/.planning/ROADMAP.md`, `<repoRoot>/.planning/REQUIREMENTS.md`, phase `CONTEXT.md` / `PLAN.md` / `VERIFICATION.md` / `SUMMARY.md`, `<repoRoot>/CHANGELOG.md` — throws `CompoundWriterPathError`. Enforced at the writer boundary (not at the command boundary) so agents cannot accidentally route `repo_mutate_official` writes through compound-router.

## Sink proposer boundary (Gate 54 L3)

`sink-proposer.mjs` has **zero filesystem writes**. The module does not import `node:fs` / `fs.writeFileSync` / `fs.renameSync` / `fs.mkdirSync`. Enforced by:

1. Source-level inspection (no `import ... fs` statement)
2. Smoke Section 30 negative-write grep asserts `writeFile|renameSync|mkdirSync` → 0 matches in `sink-proposer.mjs`
3. Smoke Section 30 positive-shape grep asserts `proposeSinks` + `renderProposalSections` exports are the proposer's public surface

All sink state changes (memory creation, `.claude/rules/` edits, `.planning/backlog/` entries, SDI counter increments) happen via downstream user-ACK flow, not via compound-router or sink-proposer directly.

## Determinism guarantees (smoke Section 30)

- **Scoring determinism**: `scoreCompound(input)` returns byte-identical output across 100 iterations on fixture input (parallels 27p confidence determinism).
- **No LLM**: `compound-router.mjs` + `sink-proposer.mjs` source contains zero matches for `anthropic`, `openai`, `@ai-sdk/`, agent-SDK imports.
- **Structural validator local**: `validateCompoundArtifact` performs structural checks (kind, version, scope enum, status enum, 8 sections, clean_room_notice, generated_by, ISO date-time parse) without AJV or any schema library (Phase 52b L7 precedent).

Failure of any invariant → compound-router degrades to `--dry-run` mode; no auto-writes until repaired.

## Scope boundaries

This workflow does NOT:

- Install an automatic hook into `workflows/router.md` or `commands/sunco/router.md` (Gate 54 U1 Codex-strict; deferred until Phase 55 dogfood or later gate).
- Modify 4 wrapper command files (`do/next/mode/manager.md`) or `hooks/sunco-mode-router.cjs` to surface compound hints (wrappers byte-stable from Phase 53 `72a391a`).
- Mutate Phase 52b runtime modules (`classifier.mjs`, `evidence-collector.mjs`, `confidence.mjs`, `decision-writer.mjs`) or Phase 52a reference docs.
- Write to `memory/`, `.claude/rules/`, `.planning/backlog/`, or SDI counter state.
- Modify `.planning/router/DESIGN-v1.md`, `.planning/ROADMAP.md`, or 8 existing schemas.
- Touch `.github/workflows/ci.yml` (Path-A continuation).

## Relation to Phase 52b/53

The compound-router reads the durable RouteDecision files that Phase 52b's `decision-writer.mjs` writes (per DESIGN §4.2 promotion criteria: RELEASE/COMPOUND stage exit / milestone closed / freshness conflicted / first-in-phase / explicit `--durable`). Phase 54 adds zero to the router pipeline — it consumes telemetry asynchronously when the user invokes `/sunco:compound`.

Phase 52b `workflows/router.md` remains byte-identical. Phase 53 wrapper command files (`do/next/mode/manager.md`) remain byte-identical. `/sunco:compound` is a peer to `/sunco:router`, not a replacement or augmentation.

## Artifact lifecycle (status enum)

Per `schemas/compound.schema.json` `status` field:

1. `draft` — local-only scratch (user-managed; not emitted by auto-write)
2. `proposed` — auto-written by compound-router at this status when DECISION_WRITE fires. Awaits user review of sink proposals.
3. `partially-approved` — user accepted some sink proposals via downstream flow; others deferred.
4. `approved` — all sink proposals resolved (accepted or rejected).
5. `archived` — superseded by a later compound artifact or moved to archive directory.

Lifecycle transitions 2→3/4/5 happen via user edits to the compound artifact; compound-router does NOT auto-transition status (that would be a sink write; proposal-only boundary prevents it).
