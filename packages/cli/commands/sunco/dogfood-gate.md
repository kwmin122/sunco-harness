---
name: sunco:dogfood-gate
description: Dogfood gate — verifies SUNCO applies its own principles to its own repo
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

<objective>
STOP-THE-LINE gate that verifies SUNCO eats its own dog food. If SUNCO teaches harness engineering principles — thin root CLAUDE.md, conditional rules in .claude/rules/, memory strategy, init producing what docs promise, guard generating real rules, agents scanning real paths — then SUNCO's own repo must follow those same principles.

A framework that doesn't use itself is a framework nobody should trust. This gate catches hypocrisy.
</objective>

<process>
## Step 1: Check root CLAUDE.md is thin (<=60 lines)

The thin root principle: CLAUDE.md should be a routing file, not a megadoc. Detailed instructions belong in .claude/rules/ with conditional frontmatter.

```bash
CLAUDE_MD="./CLAUDE.md"
if [ ! -f "$CLAUDE_MD" ]; then
  echo "BLOCKED: Root CLAUDE.md does not exist"
else
  LINE_COUNT=$(wc -l < "$CLAUDE_MD")
  if [ "$LINE_COUNT" -gt 60 ]; then
    echo "BLOCKED: Root CLAUDE.md is $LINE_COUNT lines (max 60). Move detailed instructions to .claude/rules/"
  else
    echo "PASS: Root CLAUDE.md is $LINE_COUNT lines"
  fi
fi
```

## Step 2: Check .claude/rules/ directory exists with rule files

SUNCO's guard --draft-claude-rules generates conditional rules. SUNCO's own repo should have them.

```bash
RULES_DIR=".claude/rules"
if [ ! -d "$RULES_DIR" ]; then
  echo "BLOCKED: .claude/rules/ directory does not exist"
else
  RULE_COUNT=$(find "$RULES_DIR" -name "*.md" | wc -l | tr -d ' ')
  if [ "$RULE_COUNT" -eq 0 ]; then
    echo "BLOCKED: .claude/rules/ exists but contains no rule files"
  else
    echo "PASS: .claude/rules/ contains $RULE_COUNT rule file(s)"
  fi
fi
```

Verify rule files have conditional frontmatter (patterns: field):

```bash
for rule_file in "$RULES_DIR"/*.md; do
  if [ -f "$rule_file" ]; then
    if ! head -10 "$rule_file" | grep -q 'patterns:'; then
      echo "WARNING: $rule_file missing patterns: frontmatter — rule loads unconditionally"
    fi
  fi
done
```

## Step 3: Check memory strategy is applied, not just documented

SUNCO teaches memory strategy (MEMORY.md, structured recall). Verify the repo actually uses it:

```bash
# Check for .claude/ memory directory or MEMORY.md
if [ -f ".claude/MEMORY.md" ] || [ -d ".claude/memory" ]; then
  echo "PASS: Memory strategy artifacts present"
else
  # Check if CLAUDE.md references memory
  if grep -q -i 'memory' CLAUDE.md 2>/dev/null; then
    echo "WARNING: CLAUDE.md references memory but no memory artifacts found"
  else
    echo "BLOCKED: No memory strategy applied to own repo"
  fi
fi
```

## Step 4: Verify init produces what docs promise

If SUNCO docs say `sunco init` creates CLAUDE.md and .claude/rules/, verify the init implementation actually does that:

```bash
# Find init skill implementation
INIT_FILES=$(find . -name "init.skill.ts" -o -name "init.md" -path "*/commands/*" 2>/dev/null)
if [ -z "$INIT_FILES" ]; then
  echo "WARNING: Cannot locate init implementation to verify"
else
  for f in $INIT_FILES; do
    # Check init mentions CLAUDE.md creation
    if grep -q 'CLAUDE.md' "$f"; then
      echo "PASS: init references CLAUDE.md creation"
    else
      echo "BLOCKED: init does not reference CLAUDE.md creation — docs promise broken"
    fi

    # Check init mentions .claude/rules/
    if grep -q -E '(claude/rules|rules/)' "$f"; then
      echo "PASS: init references .claude/rules/ creation"
    else
      echo "BLOCKED: init does not reference .claude/rules/ creation — docs promise broken"
    fi
  done
fi
```

## Step 5: Verify guard --draft-claude-rules works

The guard skill's --draft-claude-rules mode should be functional, not a stub:

