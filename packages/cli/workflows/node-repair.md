# Node Repair Workflow

Diagnose and repair broken Node.js environment issues that block SUNCO from running. Checks Node.js version, npm integrity, global binary paths, and common workspace corruption patterns, then applies targeted fixes. Used by `/sunco:node-repair`.

---

## Overview

Four steps:

1. **Diagnose** — run environment checks and identify failures
2. **Classify issues** — group into auto-fixable vs. manual-fix required
3. **Repair** — apply fixes for auto-fixable issues
4. **Verify** — re-run checks to confirm the environment is healthy

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--check-only` | `CHECK_ONLY` | false |
| `--fix-all` | `FIX_ALL` | false |
| `--verbose` | `VERBOSE` | false |

`--check-only`: diagnose only, do not apply any fixes.
`--fix-all`: apply all auto-fixable repairs without asking for each one.

---

## Step 2: Run Environment Checks

Run all checks and collect results. Do not stop on first failure — collect everything.

### Check 1: Node.js version

```bash
NODE_VERSION=$(node --version 2>/dev/null)
NODE_EXIT=$?
```

Expected: `v22.x.x` or `v24.x.x` (LTS versions).

| Result | Status |
|--------|--------|
| Missing (exit non-zero or command not found) | FAIL — critical |
| Version < 18 | FAIL — too old |
| Version 18 or 20 | WARN — not recommended for SUNCO |
| Version 22 or 24 | PASS |
| Version > 24 | WARN — may have compatibility issues |

### Check 2: npm version

```bash
NPM_VERSION=$(npm --version 2>/dev/null)
```

Expected: `10.x` or `11.x`.

| Result | Status |
|--------|--------|
| Missing | FAIL — critical |
| < 9 | FAIL — too old |
| 9 or 10 | WARN — upgrade recommended |
| 11+ | PASS |

### Check 3: Node.js executable path

```bash
NODE_PATH=$(which node 2>/dev/null)
NPM_PATH=$(which npm 2>/dev/null)
```

Check if `node` and `npm` resolve to the same prefix:
```bash
NODE_PREFIX=$(dirname "$(dirname "$NODE_PATH")" 2>/dev/null)
NPM_PREFIX=$(npm prefix -g 2>/dev/null)
```

If prefixes differ: WARN — possible version manager conflict (nvm, fnm, homebrew mixed).

### Check 4: Global npm prefix and PATH

```bash
GLOBAL_BIN=$(npm bin -g 2>/dev/null || npm root -g | sed 's|/node_modules||')/bin
```

Check if `GLOBAL_BIN` is in `PATH`:
```bash
echo "$PATH" | tr ':' '\n' | grep -qF "$GLOBAL_BIN"
```

If not in PATH: FAIL — sunco global binary will not be found.

### Check 5: sunco-tools binary availability

```bash
SUNCO_BIN=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" --version 2>/dev/null)
SUNCO_EXIT=$?
```

| Result | Status |
|--------|--------|
| Exits 0 with version | PASS |
| Command not found | FAIL — sunco not installed globally |
| Exits with error | FAIL — installation is corrupt |

### Check 6: node_modules integrity in current project

```bash
# Check that package.json exists
HAS_PKG=$(test -f package.json && echo yes || echo no)

# Check node_modules is present
HAS_MODULES=$(test -d node_modules && echo yes || echo no)

# Check package-lock.json is in sync (use npm ls to detect issues)
NPM_LS_EXIT=$(npm ls --depth=0 > /dev/null 2>&1; echo $?)
```

If `HAS_PKG=yes` and `HAS_MODULES=no`: FAIL — dependencies not installed.
If `NPM_LS_EXIT != 0`: WARN — package tree may have integrity issues.

### Check 7: TypeScript compiler availability

```bash
TSC_VERSION=$(npx tsc --version 2>/dev/null)
TSC_EXIT=$?
```

If not available: WARN — `npx tsc` may be slow on first run but will work.

---

## Step 3: Display Diagnosis

```
Node.js environment diagnosis

  Node.js:          {NODE_VERSION}         {PASS|WARN|FAIL}
  npm:              {NPM_VERSION}          {PASS|WARN|FAIL}
  Executable paths: {consistent|mismatch} {PASS|WARN}
  Global bin in PATH: {yes|no}            {PASS|FAIL}
  sunco-tools:      {version|missing}     {PASS|FAIL}
  node_modules:     {present|missing}     {PASS|FAIL}
  Package integrity: {ok|issues}          {PASS|WARN}
  TypeScript:       {version|missing}     {PASS|WARN}

{N} issue(s) found: {critical_count} critical, {warn_count} warnings
```

If all checks pass:
```
Environment looks healthy. No repairs needed.
```

Stop (unless `--fix-all` was explicitly passed, in which case confirm nothing to fix and stop).

---

## Step 4: Classify Issues

Group findings:

**Auto-fixable:**
- `node_modules` missing → `npm install`
- Package integrity issues → `npm ci`
- Global bin not in PATH → print exact `export PATH=...` command

**Manual-fix required (print instructions only):**
- Node.js version too old → explain how to update via nvm/fnm/homebrew
- npm version too old → `npm install -g npm@latest`
- sunco not installed globally → `npm install -g popcoru`
- Node/npm prefix mismatch → explain version manager consolidation
- Node.js missing entirely → link to nodejs.org

---

## Step 5: Apply Auto-Fixes

For each auto-fixable issue, if not `--check-only`:

If not `--fix-all`: ask before each fix:
```
Fix: run "npm install" to restore node_modules? [y/n]
```

### Fix: node_modules missing or corrupt

```bash
echo "Running npm install..."
npm install 2>&1
```

If `npm install` exits non-zero: escalate to `npm ci` if `package-lock.json` exists, otherwise report failure.

### Fix: PATH issue

Print the exact command for the user to add to their shell profile:
```
Add this to your shell profile (~/.zshrc or ~/.bashrc):

  export PATH="$(npm bin -g):$PATH"

Then reload: source ~/.zshrc
```

(Cannot auto-fix PATH — it requires shell profile editing outside this process.)

---

## Step 6: Verify Repairs

After applying fixes, re-run the affected checks:

```bash
# Re-run only the checks that were in FAIL or WARN state
```

Report updated status:
```
After repair:

  node_modules:     present     PASS  (was: missing)
  Package integrity: ok         PASS  (was: issues)
```

If all critical issues are resolved:
```
Environment repaired. SUNCO should now work correctly.
Run: sunco health
```

If manual-fix issues remain:
```
Remaining issues require manual action:

  {list with specific instructions for each}

After fixing, re-run: /sunco:node-repair
```

---

## Error Handling

| Error | Response |
|-------|----------|
| `npm install` fails | Show full error output, suggest `npm ci` as alternative |
| `npm ci` fails | Show error, suggest clearing `node_modules` manually and retrying |
| Node.js not found at all | Print download instructions for nodejs.org and nvm |
| sunco not installed globally | Print `npm install -g popcoru`, explain it is needed for sunco-tools |
| Version manager conflict (nvm + homebrew) | Explain the conflict, suggest picking one |
