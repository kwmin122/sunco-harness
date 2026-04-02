---
name: sunco:artifact-gate
description: Artifact-level verification gate — validates release artifacts match product contracts
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

<objective>
STOP-THE-LINE gate that validates built release artifacts match what the product contracts promise. The tarball contents, installed file tree, runtime metadata, helper binaries, command paths, and docs claims are all verified against actual installed reality. If artifacts don't match contracts, the release is BLOCKED.

Run this after build/pack and BEFORE any publish or release step. Every check compares what EXISTS on disk against what the product PROMISES.
</objective>

<process>
## Step 1: Build and pack (if not already done)

Verify a tarball exists or create one:

```bash
TARBALL=$(ls *.tgz 2>/dev/null | head -1)
if [ -z "$TARBALL" ]; then
  npm pack --dry-run 2>&1
  npm pack
  TARBALL=$(ls *.tgz 2>/dev/null | head -1)
fi
```

## Step 2: Check tarball contents against package.json files[]

Extract the `files` array from `package.json` and verify every declared file exists in the tarball:

```bash
# List tarball contents
tar tzf "$TARBALL" | sort > /tmp/tarball-contents.txt

# Extract files[] from package.json
node -e "
  const pkg = require('./package.json');
  const files = pkg.files || [];
  files.forEach(f => console.log(f));
" > /tmp/declared-files.txt
```

For each declared file pattern, verify at least one match exists in tarball contents. Record mismatches as BLOCKED.

## Step 3: Check installed file tree for required files

Install the tarball to a temp directory and verify the required file tree:

```bash
INSTALL_DIR=$(mktemp -d)
npm install --prefix "$INSTALL_DIR" "$TARBALL" --no-save 2>&1

# Required files — adjust paths based on package name
PKG_NAME=$(node -e "console.log(require('./package.json').name)")
PKG_DIR="$INSTALL_DIR/node_modules/$PKG_NAME"
```

Check for each required file:
- `cli.js` or main entry point (from package.json `bin` or `main`)
- `sunco-tools.cjs` (helper binary)
- `package.json` (with correct `type: module` for ESM)
- `VERSION` file or version field in package.json

```bash
REQUIRED_FILES=("$(node -e "
  const pkg = require('./package.json');
  const bins = pkg.bin || {};
  Object.values(bins).forEach(b => console.log(b));
  if (pkg.main) console.log(pkg.main);
")")

for f in $REQUIRED_FILES; do
  if [ ! -f "$PKG_DIR/$f" ]; then
    echo "BLOCKED: Required file missing from install: $f"
  fi
done
```

## Step 4: Check runtime metadata

Verify `type: "module"` is present in the installed package.json (ESM requirement):

```bash
node -e "
  const pkg = require('$PKG_DIR/package.json');
  if (pkg.type !== 'module') {
    console.log('BLOCKED: package.json missing type: module');
    process.exit(1);
  }
  console.log('PASS: type: module present');
"
```

## Step 5: Check helper binaries are accessible

Verify declared `bin` entries resolve to executable files:

```bash
node -e "
  const pkg = require('./package.json');
  const bins = pkg.bin || {};
  for (const [name, path] of Object.entries(bins)) {
    console.log(name + '=' + path);
  }
" | while IFS='=' read -r name path; do
  FULL="$PKG_DIR/$path"
  if [ ! -f "$FULL" ]; then
    echo "BLOCKED: bin '$name' target missing: $path"
  elif [ ! -x "$FULL" ] && ! head -1 "$FULL" | grep -q '^#!'; then
    echo "BLOCKED: bin '$name' not executable and has no shebang: $path"
  else
    echo "PASS: bin '$name' -> $path"
  fi
done
```

## Step 6: Check command/workflow/agent paths resolve

If the package bundles command definitions, workflow files, or agent configs, verify those paths resolve from the installed location:

