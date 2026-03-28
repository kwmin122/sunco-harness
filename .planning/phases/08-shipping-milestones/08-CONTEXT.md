# Phase 8: Shipping + Milestones - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-selected

<domain>
## Phase Boundary

3 skill clusters: shipping (`sunco ship`, `sunco release`), milestone management (`sunco milestone new/audit/complete/summary/gaps`). Ship creates PRs with verification pre-checks. Release handles versioning and npm publish. Milestone manages the full lifecycle from creation to completion.

7 requirements: SHP-01, SHP-02, WF-03, WF-04, WF-05, WF-06, WF-07

</domain>

<decisions>
## Implementation Decisions

### sunco ship — PR Creation with Quality Gates (SHP-01)
- **D-01:** Ship flow: (1) Run sunco verify as pre-check, (2) Create git branch if needed, (3) Push to remote, (4) Create PR via `gh` CLI or simple-git, (5) Report pass/fail with link.
- **D-02:** Verification pre-check calls ctx.run('workflow.verify') internally. If verify returns FAIL, ship blocks with clear error showing which layers failed.
- **D-03:** PR creation uses `execa` to call `gh pr create` (GitHub CLI). Fallback: show git push command for manual PR creation.
- **D-04:** PR body auto-generated from: phase context, plan summaries, verification results, changelog since last tag.

### sunco release — Version + Publish (SHP-02)
- **D-05:** Release flow: (1) Bump version in package.json files, (2) Generate/update CHANGELOG.md, (3) Create git tag, (4) Run `npm publish` (or dry-run with `--dry-run`).
- **D-06:** Version bump: semver-based (--major/--minor/--patch flags, default patch). Updates root + all workspace package.json files.
- **D-07:** Deterministic skill (kind: 'deterministic') — no agent needed. Pure git + npm operations.

### sunco milestone — Lifecycle Management (WF-03 through WF-07)
- **D-08:** `milestone new` (WF-03): Interactive setup for next milestone. Prompts for name/goal, creates PROJECT.md milestone section, runs abbreviated new-project flow (questions → roadmap).
- **D-09:** `milestone audit` (WF-04): Agent-powered audit comparing milestone intent (from PROJECT.md) against actual delivery (from VERIFICATION.md files). Produces audit report with achievement score.
- **D-10:** `milestone complete` (WF-05): Archives completed milestone: moves .planning/ to .planning/archive/{milestone}/, creates git tag, updates PROJECT.md status.
- **D-11:** `milestone summary` (WF-06): Agent-powered comprehensive report: work done, decisions made, lessons learned, metrics. For team onboarding and stakeholder review.
- **D-12:** `milestone gaps` (WF-07): Reads audit report, identifies unmet requirements, auto-generates catch-up phases in ROADMAP.md.
- **D-13:** Milestone subcommands use Commander.js positional args: `sunco milestone new`, `sunco milestone audit`, etc.
- **D-14:** `milestone new` and `milestone summary` are kind: 'prompt' (agent-powered). Others are kind: 'deterministic'.

### Shared Infrastructure
- **D-15:** All skills in `packages/skills-workflow/src/` — ship.skill.ts, release.skill.ts, milestone.skill.ts.
- **D-16:** Reuse simple-git for branch/tag/push operations. Reuse execa for gh/npm CLI calls.
- **D-17:** Milestone data stored in PROJECT.md (milestone sections) and STATE.md (current milestone).

### Claude's Discretion
- PR body template formatting
- CHANGELOG generation format
- Milestone audit scoring algorithm
- Summary report structure
- Gap-to-phase mapping heuristics

</decisions>

<canonical_refs>
## Canonical References

### Phase 1 Core
- `packages/core/src/skill/types.ts` — defineSkill, SkillContext
- `packages/core/src/recommend/rules.ts` — Recommender rules (ship/release transitions)

### Phase 3 Git
- `packages/skills-workflow/src/shared/git-state.ts` — captureGitState()

### Phase 5 Planning
- `packages/skills-workflow/src/shared/phase-reader.ts` — readPhaseDir()
- `packages/skills-workflow/src/shared/planning-writer.ts` — writePlanningArtifact()

### Phase 7 Verification
- `packages/skills-workflow/src/verify.skill.ts` — ctx.run('workflow.verify') for pre-check

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `simple-git` for branch/tag/push
- `execa` for gh CLI and npm publish
- `ctx.run('workflow.verify')` for verification pre-check
- `writePlanningArtifact()` for writing audit/summary reports
- `captureGitState()` for branch tracking
- `readPhaseDir()` for finding verification reports

### Integration Points
- Skills in `packages/skills-workflow/src/`
- CLI wiring follows established pattern

</code_context>

<specifics>
## Specific Ideas

- Ship should feel like the "one-click deploy" — verify → PR → done
- Release is deterministic — no agent needed, just git + npm
- Milestone management is the meta-layer — managing the project lifecycle itself

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 08-shipping-milestones*
*Context gathered: 2026-03-28 via auto mode*
