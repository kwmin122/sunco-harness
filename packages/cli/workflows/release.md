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

## Sub-stage risk_level mapping (Gate 56 L2)

| # | Sub-stage | risk_level | Mode | ACK shape |
|---|-----------|------------|------|-----------|
| 1 | PRE_FLIGHT | `read_only` | `auto_safe` | None (HIGH band) |
| 2 | VERSION_BUMP | `repo_mutate_official` | `requires_user_ack` | Blessed batched-ACK via `/sunco:release` |
| 3 | CHANGELOG | `repo_mutate_official` | `requires_user_ack` | Blessed batched-ACK via `/sunco:release` |
| 4 | COMMIT | `repo_mutate` | `requires_user_ack` | Per-write ACK |
| 5 | TAG | `repo_mutate` | `requires_user_ack` | Per-write ACK |
| 6 | PUSH | `remote_mutate` | `requires_user_ack` | Per-invocation; never cached; never `auto_safe` (APPROVAL-BOUNDARY.md L14 hard invariant) |
| 7 | PUBLISH | `external_mutate` | `requires_user_ack` | Per-invocation; never cached; never `--batch-ack`; never `auto_safe` (DESIGN §11 30c literal; APPROVAL-BOUNDARY.md L14 hard invariant) |
| 8 | VERIFY_REGISTRY | `read_only` | `auto_safe` | None (HIGH band) |
| 9 | TAG_PUSH | `remote_mutate` | `requires_user_ack` | Per-invocation; never cached |
| 10 | COMPOUND_HOOK | `local_mutate` | `auto_safe` | None (HIGH band; APPROVAL-BOUNDARY.md L47 explicit exception for `.planning/compound/*.md` draft auto-write) |

**AB2 CHANGELOG class-by-purpose policy sentence:** For Phase 56, CHANGELOG.md is treated as repo_mutate_official by purpose within the /sunco:release release-record class. This classification derives from APPROVAL-BOUNDARY.md L26 class-by-purpose rationale + L63 blessed orchestrator explicit CHANGELOG.md naming. The L32 literal-path reading is narrower than the L26-intended class; D1 errata below logs the spec gap for v1.5 maintenance backlog.

**AB1 artifact-gate scope line:** G5 scope = workflows/release.md sub-stage contract + smoke Section 32 assertions that reference how /sunco:artifact-gate consumes release-grade artifacts. packages/cli/commands/sunco/artifact-gate.md is NOT opened by Phase 56 (hard-lock through Phase 56 per explicit scope line). Opening the command file requires a separate phase or explicit scope expansion.

## Sub-stage approval_envelope blocks

### Step 1: PRE_FLIGHT

```yaml
approval_envelope:
  class: read_only
  risk_level: read_only
  mode: auto_safe
  ack_shape: none
  failure_semantics: |
    Failure during PRE_FLIGHT halts the release before VERSION_BUMP. Workspace
    state is unchanged. Remediate and re-invoke /sunco:release.
  rationale: |
    Pre-flight aggregates read-only checks (lint / tsc / tests / branch /
    workspace consistency). No repository state is mutated. APPROVAL-BOUNDARY.md
    allows auto_safe for read_only + HIGH band per L50 (action.mode = auto_safe
    ONLY when risk_level ∈ {read_only, local_mutate} AND band === 'HIGH').
```

**Workspace consistency check (DESIGN §11 30d literal; Gate 56 L5):** PRE_FLIGHT enumerates an independent workspace consistency check (Phase 51 Flag 1 lineage) — package.json version parity across workspace packages, lockfile freshness vs root package.json, no divergent workspace versions. This check is a distinct sub-step within PRE_FLIGHT, separate from VERSION_BUMP; a workspace-mismatch failure at PRE_FLIGHT is a pre-flight failure and does NOT contaminate VERSION_BUMP attempt semantics. The workspace consistency check remains `read_only` (inspection only; no write).

### Step 2: VERSION_BUMP

```yaml
approval_envelope:
  class: repo_mutate_official
  risk_level: repo_mutate_official
  mode: requires_user_ack
  ack_shape: blessed_batched_ack_via_sunco_release
  failure_semantics: |
    Failure during VERSION_BUMP leaves package.json untouched. PRE_FLIGHT
    already succeeded; re-invoke VERSION_BUMP after fix. No CHANGELOG / COMMIT
    / TAG produced.
  rationale: |
    Writes package.json (and workspace package.json files) — class-by-purpose
    repo_mutate_official per APPROVAL-BOUNDARY.md L26 (definitional class; file
    list enumeration is brittle). L63 names /sunco:release as a blessed
    orchestrator that batches version-bump writes under a single invocation-
    level ACK covering all writes of the same file class in the invocation.
```

### Step 3: CHANGELOG

