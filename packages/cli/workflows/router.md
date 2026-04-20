# Router Workflow (Phase 52b)

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

Internal deterministic pipeline invoked by `/sunco:router`. Contract source: `packages/cli/references/router/*.md` (Phase 52a). Runtime: `packages/cli/references/router/src/*.mjs` (Phase 52b).

## Module map

| Module | Purpose | Shape |
|--------|---------|-------|
| `evidence-collector.mjs` | IO boundary. Adapter-based; injects `execGit`, `readFile`, `statFile`, `now` for deterministic tests. Runs the 7-point Freshness Gate. | `collectEvidence({ repoRoot, ... }) → evidence` + `runFreshnessGate(evidence) → { status, checks[7] }` |
| `classifier.mjs` | Pure stage classifier. Maps evidence to `current_stage`, `recommended_next`, `confidence_signals`, ordered `reason[]`, `action`, `approval_envelope`. Includes local structural RouteDecision validator. | `classifyStage(evidence, ts?) → RouteDecision` |
| `confidence.mjs` | Pure frozen-weight confidence math. **Zero LLM SDK imports** (I4 invariant, smoke 27s grep path-exact on this module). | `computeConfidence(signals) → number ∈ [0,1]` + `classifyBand(n) → HIGH/MEDIUM/LOW` |
| `decision-writer.mjs` | Writes the RouteDecision to ephemeral + (when promoted) durable tiers. Enforces path allowlist. Atomic tmp-in-same-dir rename. | `writeDecision(decision, ctx) → { ephemeralPath, durablePath, promoted, reasons }` + `shouldPromote(decision, ctx)` |

## Pipeline (deterministic)

```
Step 0  Freshness Gate          evidence-collector.runFreshnessGate
Step 1  Evidence collection     evidence-collector.collectEvidence
Step 2  Stage classification    classifier.classifyStage (drift → UNKNOWN/HOLD early exit)
Step 3  Confidence              classifier delegates signal compute to confidence.computeConfidence
Step 4  Narrative render        classifier.renderNarrativeReasons (ordered by frozen weight)
Step 5  Structural validation   classifier.validateRouteDecision (local, no AJV)
Step 6  Decision write          decision-writer.writeDecision (ephemeral + optional durable)
Step 7  User-facing rendering   /sunco:router formats the RouteDecision per band behavior
```

No LLM participates in Steps 0–6. Narrative text is ordered deterministically by frozen confidence weights. Step 7 presentation layer (CLI output formatting) remains under user control; the classifier's `reason[]` is the stable audit trail.

## Freshness Gate 7 sub-predicates (EVIDENCE-MODEL.md L73)

Exactly 7, in canonical order:

1. `git-status` — working tree clean/dirty/conflicted
2. `origin-head` — `origin/main == HEAD` synced/drift/conflicted
3. `artifact-mtime` — STATE.md mtime vs last commit (drift>5min threshold)
4. `roadmap-state-alignment` — STATE.md milestone token appears in ROADMAP.md
5. `state-phase-exists` — STATE.md frontmatter phase directory exists on disk
6. `phase-dir-populated` — phase directory has at least one `*CONTEXT.md`
7. `cross-artifact-refs` — REQUIREMENTS.md + ROADMAP.md both readable

All-aligned → `fresh`. One failure → `drift`. Two+ failures with "conflict"-family results → `conflicted`.

## Approval envelope construction

Per `references/router/APPROVAL-BOUNDARY.md`:

- `action.mode = auto_safe` ONLY when: `risk_level ∈ {read_only, local_mutate}` AND `band === 'HIGH'`
- `action.mode = requires_user_ack` for `repo_mutate`, `repo_mutate_official`, `remote_mutate`, `external_mutate` — always, regardless of band
- `action.mode = manual_only` for UNKNOWN / HOLD / drift-with-strict-risk-intent

