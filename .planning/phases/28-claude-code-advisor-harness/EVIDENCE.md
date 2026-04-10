# Phase 28 — Advisor Harness Runtime Evidence

**Date:** 2026-04-11  
**Environment:** Claude Code CLI version 2.1.100 (Claude Code)

## Transport verification

### Subagent path

- `.claude/agents/sunco-advisor.md` exists: YES
- Frontmatter `model: opus` present: YES
- Subagent invocation succeeded: NO (CLI accepted `--agent sunco-advisor` and exited, but no advisor model output — API usage limit returned instead)
- Signature `[sunco-advisor v1 model=opus]` in response: NO (response was API quota / usage limit, not model text)

### CLI flag path

- `claude --help` mentions --model flag: YES

## Verdict

- [ ] PASS — advisor demonstrably runs via subagent
- [x] LIMITED — advisor runs but signature not verified
- [ ] BLOCKED — transport doesn't work

**Notes:** `packages/core/src/agent/advisor.ts` contains `AdvisorRunner` (Phase 28 harness). Runtime smoke reached Claude Code but the session returned a usage-limit message instead of model output, so the Opus signature line could not be confirmed in this run.

## Raw output

```
Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.
You've hit your limit · resets 1am (Asia/Seoul)
```

EXIT code from wrapper: 1