```bash
# Check for bundled commands directory
if [ -d "$PKG_DIR/commands" ] || [ -d "$PKG_DIR/dist/commands" ]; then
  CMD_DIR=$(ls -d "$PKG_DIR/commands" "$PKG_DIR/dist/commands" 2>/dev/null | head -1)
  CMD_COUNT=$(find "$CMD_DIR" -name "*.md" -o -name "*.js" | wc -l)
  echo "Commands found: $CMD_COUNT"
  if [ "$CMD_COUNT" -eq 0 ]; then
    echo "BLOCKED: Commands directory exists but contains no command files"
  fi
fi

# Check for bundled workflows directory
if [ -d "$PKG_DIR/workflows" ] || [ -d "$PKG_DIR/dist/workflows" ]; then
  WF_DIR=$(ls -d "$PKG_DIR/workflows" "$PKG_DIR/dist/workflows" 2>/dev/null | head -1)
  WF_COUNT=$(find "$WF_DIR" -name "*.md" | wc -l)
  echo "Workflows found: $WF_COUNT"
  if [ "$WF_COUNT" -eq 0 ]; then
    echo "BLOCKED: Workflows directory exists but contains no workflow files"
  fi
fi
```

## Step 7: Check docs claims match installed reality

Read README.md or docs for installation/usage claims and verify each one:

```bash
# Extract claimed install commands from docs
grep -E '(npm install|npx |sunco )' README.md docs/*.md 2>/dev/null | while read -r line; do
  echo "DOC CLAIM: $line"
done
```

For each docs claim about what gets installed or what commands are available:
- Verify the binary name exists in package.json bin
- Verify claimed files exist in the installed tree
- Flag any doc claim that references a file or command not present in artifacts

## Step 8: Runtime matrix verification

Test that installed artifacts actually execute in the declared runtime:

```bash
# Get the main entry point
MAIN=$(node -e "const p=require('./package.json'); console.log(p.main || p.bin && Object.values(p.bin)[0] || 'index.js')")

# Try to load the module
node -e "
  import('$PKG_DIR/$MAIN')
    .then(() => console.log('PASS: Module loads successfully'))
    .catch(e => { console.log('BLOCKED: Module fails to load: ' + e.message); process.exit(1); });
"

# If there's a bin, try --help or --version
node -e "
  const pkg = require('./package.json');
  const bins = pkg.bin || {};
  const first = Object.values(bins)[0];
  if (first) console.log(first);
" | while read -r bin_path; do
  node "$PKG_DIR/$bin_path" --help > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "PASS: Binary runs --help successfully"
  else
    echo "BLOCKED: Binary fails to run --help"
  fi
done
```

## Step 9: Cleanup and aggregate

```bash
rm -rf "$INSTALL_DIR"
```

Collect all findings into a structured report:

```
=== ARTIFACT GATE REPORT ===
Tarball: [filename]
Package: [name]@[version]

Tarball vs files[]:      [PASS / BLOCKED — N mismatches]
Install file tree:       [PASS / BLOCKED — N missing files]
Runtime metadata:        [PASS / BLOCKED]
Helper binaries:         [PASS / BLOCKED — N issues]
Command paths:           [PASS / BLOCKED]
Docs vs reality:         [PASS / BLOCKED — N mismatches]
Runtime matrix:          [PASS / BLOCKED]

VERDICT: [PASS / BLOCKED]
Blocked items: [count]
```

## Step 10: Enforce verdict

- If ALL checks pass: output `ARTIFACT GATE: PASS` — artifacts are release-ready.
- If ANY check fails: output `ARTIFACT GATE: BLOCKED` with every failure listed. Do NOT proceed to publish or release. No override.
</process>

<success_criteria>
- Tarball contents verified against package.json files[] with zero mismatches
- Installed file tree contains all required files (entry points, helpers, package.json, version)
- Runtime metadata (type: module) confirmed present
- All declared bin entries resolve to executable files with shebangs
- Command/workflow/agent paths resolve from installed location
- Docs claims about installation/commands match installed reality
- Module loads and binary runs --help without error
- BLOCKED verdict if ANY check fails, with specific failure details
- No skip mechanism, no override flag
</success_criteria>
