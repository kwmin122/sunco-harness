# Update Workflow

Self-update SUNCO to the latest published version. Checks the npm registry for the current version, compares to what's installed, shows a changelog preview, downloads and applies the update, verifies the new binary works, and writes a `.sun/just-upgraded-from` marker so the next session can greet the user with what changed. Used by `/sunco:update`.

---

## Overview

Six steps:

1. **Check current version** — installed version vs. npm registry
2. **Show changelog** — what changed in the new version
3. **Confirm** — ask user before downloading
4. **Download and apply** — npm install -g or equivalent
5. **Verify** — confirm new binary responds correctly
6. **Write upgrade marker** — `.sun/just-upgraded-from` for post-upgrade greeting

---

## Step 1: Check Current Version

Get the installed version and the latest published version:

```bash
# What's currently installed — sunco-tools.cjs queries the runtime registry
CURRENT_VERSION=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" runtimes current-version | node -e "
  let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).version));
")

# What's on npm
LATEST_VERSION=$(npm view popcoru version 2>/dev/null)

# Full version info from registry
npm view popcoru versions --json 2>/dev/null | tail -5
```

Compare versions. If already on latest:

```
SUNCO is up to date.

Installed: v[X.Y.Z]
Latest:    v[X.Y.Z]

Force reinstall? (yes / no)
```

If force=no: exit with "Already on latest version."
If force=yes: continue to Step 3 (skip Step 2 changelog).

If newer version exists:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO UPDATE AVAILABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Installed: v1.1.2
Latest:    v1.2.0

Fetching changelog...
```

---

## Step 2: Show Changelog

Fetch the changelog from npm metadata or the package's GitHub releases:

```bash
# Try npm changelog field
npm view popcoru@latest changelog 2>/dev/null

# Fall back to GitHub releases
REPO=$(npm view popcoru repository.url 2>/dev/null)
# Parse owner/repo from REPO url, then:
gh release view v${LATEST_VERSION} --repo [owner/repo] 2>/dev/null || true
```

If changelog is found, display the entries from current version to latest:

```
What's new in v1.2.0:

  New commands:
    /sunco:ui-phase    Generate UI design contract before planning
    /sunco:forensics   Post-mortem investigation for failed phases

  Improvements:
    verify-work   Session resume now loads from UAT.md frontmatter
    resume        HANDOFF.md parsed first (structured context wins)

  Fixes:
    plan-phase    Discovery depth=verify no longer creates empty DISCOVERY.md
    execute       Progress bar percentage corrected for skipped plans

  Breaking changes: none
```

If no changelog available:

```
Changelog not available for v[X.Y.Z].
Update anyway? (yes / no)
```

---

## Step 3: Confirm

Ask inline: "Update from v1.1.2 to v1.2.0? (yes / no)"

If no: exit without changes.
If yes: continue to Step 4.

---

## Step 4: Download and Apply

Always use `npx popcoru@latest` — the installer handles everything:

```bash
npx popcoru@latest
```

The installer (`install.cjs`) automatically:
- Copies commands, workflows, hooks, agents to the target runtime directory
- Patches `settings.json` hooks (SessionStart update checker)
- Registers `statusLine` command in `settings.json` (context gauge, tokens, cost)
- Writes VERSION file and just-upgraded-from marker
- Preserves user's existing settings

---

## Step 5: Artifact Gate (mandatory, runtime-aware)

Verify the update produced a working runtime for ALL installed runtimes:

```bash
# Query installed runtimes via sunco-tools.cjs (reads from runtime registry)
INSTALLED=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" runtimes installed)

# For each installed runtime, verify:
#   1. sunco-tools.cjs runs
#   2. VERSION file matches expected
#   3. ESM package.json exists
# Parse the JSON and check each runtime's binDir
```

The agent should parse the JSON output from `sunco-tools.cjs runtimes installed` and verify each runtime entry:
- Run `node <binDir>/sunco-tools.cjs --help` to confirm the binary works
- Confirm `version` matches `$LATEST_VERSION`
- Confirm `<binDir>/package.json` exists with `type: "module"`

**All checks must pass for all installed runtimes.** If ANY check fails:

```
Update artifact-gate FAILED.
Do not proceed. Report the failing check and runtime to the user.
```

Do not proceed to Step 6 if artifact-gate failed.

---

## Step 6: Write Upgrade Marker

Write global upgrade marker as JSON (read by SessionStart hook for welcome message):

```bash
mkdir -p ~/.sun
cat > ~/.sun/just-upgraded-from << MARKER
{"from":"${OLD_VERSION}","to":"${NEW_VERSION}","upgraded_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
MARKER
```

This file is consumed (read + deleted) by the SessionStart hook on the next session.

Display completion:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO UPDATED  v1.1.2 → v1.2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

New commands available:
  /sunco:ui-phase     Generate UI design contract
  /sunco:forensics    Post-mortem investigation

Next: /clear  — restart with new version
```

---

## Success Criteria

- [ ] Installed version and latest version compared
- [ ] Changelog displayed (or "not available" noted)
- [ ] User confirmed before any download
- [ ] Install command succeeded with no errors
- [ ] VERSION file in each installed runtime returns expected new version
- [ ] `~/.sun/just-upgraded-from` written with from/to/upgraded_at
- [ ] User told to `/clear` and restart