```yaml
approval_envelope:
  class: repo_mutate_official
  risk_level: repo_mutate_official
  mode: requires_user_ack
  ack_shape: blessed_batched_ack_via_sunco_release
  failure_semantics: |
    Failure during CHANGELOG leaves CHANGELOG.md untouched and reverts
    VERSION_BUMP (release rolls back to pre-VERSION_BUMP state via working-tree
    checkout of bumped package.json files, since COMMIT has not run yet).
  rationale: |
    CHANGELOG class-by-purpose repo_mutate_official per AB2 policy sentence
    above (APPROVAL-BOUNDARY.md L26 class-by-purpose + L63 blessed orchestrator
    explicit CHANGELOG.md naming). Covered by the same blessed batched-ACK as
    VERSION_BUMP (both are same class = single invocation-level ACK).
```

### Step 4: COMMIT

```yaml
approval_envelope:
  class: repo_mutate
  risk_level: repo_mutate
  mode: requires_user_ack
  ack_shape: per_write_ack
  failure_semantics: |
    Failure during COMMIT leaves VERSION_BUMP + CHANGELOG working-tree changes
    unstaged. Retry via `git add` + re-invoke COMMIT, or rollback via working-
    tree checkout.
  rationale: |
    Ad-hoc git commit is repo_mutate (not official class — the commit itself
    is metadata, not a decision/state/acceptance artifact). Per-write ACK
    because COMMIT is a distinct authoring act outside the blessed batched-
    ACK envelope (which covers VERSION_BUMP + CHANGELOG writes, not the git
    commit that records them).
```

### Step 5: TAG

```yaml
approval_envelope:
  class: repo_mutate
  risk_level: repo_mutate
  mode: requires_user_ack
  ack_shape: per_write_ack
  failure_semantics: |
    Failure during TAG leaves COMMIT in place but no tag created. Retry via
    `git tag vX.Y.Z`; PUSH has not yet run. Rolling back the tag is a local-
    only operation (tag delete).
  rationale: |
    Local git tag creation is repo_mutate (local git object write). Per-write
    ACK because TAG is a distinct authoring act. Tag push is a separate sub-
    stage (TAG_PUSH) with higher risk_level.
```

### Step 6: PUSH

```yaml
approval_envelope:
  class: remote_mutate
  risk_level: remote_mutate
  mode: requires_user_ack
  ack_shape: per_invocation_ack_never_cached
  failure_semantics: |
    Failure during PUSH leaves local COMMIT + TAG in place but origin
    unchanged. Retry via explicit re-invocation (user ACK always required per
    APPROVAL-BOUNDARY.md L14 hard invariant — remote_mutate never auto_safe).
  rationale: |
    `git push origin main` is remote_mutate (alters shared remote state).
    APPROVAL-BOUNDARY.md L14 hard invariant: remote_mutate is NEVER auto_safe,
    regardless of band. ACK is per-invocation and never cached (L46 per-
    invocation contract).
```

### Step 7: PUBLISH

```yaml
approval_envelope:
  class: external_mutate
  risk_level: external_mutate
  mode: requires_user_ack
  ack_shape: per_invocation_ack_never_cached_never_batch_ack
  failure_semantics: |
    Failure during PUBLISH leaves the git push in place but no npm artifact
    registered. VERIFY_REGISTRY will fail. Retry via explicit re-invocation
    after fix (user ACK always required per APPROVAL-BOUNDARY.md L14 hard
    invariant — external_mutate never auto_safe and never `--batch-ack`).
  rationale: |
    `npm publish` is external_mutate per DESIGN §11 30c literal (external
    registry write; irreversible once published). APPROVAL-BOUNDARY.md L14
    hard invariant: external_mutate is NEVER auto_safe. Additionally, PUBLISH
    is explicitly excluded from blessed-orchestrator batched-ACK coverage
    (DESIGN §11 30c); each invocation requires independent user ACK. Never
    covered by --batch-ack flag.
```

### Step 8: VERIFY_REGISTRY

```yaml
approval_envelope:
  class: read_only
  risk_level: read_only
  mode: auto_safe
  ack_shape: none
  failure_semantics: |
    Failure during VERIFY_REGISTRY indicates the npm registry has not yet
    propagated the newly published version (eventual consistency). Retry with
    backoff. If consistently failing, the PUBLISH succeeded but the registry
    query is broken — investigate. Do NOT proceed to COMPOUND_HOOK until
    VERIFY_REGISTRY succeeds (ensures compound artifact's source_evidence[]
    references registry-verified release).
  rationale: |
    Registry lookup (`npm view popcoru@X.Y.Z`) is read_only. auto_safe at HIGH
    band per APPROVAL-BOUNDARY.md L50. No state mutation.
```

