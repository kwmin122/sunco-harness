# Guard Watch Workflow

Real-time filesystem guard with lint-on-change, blast radius monitoring, and conditional Claude rule generation.

---

## Core Principle

Guard is the proactive defense layer. It catches mistakes at the point of introduction (watch mode), monitors change impact (blast radius), and teaches agents project-specific patterns before they make mistakes (draft-claude-rules). Guard never modifies code — it only observes, warns, and generates rules.

Responsibility chain:

```
parse_args → detect_mode → [watch_mode | draft_rules_mode | blast_radius_mode]
```

---

## Step 1: parse_args

Parse `$ARGUMENTS` for mode flags:

| Flag | Variable | Default |
|------|----------|---------|
| `--watch` | `WATCH_MODE` | true (default) |
| `--draft-claude-rules` | `DRAFT_RULES_MODE` | false |
| `--blast-radius` | `BLAST_RADIUS_MODE` | false |
| `--dry-run` | `DRY_RUN` | false |

If `--draft-claude-rules` is present, skip to Step 5 (rule generation mode).
If `--blast-radius` is present, enable blast radius monitoring alongside watch mode.

---

## Step 2: watch_mode — Start Guard

```bash
node "$HOME/.claude/sunco/bin/cli.js" guard --watch 2>&1
```

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO GUARD — Watching for changes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Directories: src/, packages/, .claude/
 Lint engine: ESLint + custom architecture rules
 Press Ctrl+C to stop
```

For each file change detected:
1. Run lint on the changed file
2. If clean: show `✓ {filepath} — clean`
3. If violations: show structured output (rule, line, message, severity)
4. Track violation frequency per rule

---

## Step 3: violation_tracking

Maintain a violation counter per rule name:

```
violation_count = {
  "no-cross-layer-import": 3,
  "skill-lifecycle-complete": 2,
  ...
}
```

**Promotion threshold:** When any rule triggers 3+ times across different files:

```
⚠ Recurring violation: "{rule_name}" has triggered {count} times.
   Files affected: {file1}, {file2}, {file3}

   Consider promoting this to a permanent .claude/rules/ file so agents
   learn this pattern proactively.

   Run: /sunco:guard --draft-claude-rules
```

---

## Step 4: blast_radius_monitor

If `--blast-radius` is enabled, after each lint cycle:

1. Run `git diff --stat` to count modified files
2. If modified file count > 10:
   ```
   ⚠ BLAST RADIUS WARNING: {count} files modified in current working tree.

   This exceeds the 10-file threshold. Consider:
   - Committing current work before continuing
   - Using a git worktree for isolation
   - Breaking the change into smaller batches
   ```

3. Track file modification rate. If >5 files change within 1 minute, warn about potential runaway agent.

---

## Step 5: draft_claude_rules — Rule Generation Mode

This is the `--draft-claude-rules` implementation. It scans the codebase and generates conditional `.claude/rules/` files.

### Step 5.1: Discover Existing Rules

```bash
ls .claude/rules/*.md 2>/dev/null || echo "No existing rules"
```

Parse each existing rule's frontmatter `patterns:` to know what's already covered. Do NOT generate duplicate rules.

### Step 5.2: Scan Codebase for Pattern Categories

For each category, check if the codebase uses it:

**a) Skill patterns** — Check if `*.skill.ts` files exist:
```bash
find packages/ -name "*.skill.ts" 2>/dev/null | head -5
```
If found: generate rule from template `$HOME/.claude/sunco/templates/claude-rules/skill-patterns.md`

**b) API safety** — Check if API routes or endpoints exist:
```bash
grep -rn "app\.\(get\|post\|put\|delete\)" packages/ --include="*.ts" 2>/dev/null | head -5
```
If found: generate rule from template `$HOME/.claude/sunco/templates/claude-rules/api-safety.md`

**c) Test conventions** — Check if test files exist:
```bash
find packages/ -name "*.test.ts" 2>/dev/null | head -5
```
If found: generate rule from template `$HOME/.claude/sunco/templates/claude-rules/test-conventions.md`

**d) Architecture context** — Check if monorepo structure exists:
```bash
ls packages/*/package.json 2>/dev/null | head -5
```
If found: generate rule from template `$HOME/.claude/sunco/templates/claude-rules/architecture-context.md`

**e) Database safety** — Check if DB/ORM code exists:
```bash
grep -rn "prisma\|drizzle\|knex\|sequelize\|typeorm\|\.sql" packages/ --include="*.ts" 2>/dev/null | head -5
```
If found: generate rule from template `$HOME/.claude/sunco/templates/claude-rules/database-safety.md`

### Step 5.3: Generate Project-Specific Rules

Beyond templates, generate rules from actual codebase patterns:

**Import boundaries:**
```bash
# Detect package boundaries
ls packages/*/src/index.ts 2>/dev/null
```
If monorepo: generate a rule enforcing that packages only import from each other's public API (index.ts), not internal modules.

**Config patterns:**
```bash
# Detect config system
grep -rn "config\.toml\|\.env\|config\.json" packages/ --include="*.ts" 2>/dev/null | head -5
```
If config files exist: generate a rule about config access patterns (use config helpers, don't read files directly).

**Error handling:**
```bash
# Detect error handling pattern
grep -rn "class.*Error extends" packages/ --include="*.ts" 2>/dev/null | head -5
```
If custom errors exist: generate a rule about using project-specific error classes.

### Step 5.4: Present Rules for Review

For each generated rule, show:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DRAFT CLAUDE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. skill-patterns.md (NEW)
   Patterns: **/*.skill.ts, **/skills-harness/**, **/skills-workflow/**
   Rules: defineSkill export, lifecycle stages, deterministic-first

2. architecture-context.md (NEW)
   Patterns: packages/*/src/**
   Rules: import boundaries, no cross-layer imports

3. test-conventions.md (SKIP — already exists)

Generate these rules? (yes / preview / skip)
```

Use AskUserQuestion for confirmation. If "preview": show full content of each rule.

### Step 5.5: Write Rules

If confirmed and not `--dry-run`:

```bash
mkdir -p .claude/rules
```

For each approved rule:
1. Read the template from `$HOME/.claude/sunco/templates/claude-rules/{name}.md`
2. Customize frontmatter `patterns:` to match this project's actual file structure
3. Write to `.claude/rules/{name}.md`

```bash
# Commit the new rules
git add .claude/rules/
git commit -m "chore(sunco): draft conditional Claude rules from guard analysis"
```

---

## Step 6: display_summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GUARD COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Mode     : {watch | draft-rules | blast-radius}
 Rules    : {N} generated, {M} skipped (already exist)
 Next     : Rules will activate automatically when agents touch matching files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| No templates directory | SUNCO not installed properly | `npm install -g popcoru` |
| No `packages/` directory | Not in a monorepo | Scan `src/` instead |
| No `.claude/` directory | Claude Code not set up | `mkdir -p .claude/rules` |
| git commit fails | Nothing to commit | Skip commit step |
| Template file missing | Partial installation | Log warning, skip that category |

---

## Success Criteria

- [ ] Mode correctly detected from flags
- [ ] Watch mode: lint runs on every file change
- [ ] Blast radius: warns when >10 files modified
- [ ] Draft rules: only generates for patterns actually present in codebase
- [ ] No duplicate rules (checks existing `.claude/rules/` first)
- [ ] User reviews rules before write (AskUserQuestion confirmation)
- [ ] Rules have correct frontmatter `patterns:` for this project
- [ ] Summary displayed with counts
