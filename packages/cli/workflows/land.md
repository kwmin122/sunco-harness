# Land — Merge, Deploy, Verify

Merge the PR, wait for CI/deploy, verify production health. Picks up where `/sunco:ship` left off.

Non-interactive by default. Only stops for the pre-merge readiness gate and failure conditions.

---

## Step 1: Pre-flight

1. Check GitHub CLI:
```bash
gh auth status
```
If not authenticated: **STOP.** "GitHub CLI not authenticated. Run `gh auth login` first."

2. Parse arguments: `#NNN` for PR number, URL for health check.

3. If no PR number, detect from current branch:
```bash
gh pr view --json number,state,title,url,mergeStateStatus,mergeable,baseRefName,headRefName
```

4. Validate PR state:
   - No PR: **STOP.** "No PR found. Run `/sunco:ship` first."
   - MERGED: "PR already merged."
   - CLOSED: "PR is closed. Reopen first."
   - OPEN: continue.

---

## Step 2: Pre-merge Checks

```bash
gh pr checks --json name,state,status,conclusion
```

1. Required checks FAILING: **STOP.** Show failures.
2. Required checks PENDING: proceed to Step 3.
3. All pass (or none required): skip to Step 4.

Check merge conflicts:
```bash
gh pr view --json mergeable -q .mergeable
```
If CONFLICTING: **STOP.** "PR has merge conflicts. Resolve and push."

---

## Step 3: Wait for CI (if pending)

```bash
gh pr checks --watch --fail-fast
```

Timeout: 15 minutes. If CI fails: **STOP.** If timeout: **STOP.**

---

## Step 4: Pre-merge Readiness Gate

This is the critical safety check before an irreversible merge.

### 4a: Test results

Read CLAUDE.md for the project's test command. Run it:
```bash
# Use detected test command, default to vitest
npx vitest run 2>&1 | tail -20
```

If tests fail: **BLOCKER.**

### 4b: PR body accuracy

```bash
gh pr view --json body -q .body
git log --oneline $(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || echo main)..HEAD | head -20
```

Check for missing features, stale descriptions, wrong version.

### 4c: Readiness Report

```
╔══════════════════════════════════════════════════════════╗
║              PRE-MERGE READINESS REPORT                  ║
╠══════════════════════════════════════════════════════════╣
║  PR: #NNN — title                                        ║
║  Branch: feature → main                                  ║
║                                                          ║
║  CI:         PASS / PENDING / FAIL                       ║
║  Tests:      PASS (883/883) / FAIL (N failures)          ║
║  Conflicts:  NONE / CONFLICTING                          ║
║  PR Body:    Current / STALE                             ║
║                                                          ║
║  WARNINGS: N  |  BLOCKERS: N                             ║
╚══════════════════════════════════════════════════════════╝
```

Use AskUserQuestion:
- A) Merge — readiness checks passed
- B) Don't merge yet — address warnings first
- C) Merge anyway — I understand the risks

If B: **STOP.** List exactly what needs to be done.

---

## Step 5: Merge

```bash
gh pr merge --auto --delete-branch
```

If `--auto` not available:
```bash
gh pr merge --squash --delete-branch
```

If permission error: **STOP.**

If merge queue active: poll `gh pr view --json state -q .state` every 30s, up to 30 min.

Record merge commit SHA and timestamp.

---

## Step 6: Deploy Detection

```bash
# Auto-detect platform
[ -f fly.toml ] && echo "PLATFORM:fly"
[ -f vercel.json ] || [ -d .vercel ] && echo "PLATFORM:vercel"
[ -f netlify.toml ] && echo "PLATFORM:netlify"
[ -f render.yaml ] && echo "PLATFORM:render"

# Detect deploy workflows
for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  [ -f "$f" ] && grep -qiE "deploy|release|production|cd" "$f" 2>/dev/null && echo "DEPLOY_WORKFLOW:$f"
done
```

If deploy workflow found: wait for it (poll `gh run list` and `gh run view`).

If Vercel/Netlify (auto-deploy): wait 60s for propagation.

If no deploy and no URL: ask if this project has a web deploy or skip verification.

Deploy timeout: 20 minutes. On failure: offer investigate, revert, or continue.

---

## Step 7: Health Check (if URL provided)

```bash
# Basic health check
curl -sf "<url>" -o /dev/null -w "%{http_code}\n%{time_total}" 2>/dev/null
```

Verify:
- HTTP 200 response
- Response time < 10s
- No obvious error page (check for common error strings)

If healthy: mark as VERIFIED.
If issues: present via AskUserQuestion with revert option.

---

## Step 8: Revert (if needed)

```bash
BASE=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || echo main)
git fetch origin $BASE
git checkout $BASE
git revert <merge-commit-sha> --no-edit
git push origin $BASE
```

If conflicts: warn for manual resolution.
If push protections: suggest revert PR instead.

---

## Step 9: Deploy Report

```bash
mkdir -p .sun/deploy-reports
```

```
LAND & DEPLOY REPORT
═════════════════════
PR:           #<number> — <title>
Branch:       <head> → <base>
Merged:       <timestamp>
Merge SHA:    <sha>

Timing:
  CI wait:    <duration>
  Deploy:     <duration or "no workflow">
  Health:     <duration or "skipped">
  Total:      <end-to-end>

CI:           PASSED / SKIPPED
Deploy:       PASSED / FAILED / NO WORKFLOW
Health:       HEALTHY / DEGRADED / SKIPPED

VERDICT: DEPLOYED AND VERIFIED / DEPLOYED (UNVERIFIED) / REVERTED
```

Save to `.sun/deploy-reports/{date}-pr{number}.md`.

---

## Step 10: Follow-ups

- If URL verified: "Run `/sunco:canary <url>` for extended monitoring."
- If performance data collected: "Run `/sunco:benchmark` for deep audit."

---

## Important Rules

- **Never force push.** Use `gh pr merge` which is safe.
- **Never skip CI.** If checks are failing, stop.
- **Auto-detect everything.** Only ask when information can't be inferred.
- **Poll with backoff.** 30-second intervals, reasonable timeouts.
- **Revert is always an option.** Offer at every failure point.
- **Single-pass verification.** `/sunco:land` checks once. `/sunco:canary` does extended monitoring.
- **Clean up.** Delete feature branch after merge via `--delete-branch`.