**L14 (hard invariant, enforced in both classifier output and structural validator):** `remote_mutate` and `external_mutate` are NEVER `auto_safe`. A decision violating this is rejected by `validateRouteDecision` with `RouteDecisionInvalidError`.

`forbidden_without_ack[]` is populated for `remote_mutate` / `external_mutate` with the associated hard-lock operations (`git push`, `git push --tag`, `npm publish`, `npm login`).

## Durable tier promotion (DESIGN §4.2)

`shouldPromote(decision, ctx) → { promote, reasons }` is deterministic, any-match:

| # | Criterion | Reason token |
|---|-----------|--------------|
| a | stage ∈ {RELEASE, COMPOUND} | `promote:release-or-compound` |
| b | milestone-closed detected (caller supplies via `ctx.milestoneClosed`) | `promote:milestone-closed` |
| c | `freshness.status === 'conflicted'` (forensic trail) | `promote:conflicted` |
| d | first router decision in newly entered phase directory | `promote:first-in-phase` |
| e | explicit `--durable` flag | `promote:explicit-durable` |

When any criterion fires, the writer emits both ephemeral and durable entries in one invocation, each using atomic tmp-in-same-dir rename.

## Writer path allowlist (Codex C5 / Gate 52b L6)

The decision writer accepts only these target paths:

- `<repoRoot>/.sun/router/session/*.json` (ephemeral)
- `<repoRoot>/.planning/router/decisions/*.json` (durable)
- `<repoRoot>/.planning/router/paused-state.json` (pause pointer)

Any other path — including `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, phase `CONTEXT.md`, `VERIFICATION.md`, `SUMMARY.md`, `CHANGELOG.md`, memory files, `.claude/rules/` — throws `RouterWriterPathError`. This is a hard invariant tested at the writer boundary (not at the command boundary) so agents cannot accidentally route `repo_mutate_official` writes through the router.

## Determinism guarantees (I1-I4 enforcement in smoke Section 28)

- **I1 Determinism**: `computeConfidence(signals)` returns byte-identical output across 100 iterations on fixture signals.
- **I2 Bounds**: `computeConfidence({}) === 0`; `computeConfidence(all-positive) === 1.0`.
- **I3 Monotonicity**: zeroing any positive signal produces non-increasing score.
- **I4 No LLM**: `packages/cli/references/router/src/confidence.mjs` source contains zero matches for `anthropic`, `openai`, `@ai-sdk/`, `ai` module, agent-SDK imports.

Failure of any invariant degrades the router to MEDIUM/LOW-only mode (HIGH band disabled); no auto-proceed until repaired.

## Scope boundaries

This workflow does NOT:

- Mutate existing stage commands (plan / execute / verify / proceed-gate / ship / release). They remain byte-identical when invoked directly (R1 regression guarantee).
- Read or write `.claude/rules/`, `.github/workflows/ci.yml`, or any `packages/cli/schemas/` file.
- Modify Phase 52a reference docs (`STAGE-MACHINE.md`, `EVIDENCE-MODEL.md`, `CONFIDENCE-CALIBRATION.md`, `APPROVAL-BOUNDARY.md`, Phase 52a router README) or the route-decision schema.
- Participate in any remote_mutate / external_mutate operation directly. The router proposes; the user executes via a blessed orchestrator or explicit ACK.

## Relation to existing stages

The router classifier reads the same planning artifacts that stage commands write and consume (STATE.md, ROADMAP.md, REQUIREMENTS.md, phase CONTEXT/PLAN/VERIFICATION/SUMMARY). Invoking a stage command directly (`/sunco:plan`, `/sunco:verify`, etc.) remains fully supported; the router does not intercept or wrap them in Phase 52b. Phase 53 adds wrapper updates to `/sunco:do`, `/sunco:next`, `/sunco:mode`, `/sunco:manager` so those entry points route through the classifier; existing stage commands continue to be invocable standalone.
