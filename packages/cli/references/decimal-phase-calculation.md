# Decimal Phase Numbering System

When and how to use decimal phases for urgent work insertion. Applied by `/sunco:phase insert` and `/sunco:insert-phase`.

---

## When to Use Decimal Phases

Decimal phases represent urgent work that must happen between two existing integer phases. They are an escape hatch — not normal workflow.

**Use decimal phases when:**
- A critical bug was found in Phase 3's output that blocks Phase 4
- A security issue requires immediate fix before continuing
- A dependency change in Phase 3 requires a follow-up before Phase 4 can start
- A review revealed a gap in Phase 3 that must be filled

**Do not use decimal phases when:**
- The work is small enough to add as a task to the current phase's plan
- The work can wait until Phase 4 starts
- The original phase can be re-scoped to include the work

**Rule of thumb:** If you can reopen and modify the current phase's plan to include the work, do that instead. Decimal phases are for work that cannot be incorporated without disrupting the already-completed phase structure.

---

## Calculation Rules

### Basic insertion

Insert phase `N.1` between phase `N` and phase `N+1`:

```
Before: ... 03 → 04 → 05 ...
After:  ... 03 → 03.1 → 04 → 05 ...
```

### Multiple insertions

If you need to insert multiple phases between the same two integer phases:

```
03.1 → first urgent fix
03.2 → second urgent fix (found while doing 03.1)
03.3 → third (rare, signals the original phase needs restructuring)
```

**Warning threshold:** If you reach 03.3, this is a signal that Phase 03's original scope was too large or that planning was insufficient. Consider restructuring rather than adding more decimals.

### Insertion between non-consecutive integers

Inserting between Phase 3 and Phase 5 (when Phase 4 exists) is not valid. Insert relative to the phase immediately before the gap:

```
// Correct: insert between 03 and 04
sunco phase insert 3.1 --name "hotfix-loader"

// Incorrect: you cannot insert "between 3 and 5" — Phase 4 is there
```

---

## Directory Naming Conventions

Decimal phase directories use the format: `[major].[minor]-[name]`

```
.planning/
  03-skill-registry/         ← integer phase
  03.1-hotfix-loader/        ← decimal phase (inserted after 03)
  04-skill-loader/           ← continues after 03.1
```

### Zero-padding rules

- Major number: zero-padded to 2 digits (`03`, not `3`)
- Minor number: NOT zero-padded (`03.1`, not `03.01`)
- Name: kebab-case, descriptive of the urgent work

### Valid examples

```
03.1-hotfix-loader
03.2-security-patch-registry
05.1-fix-cli-output-format
```

### Invalid examples

```
03.01-hotfix          ← minor is zero-padded (invalid)
3.1-hotfix            ← major is not zero-padded (invalid)
03.1.1-hotfix         ← nested decimal (invalid)
03.1                  ← no name (invalid — name required)
```

---

## Renumbering Avoidance

Decimal phases exist precisely to avoid renumbering. When you have 20 phases and discover an urgent fix is needed after Phase 5, renaming phases 6-20 is disruptive — it changes directories, git history references, and plan file paths.

Decimal phases insert without touching any existing phase:

```
Before:
  05-agent-router/
  06-state-engine/

Insert 05.1:
  05-agent-router/
  05.1-hotfix-agent-timeout/   ← inserted
  06-state-engine/             ← unchanged
```

Phase 06 directory, plan files, and git history are entirely untouched.

---

## Command Reference

### Insert a decimal phase

```bash
# Insert 03.1 after 03 (auto-detects the next integer phase)
sunco phase insert 3.1 --name "hotfix-loader"

# Insert with explicit positioning
sunco phase insert --after 3 --name "hotfix-loader"
# → Creates 03.1-hotfix-loader
```

### ROADMAP.md update

`sunco phase insert` automatically updates ROADMAP.md:

```markdown
<!-- Before -->
- [ ] 03 · skill-registry
- [ ] 04 · skill-loader

<!-- After -->
- [ ] 03 · skill-registry
- [ ] 03.1 · hotfix-loader       ← inserted
- [ ] 04 · skill-loader
```

STATE.md is also updated to reflect the new current phase.
