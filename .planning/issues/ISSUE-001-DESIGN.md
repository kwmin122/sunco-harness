# ISSUE-001 Design: Adaptive Lifecycle + Multi-Model Design Pingpong

## 1. Design Answers

**Q1: How should pivot detection work?**
Both. Explicit command (`/sunco:pivot`) for intentional pivots + automatic detection when user directly edits PROJECT.md/REQUIREMENTS.md/ROADMAP.md. Detection mechanism: `sunco-tools.cjs artifact-hash` computes SHA256 of each planning artifact at every state transition. On next command invocation, compare hashes. If changed → trigger impact analysis before proceeding.

**Q2: Rollback granularity?**
Per-decision. Every locked decision (D-01, D-02, etc.) in CONTEXT.md is a rollback point. Rollback restores the artifact state to just before that decision was made. Implementation: git tags at each state transition (`sunco/rollback/{phase}-{decision-id}`). Rollback = `git checkout` the tagged commit's planning artifacts only (not code).

**Q3: How should merge engine handle structural differences?**
Section-level comparison. Split both outputs by `## ` headings. For each heading present in both: compare content similarity (Jaccard on sentences). >80% similar = AGREED. <80% = DIVERGED. Headings present in only one output = UNIQUE (flagged for review, not auto-rejected).

**Q4: Cross-model default or opt-in?**
Opt-in via `--cross-model` flag. Reason: doubles token cost and time. For routine tasks, single-model is sufficient. For critical design decisions, users opt in.

**Q5: Token budget for parallel models?**
Each model gets the same input. Budget = 2x single model. The merge/debate phase adds ~20% overhead. Total: ~2.4x single model cost. Users should be warned on first use.

**Q6: Debate moderator?**
Self-resolving with user as tie-breaker. Round 1: each model critiques the other's output. Round 2: each model responds to critiques. Round 3: each model states final position. If still diverged after 3 rounds, present both positions to user with tradeoffs.

---

## 2. Adaptive Lifecycle State Machine

```
                         ┌─── /sunco:pivot ────────────────────┐
                         │                                      │
    ┌──────────┐    ┌────┴─────┐    ┌──────────┐    ┌─────────┴──┐
    │  IDEATE  │───▶│ PLANNING │───▶│ BUILDING │───▶│  VERIFYING  │
    │ (new)    │    │(discuss/ │    │(execute) │    │  (verify)   │
    └──────────┘    │ plan)    │    └────┬─────┘    └──────┬──────┘
         ▲          └────┬─────┘         │                  │
         │               │               │                  │
         │    ┌──────────┴──────────┐    │           ┌──────▼──────┐
         │    │    /sunco:rethink    │    │           │   SHIPPING  │
         │    │  (revise decisions)  │    │           │   (ship)    │
         │    └──────────┬──────────┘    │           └──────┬──────┘
         │               │               │                  │
         │               ▼               │                  ▼
         │    ┌──────────────────────┐   │     ┌───────────────────┐
         │    │   IMPACT ANALYSIS    │◀──┘     │  MILESTONE DONE   │
         │    │ (what's invalidated) │         └───────────────────┘
         │    └──────────┬───────────┘
         │               │
         │    ┌──────────▼──────────┐
         │    │   /sunco:backtrack   │
         │    │ (restore to decision)│
         └────┴─────────────────────┘
```

**Any state → IMPACT ANALYSIS** when:
- User runs `/sunco:pivot`, `/sunco:rethink`, `/sunco:backtrack`, `/sunco:reinforce`
- Artifact hash mismatch detected on command start

### Trigger Detection

Every SUNCO command, on startup (before doing its work), runs:
```bash
node $HOME/.claude/sunco/bin/sunco-tools.cjs artifact-hash check
```

This compares stored hashes (from last state transition) against current file hashes. If ANY artifact changed:
```json
{
  "changed": true,
  "artifacts": [
    {"file": ".planning/REQUIREMENTS.md", "old_hash": "abc...", "new_hash": "def..."}
  ]
}
```