```bash
# Find guard implementation
GUARD_FILES=$(find . -name "guard*" -path "*/commands/*" -o -name "guard*.skill.ts" 2>/dev/null)
if [ -z "$GUARD_FILES" ]; then
  echo "WARNING: Cannot locate guard implementation to verify"
else
  for f in $GUARD_FILES; do
    if grep -q 'draft-claude-rules' "$f"; then
      echo "PASS: guard references --draft-claude-rules"
    else
      echo "BLOCKED: guard missing --draft-claude-rules support"
    fi
  done
fi

# If guard workflow exists, verify it's not a stub
GUARD_WF=$(find "$HOME/.claude/sunco/workflows" -name "guard*" 2>/dev/null | head -1)
if [ -n "$GUARD_WF" ]; then
  WF_LINES=$(wc -l < "$GUARD_WF")
  if [ "$WF_LINES" -lt 10 ]; then
    echo "BLOCKED: guard workflow is a stub ($WF_LINES lines)"
  else
    echo "PASS: guard workflow has substance ($WF_LINES lines)"
  fi
fi
```

## Step 6: Verify agents scans .claude/rules/ and nested CLAUDE.md

The agents skill should scan the harness artifacts it helps create:

```bash
AGENTS_FILES=$(find . -name "agents*" -path "*/commands/*" -o -name "agents*.skill.ts" 2>/dev/null)
if [ -z "$AGENTS_FILES" ]; then
  echo "WARNING: Cannot locate agents implementation to verify"
else
  for f in $AGENTS_FILES; do
    if grep -q -E '(claude/rules|\.claude/rules)' "$f"; then
      echo "PASS: agents references .claude/rules/ scanning"
    else
      echo "BLOCKED: agents does not scan .claude/rules/"
    fi

    if grep -q 'CLAUDE.md' "$f"; then
      echo "PASS: agents references CLAUDE.md scanning"
    else
      echo "BLOCKED: agents does not scan nested CLAUDE.md files"
    fi
  done
fi
```

## Step 7: Verify harness principles applied to own codebase

Check that SUNCO's own codebase follows the patterns it teaches:

### 7a: Skill files follow defineSkill pattern
```bash
SKILL_FILES=$(find . -name "*.skill.ts" 2>/dev/null | head -20)
if [ -z "$SKILL_FILES" ]; then
  echo "INFO: No skill files found yet (may be pre-implementation)"
else
  for f in $SKILL_FILES; do
    if grep -q 'defineSkill' "$f"; then
      echo "PASS: $f uses defineSkill"
    else
      echo "BLOCKED: $f is a .skill.ts file but does not use defineSkill()"
    fi
  done
fi
```

### 7b: Tests exist for core modules
```bash
TEST_COUNT=$(find . -name "*.test.ts" -not -path "*/node_modules/*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$TEST_COUNT" -eq 0 ]; then
  echo "BLOCKED: Zero test files in SUNCO repo — violates deterministic-first principle"
else
  echo "PASS: $TEST_COUNT test file(s) found"
fi
```

### 7c: ESM-only (no require() in source)
```bash
REQUIRE_COUNT=$(grep -r "require(" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist . 2>/dev/null | grep -v 'createRequire' | grep -v '*.test.ts' | grep -v '__tests__' | wc -l | tr -d ' ')
if [ "$REQUIRE_COUNT" -gt 0 ]; then
  echo "WARNING: $REQUIRE_COUNT require() calls found in .ts source (ESM-only policy, createRequire exempted)"
else
  echo "PASS: No bare require() in source"
fi
```

## Step 8: Aggregate findings

```
=== DOGFOOD GATE REPORT ===

Thin root CLAUDE.md (<=60 lines):     [PASS / BLOCKED]
.claude/rules/ with rule files:        [PASS / BLOCKED]
  Conditional frontmatter:             [PASS / WARNING]
Memory strategy applied:               [PASS / BLOCKED]
init produces docs promises:           [PASS / BLOCKED]
guard --draft-claude-rules works:      [PASS / BLOCKED]
agents scans harness artifacts:        [PASS / BLOCKED]
Harness principles on own code:
  defineSkill pattern:                 [PASS / BLOCKED / N/A]
  Tests exist:                         [PASS / BLOCKED]
  ESM-only:                            [PASS / WARNING]

VERDICT: [PASS / BLOCKED]
Blocked items: [count]
```

## Step 9: Enforce verdict

- If ALL checks pass: output `DOGFOOD GATE: PASS` — SUNCO practices what it preaches.
- If ANY check is BLOCKED: output `DOGFOOD GATE: BLOCKED` with every failure listed. SUNCO cannot ship what it doesn't follow itself.

The blocked output must explain the hypocrisy: "SUNCO teaches X but doesn't do X in its own repo."
</process>

<success_criteria>
- Root CLAUDE.md verified at <=60 lines
- .claude/rules/ directory exists with conditional rule files
- Memory strategy artifacts present (not just documented)
- init implementation creates what docs promise (CLAUDE.md + .claude/rules/)
- guard --draft-claude-rules is functional, not a stub
- agents skill scans .claude/rules/ and nested CLAUDE.md
- Own codebase follows harness principles (defineSkill, tests, ESM-only)
- BLOCKED if SUNCO doesn't apply its own teachings to its own repo
- No skip mechanism — dogfood compliance is non-negotiable
</success_criteria>