### Step 9: TAG_PUSH

```yaml
approval_envelope:
  class: remote_mutate
  risk_level: remote_mutate
  mode: requires_user_ack
  ack_shape: per_invocation_ack_never_cached
  failure_semantics: |
    TAG_PUSH failure is post-semantic-completion git-metadata reconciliation
    failure; compound trigger timing is NOT moved. Compound artifact already
    written at status=proposed reflects registry-verified release. TAG_PUSH
    retry sub-stage is separately invocable (Gate 56 L6). TAG_PUSH retry does
    NOT re-trigger COMPOUND_HOOK (double-write guard: compound-router writes
    atomically at status=proposed on first COMPOUND_HOOK invocation; TAG_PUSH
    failure does not alter that artifact).
  rationale: |
    `git push origin vX.Y.Z` is remote_mutate. APPROVAL-BOUNDARY.md L14 hard
    invariant. TAG_PUSH is placed AFTER COMPOUND_HOOK (Gate 56 L7) so that
    compound artifact's source_evidence[] references the registry-verified
    release — not dependent on the tag being on origin yet. This ordering
    means TAG_PUSH failure cannot contaminate compound artifact content.
```

### Step 10: COMPOUND_HOOK

```yaml
approval_envelope:
  class: local_mutate
  risk_level: local_mutate
  mode: auto_safe
  ack_shape: none
  failure_semantics: |
    Failure during COMPOUND_HOOK does NOT roll back the release. PUBLISH has
    succeeded + VERIFY_REGISTRY passed; the release is semantically complete
    at the external-registry boundary. Compound artifact retry is invocable
    via direct `/sunco:compound` call. Post-approval sink writes (back into
    memory/rules/backlog from the compound artifact's approval log) remain
    repo_mutate_official (class crossover per APPROVAL-BOUNDARY.md L47) and
    are NOT auto-triggered by COMPOUND_HOOK.
  rationale: |
    COMPOUND_HOOK runs compound-router.runCompound(ctx) after VERIFY_REGISTRY
    success and BEFORE TAG_PUSH (Gate 56 L7; DESIGN §11 30e literal). Writes
    .planning/compound/<scope>-<ref>-<YYYYMMDD>.md at status=proposed — this
    is local_mutate per APPROVAL-BOUNDARY.md L47 explicit exception (compound-
    router draft auto-write). auto_safe at HIGH band because the classifier
    exemption applies only to the draft auto-write itself; post-approval sink
    writes cross back into repo_mutate_official and require per-write ACK.
```

## Relation to Phase 52b router + Phase 54 compound-router

The release-router workflow is a **consumer contract** — it specifies how `/sunco:release` invocation decomposes into 10 sub-stages, each of which either (a) performs a read-only check, (b) writes to an approval-boundary-classified sink with the documented ACK shape, or (c) invokes a blessed orchestrator sub-pipeline (COMPOUND_HOOK → compound-router.runCompound). It adds zero runtime modules and zero new module exports. The `/sunco:release` command file (`commands/sunco/release.md`, byte-identical from `7791d33`) is the runtime surface; this workflow document is the contract consumed by that command's execution.

Phase 52b `workflows/router.md` remains byte-identical. Phase 54 `workflows/compound.md` remains byte-identical. Phase 55 dogfood fixtures + retroactive v1.4 compound artifact + dogfood vitest remain byte-identical. Phase 56 adds `workflows/release.md` as a peer to `workflows/router.md` + `workflows/compound.md`, not a replacement or augmentation.

## Scope boundaries (Phase 56)

This workflow does NOT:

- Modify `commands/sunco/release.md` (byte-identical from `7791d33`; R1 regression guarantee continuation; 8-command hard-lock set).
- Open `commands/sunco/artifact-gate.md` (AB1 scope hard-lock through Phase 56; workflows/release.md references artifact-gate by name only; command file itself is NOT modified).
- Mutate Phase 52a/52b/53/54/55 runtime assets (5 router ref docs, 4 router runtime modules, router.md command, workflows/router.md, 4 wrappers, mode hook, compound schema, 2 compound src, compound.md command, workflows/compound.md, compound READMEs + template, `.planning/compound/README.md`, Phase 55 retroactive compound artifact + dogfood fixtures + dogfood vitest).
- Install an automatic hook into `workflows/router.md` or `commands/sunco/router.md` (Phase 54 U1 Codex-strict continuation; Phase 56 extends the "no router-pipeline hook" posture).
- Read or write `.claude/rules/` (architecture.md namespace update **6th** iteration defer; v1.5-closure target).
- Touch `.github/workflows/ci.yml` (Path-A continuation).
- Add new runtime modules, new module exports, new vitest files, or new npm dependencies (Phase 56 adds zero runtime code).
