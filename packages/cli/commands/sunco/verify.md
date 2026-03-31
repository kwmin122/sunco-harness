---
name: sunco:verify
description: 6-layer Swiss cheese verification for a completed phase. Run after /sunco:execute. Each layer catches different failure modes.
argument-hint: "<phase> [--layer N] [--skip-adversarial]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number. Required.

**Flags:**
- `--layer N` — Run only layer N (1-6). Use when re-running after fixing specific issues.
- `--skip-adversarial` — Skip Layer 5 (adversarial test). Use for non-security-critical phases.
- `--skip-codex` — Skip Layer 6 (cross-model). Use when Codex plugin is not installed.
</context>

<objective>
Run 6-layer Swiss cheese verification to catch defects that individual checks miss.

**The 6 Layers:**
1. Multi-agent cross-review — independent review from fresh context
2. Guardrails — deterministic lint + health check
3. BDD criteria check — acceptance criteria from PLAN.md
4. Permission audit — file access, network, git boundary check
5. Adversarial test — try to break it
6. Cross-model verification (Codex) — eliminates same-model bias

**Creates/Updates:**
- `.planning/phases/[N]-*/[N]-VERIFICATION.md` — verification results with pass/fail per layer

**After this command:** Run `/sunco:ship [N]` if all layers pass, or fix issues and re-run.
</objective>

<process>
## Preparation

Read:
1. `.planning/phases/[N]-*/[N]-CONTEXT.md` — decisions and acceptance criteria
2. `.planning/phases/[N]-*/*-PLAN.md` — all plans with `done_when` criteria
3. `.planning/phases/[N]-*/*-SUMMARY.md` — execution summaries
4. `.planning/REQUIREMENTS.md` — requirements this phase covers

Determine which layer(s) to run based on $ARGUMENTS.

---

## Layer 1: Multi-agent cross-review

Spawn 2 independent review agents with fresh context. Each agent:
1. Reads the phase plans and summaries
2. Reads the modified code files
3. Reviews independently without seeing the other agent's output

**Agent 1** — name: `sunco-reviewer` description: `Code review Phase [N]`
**Agent 2** — name: `sunco-security` description: `Security review Phase [N]`

**Agent 1 prompt:**
"You are a senior engineer reviewing Phase [N] implementation. Read the plan at [path] and the modified files listed in files_modified. Review for:
- Correctness: does the implementation match the plan?
- Code quality: are there obvious issues?
- Missing edge cases
Report findings as: PASS / WARN [detail] / FAIL [detail]"

**Agent 2 prompt:**
"You are a security-focused engineer reviewing Phase [N]. Read [same files].
Review for:
- Security issues (injection, path traversal, unvalidated input)
- Error handling gaps
- Resource leaks
Report findings as: PASS / WARN [detail] / FAIL [detail]"

Collect findings. Any FAIL from either agent = Layer 1 FAIL.

---

## Layer 2: Guardrails (deterministic)

Run in sequence:

```bash
# Lint check
sunco lint
# or fallback:
npx eslint packages/ --max-warnings 0
npx tsc --noEmit
```

```bash
# Health check
sunco health
# or fallback:
node --version
npm list --depth=0 2>/dev/null | head -20
```

Run tests:
```bash
npx vitest run --reporter=verbose 2>&1 | tail -30
```

Layer 2 PASS = lint zero errors + tsc zero errors + tests pass.
Layer 2 FAIL = any of the above has errors (warnings allowed for health only).

---

## Layer 3: BDD criteria check

For each plan's `done_when` checklist:
1. Read each criterion
2. Verify it is met (check file exists, function exported, test passes, etc.)
3. Mark as PASS or FAIL with evidence

For acceptance_criteria in each task:
- Check each criterion can be verified programmatically or via inspection
- Run any verifiable checks

Layer 3 PASS = all done_when criteria met for all plans.
Layer 3 FAIL = any criterion unmet.

---

## Layer 4: Permission audit

