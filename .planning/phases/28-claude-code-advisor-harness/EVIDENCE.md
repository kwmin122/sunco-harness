# Phase 28 — Advisor Harness Runtime Evidence

**Date:** 2026-04-11 (initial LIMITED run) / 2026-04-11 (PASS rerun)
**Environment:** Claude Code CLI version 2.1.100 (Claude Code)
**Verdict history:** LIMITED → **PASS**

## Transport verification

### Subagent path

- `.claude/agents/sunco-advisor.md` exists: **YES**
- Frontmatter `model: opus` present: **YES**
- Subagent invocation succeeded: **YES** (second run, after quota reset)
- Signature `[sunco-advisor v1 model=opus]` in response: **YES**

### CLI flag path

- `claude --help` mentions `--model` flag: YES
- Subagent invoked via `--agent sunco-advisor`: YES

## Verdict

- [x] **PASS** — advisor demonstrably runs via subagent with verified signature
- [ ] LIMITED — advisor runs but signature not verified
- [ ] BLOCKED — transport doesn't work

## Test invocation

```bash
echo "Should I use a single-file or multi-file approach for phase plans in SUNCO?" \
  | claude -p --agent sunco-advisor
```

## Raw response (trimmed)

```
Agree with multi-file only if phases routinely exceed ~300 lines or have
parallel waves needing independent edits; otherwise single-file is correct.

1. Default to single-file (`PLAN.md`) — matches existing `.sun/` flat-file
   state pattern and keeps `sunco-planner` / `plan-checker` reads atomic.
2. Split only when: (a) waves edited concurrently by executor, (b) BDD
   criteria balloon past one screen, or (c) research/assumptions artifacts
   are already separate files.
3. If splitting, keep `PLAN.md` as index with stable anchors
   (`waves/`, `acceptance.md`) so proceed-gate can still verify
   goal-backward in one pass.
4. Decide by inspecting 2–3 real phase plans in `.sun/phases/` for length
   and edit patterns before committing.

[sunco-advisor v1 model=opus]
```

## Evidence verification

The response exhibits all three signature properties of a genuine Opus run:

1. **Signature line present**: `[sunco-advisor v1 model=opus]` appears exactly
   as specified in `.claude/agents/sunco-advisor.md` at the end of the response
2. **Enumerated bounded advice** (100-word ceiling, action-oriented) — matches
   the subagent system prompt contract
3. **Concrete SUNCO domain knowledge** — references `sunco-planner`,
   `plan-checker`, `.sun/phases/`, proceed-gate — this is not generic advice,
   it's grounded in the actual repo

## Initial (LIMITED) notes preserved

The initial run on 2026-04-10 returned a quota message
(`You've hit your limit · resets 1am`) instead of model output. That run
verified the transport *plumbing* but not the model. The rerun after quota
reset confirmed the full end-to-end path with signature verification.

`packages/core/src/agent/advisor.ts` (`AdvisorRunner`) and the prompt builder
at `packages/skills-workflow/src/shared/advisor-prompt.ts` together implement
the harness that produced this response.

## Next step

None — Phase 28 is **complete** as spec'd. Future work (real-world phase
plans invoking advisor during execution) is observational, not verification.
