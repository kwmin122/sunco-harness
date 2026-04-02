---
name: sunco:update
description: Update SUNCO to the latest version. Shows changelog before updating. Preserves local customizations.
argument-hint: "[--check] [--changelog-only]"
allowed-tools:
  - Read
  - Bash
  - Write
---

<context>
**Flags:**
- `--check` — Check if an update is available without installing.
- `--changelog-only` — Show changelog for the latest version without updating.
</context>

<objective>
Update SUNCO to the latest version via npx popcoru@latest. Shows what changed before updating so you can decide whether to proceed.
</objective>

<process>
## Step 1: Check current version

```bash
# Read installed version via sunco-tools.cjs (queries runtime registry)
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" runtimes current-version
```

Parse the JSON output — `version` field is the installed version.

## Step 2: Check available version

```bash
npm view popcoru version 2>/dev/null
```

Compare: current vs latest.

If `--check` in $ARGUMENTS:
Show: "Current: [version] | Latest: [latest] | [up to date / update available]"
Stop here.

## Step 3: Fetch changelog

```bash
npm view popcoru dist-tags.latest
npm view popcoru description
```

Or fetch from GitHub releases if available.

Show changelog for versions between current and latest:
```
== SUNCO Update ==

Current: v[current]
Latest:  v[latest]

What's new in v[latest]:
[changelog content]
```

If `--changelog-only`: stop here.

## Step 4: Run update

```bash
npx popcoru@latest
```

This handles:
- Downloading latest version
- Installing to same location (detected runtimes)
- Preserving local skill customizations
- Updating command files, hooks, workflows
- Auto-registering statusLine in settings.json
- Writing just-upgraded marker for welcome message

## Step 5: Verify

```bash
# Check version across all installed runtimes via registry
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" runtimes installed
```

Parse the JSON output — each entry has `runtimeId`, `dir`, and `version`. Confirm all match the expected new version.

## Step 6: Report

Show:
```
SUNCO updated: v[old] → v[new]

Key changes:
[top 3 from changelog]

Your customizations were preserved.
Run /sunco:help to see any new commands.
```
</process>
