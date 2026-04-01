# ISSUE-001: Adaptive Lifecycle + Multi-Model Design Pingpong

## Problem

SUNCO's current lifecycle is linear: new → discuss → plan → execute → verify → ship.
Real projects are nonlinear: users pivot, add requirements mid-phase, rethink decisions, backtrack.

Currently there is NO automated support for:
- Pivoting an entire project direction
- Adding requirements after planning started
- Reversing a decision made in discuss phase
- Reinforcing an existing implementation with new features mid-milestone

Additionally, all design/planning is single-model (Claude only). No cross-model validation at the design stage.

## Requirements

### Adaptive Lifecycle

1. **Pivot Detection**: When user says "actually, let's change direction" or modifies PROJECT.md/REQUIREMENTS.md directly, SUNCO should automatically detect the change scope and route to the right workflow.

2. **Impact Analysis**: Any change to upstream artifacts (PROJECT.md, REQUIREMENTS.md, ROADMAP.md) must trigger automatic impact analysis — which phases are affected? Which plans are invalidated? Which code needs revision?

3. **Automatic Routing**: Based on what changed, SUNCO routes to the right action:
   - PROJECT.md changed → re-evaluate all requirements and roadmap
   - REQUIREMENTS.md changed → re-evaluate affected phases and plans
   - CONTEXT.md changed → invalidate plans for that phase
   - ROADMAP.md changed → re-evaluate state tracking

4. **Never Lost**: At ANY point in the lifecycle, user can ask "where am I?" and get a complete answer: current phase, what's done, what's pending, what decisions are locked, what's been changed since last stable point.

5. **Rollback Points**: Every significant state change creates a rollback point. User can say "go back to before I changed the auth decision" and SUNCO restores that state.

### Multi-Model Design Pingpong

6. **Parallel Design**: When `--cross-model` flag is used with discuss/plan/research, spawn TWO independent design agents (Claude + Codex) with identical input.

7. **Merge Engine**: Compare the two outputs. Produce:
   - AGREED: sections both models produced similarly → confirmed
   - DIVERGED: sections where models differ → flagged for resolution

8. **Debate Round**: For DIVERGED items, each model critiques the other's design. Maximum 3 rounds. If still diverged, present both options to user with tradeoffs.

9. **Final Merge**: Produce a single merged artifact that combines the best of both designs.

## Proposed New Commands/Flags

```
/sunco:pivot              # Detect changes, analyze impact, re-route
/sunco:rethink <phase>    # Revise decisions for a specific phase
/sunco:backtrack <decision-id>  # Reverse a specific decision
/sunco:reinforce          # Add new requirements to current milestone
/sunco:where-am-i         # Complete status with decision history

# Cross-model flags (applicable to any design command)
/sunco:discuss N --cross-model
/sunco:plan N --cross-model
/sunco:research N --cross-model
```

## Design Questions

1. How should pivot detection work? Hook on file changes? Explicit command? Both?
2. What is the rollback granularity? Per-commit? Per-phase? Per-decision?
3. How should the merge engine handle structural differences (different number of phases, different requirement categorization)?
4. Should cross-model be default for important decisions, or always opt-in?
5. How to handle token budget when running two models in parallel?
6. Should the debate have a moderator (user? third model?) or be self-resolving?

## Success Criteria

- User can pivot a project at any stage and SUNCO automatically re-routes
- Impact analysis correctly identifies all affected artifacts
- Cross-model design produces measurably better plans than single-model
- User never feels "lost" — /sunco:where-am-i always works
- Rollback to any previous decision point takes <30 seconds