Check that the implementation did not exceed planned boundaries:

1. **File access audit** — Compare files actually modified (via git diff HEAD~N) against `files_modified` in PLAN.md frontmatter.
   - Files not in PLAN = unauthorized modification (flag as WARN)

2. **Network audit** — Scan modified files for `fetch(`, `axios.`, `http.get`, `https.get`:
   - If found and `allowNetwork: false` in plan = WARN

3. **Git boundary** — Check no commits went outside the phase's intended scope:
   ```bash
   git log --oneline -[N] --name-only
   ```
   - Commits touching `.planning/` from execution agents = WARN (should only be summaries)

4. **Sensitive file audit** — Check no secrets committed:
   ```bash
   git diff HEAD~[N] -- "*.env" "*.key" "*.pem" "secrets*"
   ```

Layer 4 PASS = no FAILs. WARNs are noted but don't block.
Layer 4 FAIL = sensitive files committed or major scope violation.

---

## Layer 5: Adversarial test (skip if --skip-adversarial)

Spawn an adversarial agent — name: `sunco-adversarial` description: `Break Phase [N]`

**Adversarial agent prompt:**
"You are a malicious user trying to break the Phase [N] implementation.
Read the code at [modified files].
Try to:
1. Find inputs that cause crashes or unexpected behavior
2. Find ways to bypass intended restrictions
3. Find race conditions or state corruption
4. Find error paths that are not handled

For each issue found: describe the attack vector and impact.
If you cannot break it after 10 minutes of trying: report PASS."

Layer 5 PASS = no critical vulnerabilities found.
Layer 5 FAIL = exploitable crash or security bypass found.

---

## Layer 6: Cross-model verification (skip if --skip-codex)

Eliminates same-model bias by running adversarial review through a different AI model (OpenAI Codex).

**Detection:** Check if `/codex:adversarial-review` is available:
```bash
ls ~/.claude/commands/codex/ 2>/dev/null
```

**If Codex plugin installed:**

Invoke `/codex:adversarial-review` with the phase diff:
```
/codex:adversarial-review <phase>
```

This runs an independent review through OpenAI's model, catching blind spots that Claude might consistently miss due to same-model bias.

**If Codex plugin NOT installed:**

Skip gracefully. Output:
```
Layer 6 (Cross-model): SKIPPED — Codex plugin not installed.
Install: /plugin marketplace add openai/codex-plugin-cc && /plugin install codex@openai-codex
```

Layer 6 PASS = Codex finds no critical issues.
Layer 6 FAIL = Codex identifies exploitable or structural issues.
Layer 6 SKIPPED = plugin not installed (does not block overall verification).

---

## Write VERIFICATION.md

```markdown
# Phase [N] Verification Results

## Summary
- Layer 1 (Multi-agent review): [PASS/WARN/FAIL]
- Layer 2 (Guardrails): [PASS/FAIL]
- Layer 3 (BDD criteria): [PASS/FAIL] ([N]/[total] criteria met)
- Layer 4 (Permission audit): [PASS/WARN/FAIL]
- Layer 5 (Adversarial): [PASS/WARN/FAIL/SKIPPED]
- Layer 6 (Cross-model Codex): [PASS/WARN/FAIL/SKIPPED]

## Overall: [PASS / NEEDS FIXES]

## Layer 1 Details
[agent findings]

## Layer 2 Details
[lint/test output summary]

## Layer 3 Details
| Criterion | Status | Evidence |
|-----------|--------|----------|

## Layer 4 Details
[audit findings]

## Layer 5 Details
[adversarial findings]

## Layer 6 Details
[cross-model findings or SKIPPED reason]

## Issues to Fix
- [ ] [issue 1]
- [ ] [issue 2]
```

## Route

If OVERALL PASS: "All 6 layers passed. Run `/sunco:ship [N]` to create the PR."
If NEEDS FIXES: "Fix the issues listed above, then re-run `/sunco:verify [N]`."
</process>