If changed: PAUSE the current command. Run impact analysis. Present the user:
```
⚠ SUNCO detected changes to REQUIREMENTS.md since last operation.

Impact:
  - Phase 2 CONTEXT.md may be outdated (references REQ-03 which was modified)
  - Phase 2 PLAN.md references REQ-03 in Task 2 (may need revision)

Options:
  1) Run impact analysis and re-route (recommended)
  2) Ignore and continue (changes were intentional and don't affect current work)
  3) Revert changes (restore to last known state)
```

### Impact Analysis Algorithm

Given a changed artifact, compute the invalidation cascade:

```
PROJECT.md changed →
  ├── REQUIREMENTS.md: check if any requirement references changed project goals → MAYBE INVALID
  ├── ROADMAP.md: check if any phase references changed constraints → MAYBE INVALID
  └── All CONTEXT.md: check if any decision references changed project decisions → MAYBE INVALID

REQUIREMENTS.md changed →
  ├── Each CONTEXT.md: check which requirements this phase covers → if covered req changed → INVALID
  ├── Each PLAN.md: check which requirements tasks implement → if implemented req changed → INVALID
  └── ROADMAP.md: check phase success criteria referencing changed reqs → MAYBE INVALID

CONTEXT.md (phase N) changed →
  ├── All PLAN.md in phase N → INVALID (must re-plan)
  └── All SUMMARY.md in phase N → WARN (already executed, may need revision)

ROADMAP.md changed →
  ├── STATE.md: current phase may have changed → UPDATE
  └── All CONTEXT.md: phase scope may have changed → MAYBE INVALID
```

"INVALID" = must be re-generated.
"MAYBE INVALID" = check content, may be fine.
"WARN" = already executed, flag for review.

### Rollback System

**On every state transition** (command completion):
```bash
node $HOME/.claude/sunco/bin/sunco-tools.cjs rollback-point create --label "after-discuss-phase-2"
```

This:
1. Computes hash of every `.planning/` artifact
2. Creates git tag `sunco/rollback/{timestamp}-{label}`
3. Stores rollback manifest in `.planning/.rollback/{timestamp}.json`

**On rollback:**
```bash
node $HOME/.claude/sunco/bin/sunco-tools.cjs rollback-point restore --label "after-discuss-phase-2"
```

This:
1. Reads the rollback manifest
2. For each artifact: `git checkout {tag} -- {artifact_path}`
3. Updates STATE.md to reflect rollback
4. Does NOT touch code files — only `.planning/` artifacts

---

## 3. Multi-Model Design Pingpong Protocol

### Spawn Protocol

When `--cross-model` flag is active:

1. Prepare identical input for both models (same files, same prompt, same context)
2. Spawn two Tasks in parallel:
   - Task A: `model="sonnet"` (or current Claude model)
   - Task B: Codex via `codex exec` (uses whatever model Codex has configured)
3. Each produces its output as a markdown file:
   - `.planning/pingpong/model-a-{artifact}.md`
   - `.planning/pingpong/model-b-{artifact}.md`

### Merge Algorithm

Section-level comparison (not line-level — too noisy for markdown):

1. Split both files by `## ` headings
2. For each heading:
   - Present in both → compare content
   - Present in A only → mark as `UNIQUE_A`
   - Present in B only → mark as `UNIQUE_B`

3. Content comparison per section:
   - Tokenize into sentences
   - Jaccard similarity: `|intersection| / |union|`
   - ≥0.8 → `AGREED` (use either, prefer A as primary)
   - 0.4-0.79 → `PARTIAL` (merge: take agreed sentences + flag diverged)
   - <0.4 → `DIVERGED` (enter debate)

