# Cleanup Workflow

Archive stale phase directories and prune `.planning/phases/` for completed milestones. Moves completed phase artifacts to `.planning/archive/`, removes transient working files, and updates STATE.md to reflect the clean state. Used by `/sunco:cleanup`.

---

## Overview

Five steps:

1. **Identify targets** — find completed phases and stale working files
2. **Confirm scope** — show what will be archived or removed
3. **Archive phase dirs** — move completed phases to `.planning/archive/`
4. **Prune transient files** — remove checkpoint files and temp artifacts
5. **Update state** — commit the cleaned state

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--milestone <name>` | `MILESTONE_FILTER` | none (current milestone) |
| `--phase <n>` | `PHASE_FILTER` | none (all completed phases) |
| `--dry-run` | `DRY_RUN` | false |
| `--keep-plans` | `KEEP_PLANS` | false |
| `--no-archive` | `NO_ARCHIVE` | false |
| `--force` | `FORCE` | false |

`--dry-run`: show what would happen without doing anything.
`--keep-plans`: do not remove `*-PLAN.md` files even from archived phases.
`--no-archive`: delete instead of archiving (destructive — requires `--force`).

If `--no-archive` without `--force`:
```
--no-archive permanently deletes phase directories.
Re-run with --no-archive --force to confirm destructive cleanup.
```

---

## Step 2: Identify Targets

### Find completed phases

A phase is eligible for archival when ALL of the following are true:
1. A `VERIFICATION.md` exists with `Overall: PASS` or the phase directory contains shipped work.
2. A git tag or PR referencing this phase exists (indicates the work was shipped).
3. The phase is not the current active phase in STATE.md.

```bash
# Load current phase from state
CURRENT_PHASE=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state load \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); \
    process.stdout.write(JSON.parse(d).current_phase?.number ?? '')")

for dir in .planning/phases/[0-9]*-*; do
  PHASE_NUM=$(basename "$dir" | grep -oE "^[0-9]+")
  [[ "$PHASE_NUM" == "$CURRENT_PHASE" ]] && continue  # skip active phase

  HAS_VERIFICATION=$(test -f "${dir}/${PHASE_NUM}-VERIFICATION.md" && echo "yes" || echo "no")
  VERIFICATION_PASS=$(grep -q "Overall: PASS" "${dir}/${PHASE_NUM}-VERIFICATION.md" 2>/dev/null \
    && echo "yes" || echo "no")
done
```

Apply filters:
- If `MILESTONE_FILTER` set: check CONTEXT.md `milestone:` field, skip non-matching phases.
- If `PHASE_FILTER` set: only include the specified phase.

### Find transient files

For each phase directory (including active phase), find:
- `checkpoint-wave-*.json` — wave checkpoint files (safe to remove after phase is complete)
- `*.tmp` — any temp files

```bash
CHECKPOINT_FILES=$(find .planning/phases/ -name "checkpoint-wave-*.json" 2>/dev/null)
TEMP_FILES=$(find .planning/phases/ -name "*.tmp" 2>/dev/null)
```

### Stale working files in `.planning/` root

```bash
STALE_ROOT=$(find .planning/ -maxdepth 1 -name "*.tmp" -o -name "scratch.*" 2>/dev/null)
```

---

## Step 3: Confirm Scope

Show the user exactly what will be done:

```
Cleanup scope

Phases to archive: {N}
  Phase 01: bootstrap            .planning/phases/01-bootstrap/ → .planning/archive/01-bootstrap/
  Phase 02: core-runtime         .planning/phases/02-core-runtime/ → .planning/archive/02-core-runtime/

Transient files to remove: {N}
  .planning/phases/01-bootstrap/checkpoint-wave-1.json
  .planning/phases/01-bootstrap/checkpoint-wave-2.json
  .planning/phases/02-core-runtime/checkpoint-wave-1.json

{If --keep-plans: "PLAN.md files will be preserved in archive."}
{If --dry-run: "DRY RUN — no changes will be made."}
```

If nothing to clean:
```
Nothing to clean. All phases are either active or already archived.
```

Stop.

If not `--force` and archiving more than 3 phases: ask confirmation:
```
This will archive {N} phases. Continue? [y/n]
```

---

## Step 4: Archive Phase Directories

```bash
mkdir -p .planning/archive
```

For each eligible phase directory:

```bash
ARCHIVE_DIR=".planning/archive/${PHASE_NUM}-${PHASE_SLUG}"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] Would move: $dir → $ARCHIVE_DIR"
  continue
fi

if [[ "$NO_ARCHIVE" == "true" ]]; then
  rm -rf "$dir"
  echo "  Deleted: $dir"
else
  mv "$dir" "$ARCHIVE_DIR"
  echo "  Archived: $dir → $ARCHIVE_DIR"
fi
```

If `--keep-plans` is NOT set, remove PLAN.md files from the archive to reduce noise (these are preserved in git history):
```bash
if [[ "$KEEP_PLANS" != "true" ]] && [[ "$NO_ARCHIVE" != "true" ]]; then
  find "$ARCHIVE_DIR" -name "*-PLAN.md" -delete
  echo "  Pruned PLAN.md files from archive (preserved in git)"
fi
```

---

## Step 5: Prune Transient Files

Remove checkpoint files and temp files:

```bash
for f in $CHECKPOINT_FILES $TEMP_FILES $STALE_ROOT; do
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] Would remove: $f"
  else
    rm -f "$f"
    echo "  Removed: $f"
  fi
done
```

---

## Step 6: Update STATE.md and Commit

Update the `last_cleanup` timestamp in STATE.md:
```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set \
  "last_cleanup" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Commit the cleanup:
```bash
git add -A .planning/
git commit -m "chore(planning): archive phases ${ARCHIVED_LIST}, prune transient files"
```

Where `ARCHIVED_LIST` is a comma-separated list of archived phase numbers (e.g. `01,02`).

If `DRY_RUN`: skip commit.

---

## Step 7: Report

```
Cleanup complete.

  Phases archived:      {N}
  Transient files removed: {N}
  Archive location:     .planning/archive/
  Commit:               {hash}

Active phase unchanged: Phase {CURRENT_PHASE}

Next: /sunco:status to see the current project state.
```

If dry-run:
```
Dry run complete. No changes made.
Re-run without --dry-run to apply.
```

---

## Error Handling

| Error | Response |
|-------|----------|
| Phase dir already in archive | Skip with "already archived" notice |
| Archive move fails (permissions) | Show error, skip that phase, continue with others |
| `--no-archive` without `--force` | Stop with confirmation instructions |
| STATE.md update fails | Log warning, cleanup still proceeds |
| Git commit fails | Log warning, changes are already made on disk |
