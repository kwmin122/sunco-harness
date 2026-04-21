# Release-Router Workflow (Phase 56)

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

Internal deterministic 10-sub-stage decomposition consumed by `/sunco:release`. Contract source: `packages/cli/references/router/APPROVAL-BOUNDARY.md` (Phase 52a; class definitions, risk_level enum, blessed orchestrator batched-ACK rules) + `commands/sunco/release.md` (release command surface; byte-identical from `7791d33` per R1 regression guarantee — Phase 56 adds `workflows/release.md` as the sub-stage contract document without modifying the command file itself).

This workflow is the **canonical approval-boundary-enforced auto-execution exemplar** for IF-21 — each of the 10 sub-stages carries a named `approval_envelope` with explicit `risk_level`, `mode`, ACK shape, and failure semantics. The release surface is where `read_only` / `local_mutate` / `repo_mutate` / `repo_mutate_official` / `remote_mutate` / `external_mutate` classifications become operationally connected to user-facing auto-execution decisions.

## Sub-stage pipeline (10 deterministic steps; Gate 56 L1; DESIGN §11 30a)

```
Step 1   PRE_FLIGHT
Step 2   VERSION_BUMP
Step 3   CHANGELOG
Step 4   COMMIT
Step 5   TAG
Step 6   PUSH
Step 7   PUBLISH
Step 8   VERIFY_REGISTRY
Step 9   TAG_PUSH
Step 10  COMPOUND_HOOK
```

Full `approval_envelope` blocks per sub-stage (class + risk_level + mode + ACK shape + failure semantics + rationale citations) are populated in Phase 56 Commit B per Gate 56 L2 risk_level mapping (reference: `.planning/phases/56-router-release/56-CONTEXT.md`). The skeleton above captures the 10 sub-stage names for Commit A reviewer orientation; full contract content lands at Commit B alongside smoke Section 32 coverage.

## Scope boundaries (Phase 56)

This workflow does NOT:

- Modify `commands/sunco/release.md` (byte-identical from `7791d33`; R1 regression guarantee continuation; 8-command hard-lock set).
- Open `commands/sunco/artifact-gate.md` (AB1 scope hard-lock through Phase 56; workflows/release.md references artifact-gate by name only; command file itself is NOT modified).
- Mutate Phase 52a/52b/53/54/55 runtime assets (5 router ref docs, 4 router runtime modules, router.md command, workflows/router.md, 4 wrappers, mode hook, compound schema, 2 compound src, compound.md command, workflows/compound.md, compound READMEs + template, `.planning/compound/README.md`, Phase 55 retroactive compound artifact + dogfood fixtures + dogfood vitest).
- Install an automatic hook into `workflows/router.md` or `commands/sunco/router.md` (Phase 54 U1 Codex-strict continuation; Phase 56 extends the "no router-pipeline hook" posture).
- Read or write `.claude/rules/` (architecture.md namespace update **6th** iteration defer; v1.5-closure target).
- Touch `.github/workflows/ci.yml` (Path-A continuation).
- Add new runtime modules, new module exports, new vitest files, or new npm dependencies (Phase 56 adds zero runtime code).