4. Produce merge report:
```markdown
# Pingpong Merge Report

## Agreed Sections (auto-confirmed)
- ## Vision (92% agreement)
- ## Constraints (88% agreement)

## Partially Agreed (merged with notes)
- ## Requirements (65% — Model A has 6 reqs, Model B has 8. Merged to 9 with 2 flagged)

## Diverged (needs debate or user decision)
- ## Architecture: Model A recommends monolith, Model B recommends modular packages.

## Unique Sections
- ## Risk Assessment (Model B only — included pending review)
```

### Debate Protocol

For each DIVERGED section:

**Round 1: Critique**
- Model A reads Model B's version → writes critique (max 200 words)
- Model B reads Model A's version → writes critique (max 200 words)
(Parallel)

**Round 2: Response**
- Model A reads Model B's critique of A → revises or defends (max 200 words)
- Model B reads Model A's critique of B → revises or defends (max 200 words)
(Parallel)

**Round 3: Final Position**
- Model A states final position considering all debate (max 100 words)
- Model B states final position considering all debate (max 100 words)
(Parallel)

**Convergence check after Round 3:**
- Re-compute Jaccard on final positions
- ≥0.7 → CONVERGED (merge the agreed version)
- <0.7 → STILL DIVERGED (present both to user with tradeoffs)

### Final Merge Rules

1. AGREED sections → use as-is (Model A version as base)
2. PARTIAL sections → merge with `<!-- Model B addition -->` comments on diverged sentences
3. CONVERGED (from debate) → use the consensus version
4. STILL DIVERGED → present to user:
   ```
   ⚡ Design Pingpong: 2 sections could not be resolved automatically.

   ## Architecture
   Model A: Monolith with clear module boundaries
   Model B: Multi-package monorepo with npm workspaces

   Which approach? (A / B / merge manually)
   ```

---

## 4. New Workflow Files

| File | Purpose | Est. Lines |
|------|---------|-----------|
| `pivot.md` | Detect scope change, run impact analysis, re-route to discuss/plan | 300 |
| `rethink.md` | Revise specific decisions for a phase, propagate changes | 250 |
| `backtrack.md` | Restore to a rollback point, invalidate downstream artifacts | 200 |
| `reinforce.md` | Add requirements to current milestone, insert new phases | 250 |
| `where-am-i.md` | Complete status: phase, decisions, changes, blockers, decision history | 200 |
| `design-pingpong.md` | Cross-model design with merge + debate protocol | 400 |
| `impact-analysis.md` | Compute invalidation cascade from artifact changes | 250 |

---

## 5. Changes to Existing Workflows

| Workflow | Change |
|----------|--------|
| `discuss-phase.md` | Add `--cross-model` flag. When active, spawn parallel design tasks, merge CONTEXT.md outputs |
| `plan-phase.md` | Add `--cross-model` flag. When active, spawn parallel planning tasks, merge PLAN.md outputs |
| `research-phase.md` | Add `--cross-model` flag. Spawn both Claude researcher + Codex researcher |
| ALL workflows | Add artifact-hash check at start (via sunco-tools.cjs). If hash mismatch → impact analysis prompt |
| `new-project.md` | Add initial rollback point after PROJECT.md creation |
| `transition.md` | Create rollback point at each phase transition |

---

## 6. sunco-tools.cjs New Subcommands

```bash
# Artifact hash management
sunco-tools.cjs artifact-hash compute          # Hash all .planning/ files, store in .planning/.hashes.json
sunco-tools.cjs artifact-hash check            # Compare stored vs current hashes, return changed list

# Rollback points
sunco-tools.cjs rollback-point create --label "after-discuss-2"
sunco-tools.cjs rollback-point list            # Show all rollback points with labels
sunco-tools.cjs rollback-point restore --label "after-discuss-2"
sunco-tools.cjs rollback-point prune --older-than 30d  # Clean old points

# Impact analysis
sunco-tools.cjs impact-analysis --changed .planning/REQUIREMENTS.md
# Returns JSON: { invalidated: [...], maybe_invalidated: [...], warnings: [...] }
```
