# Remove Phase Workflow

Remove a future (unexecuted) phase from the roadmap. Deletes or archives the phase directory, removes the phase entry from ROADMAP.md, renumbers subsequent phases if requested, and commits the change atomically. Used by `/sunco:phase remove`.

---

## Overview

Five steps:

1. **Parse and validate** — confirm the phase exists and has not been executed
2. **Safety checks** — block removal of executed phases, check for downstream dependencies
3. **Remove artifacts** — delete or archive the phase directory
4. **Update ROADMAP.md** — remove the phase entry
5. **Renumber (optional)** — renumber downstream phases and update all references

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional token | `PHASE_ARG` | — (required) |
| `--renumber` | `RENUMBER` | false |
| `--archive` | `ARCHIVE` | false |
| `--force` | `FORCE` | false |
| `--no-commit` | `NO_COMMIT` | false |

If `PHASE_ARG` is absent:
```
Usage: /sunco:phase remove <phase-number>
Example: /sunco:phase remove 5
```

Resolve padded phase number:
```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d ".planning/phases/${PADDED}-*" 2>/dev/null | head -1)
PHASE_SLUG=$(basename "$PHASE_DIR" | sed "s/^[0-9.]*-//")
```

---

## Step 2: Validate Phase State

### Phase must exist in ROADMAP.md

```bash
ROADMAP_ENTRY=$(grep -n "Phase ${PHASE_ARG}:" ROADMAP.md | head -1)
```

If not found: "Phase ${PHASE_ARG} not found in ROADMAP.md. Nothing to remove."

### Refuse to remove executed phases (without --force)

Check if the phase has been executed:
```bash
HAS_SUMMARY=$(ls "${PHASE_DIR}/"*"-SUMMARY.md" 2>/dev/null | wc -l)
HAS_VERIFICATION=$(test -f "${PHASE_DIR}/${PADDED}-VERIFICATION.md" && echo "yes" || echo "no")
```

If `HAS_SUMMARY > 0` or `HAS_VERIFICATION == "yes"`:

If `--force` is NOT set:
```
Phase ${PHASE_ARG} has already been executed (found SUMMARY.md or VERIFICATION.md).
Removing executed phases destroys audit history.

Options:
  --archive          Move to .planning/archive/ instead of deleting
  --force            Remove anyway (destructive — use with care)
  /sunco:cleanup     Archive completed phases safely
```

Stop.

If `--force` IS set and phase has execution artifacts:
```
Warning: Phase ${PHASE_ARG} has been executed. Removing anyway (--force).
This will delete execution history for this phase.
Continue? [yes/no]
```

User must type `yes` explicitly.

### Check downstream plan dependencies

Scan `.planning/` for plans that list `depends_on: ${PADDED}` in their frontmatter:

```bash
DEPENDENTS=$(grep -rn "depends_on:.*${PADDED}" .planning/phases/ 2>/dev/null | head -10)
```

If dependents are found: warn (not blocking, but notable):
```
Note: The following plans reference Phase ${PHASE_ARG} as a dependency:
  {list of dependent plan files}
These references will be stale after removal.
```

---

## Step 3: Show Removal Scope and Confirm

```
Removing Phase {PHASE_ARG}: {phase title from ROADMAP.md}

Directory:   {PHASE_DIR}/
Action:      {delete | archive to .planning/archive/}
Renumber:    {yes | no}

Contents:
  {list files in PHASE_DIR, one per line}

This cannot be undone{unless using --archive}. Proceed? [yes/no]
```

User must type `yes` to continue.

---

## Step 4: Remove Phase Artifacts

### If `--archive`

```bash
mkdir -p .planning/archive
mv "${PHASE_DIR}" ".planning/archive/${PADDED}-${PHASE_SLUG}"
echo "  Archived: ${PHASE_DIR} → .planning/archive/${PADDED}-${PHASE_SLUG}"
```

### Otherwise (delete)

```bash
rm -rf "${PHASE_DIR}"
echo "  Deleted: ${PHASE_DIR}"
```

---

## Step 5: Update ROADMAP.md

Remove the phase block from ROADMAP.md. A phase block starts at `## Phase {N}:` and ends just before the next `## Phase` heading (or a horizontal rule `---` that acts as section separator, or end of file).

Read ROADMAP.md line by line. Track when inside the target phase block (start at the matching `## Phase N:` heading, end at the next `## ` heading). Remove those lines.

Write the updated ROADMAP.md back.

Verify removal:
```bash
grep "Phase ${PHASE_ARG}:" ROADMAP.md
```

If the grep still matches: abort with "ROADMAP.md update failed — manual fix required."

---

## Step 6: Renumber Downstream Phases (if --renumber)

If `--renumber` is NOT set: skip this step. Note:
```
Note: downstream phases were not renumbered.
Phase numbers after Phase {PHASE_ARG} now have a gap.
Use --renumber to close the gap.
```

If `--renumber` IS set:

Collect all integer phases AFTER `PHASE_ARG`:
```bash
DOWNSTREAM=$(grep -oE "Phase [0-9]+:" ROADMAP.md \
  | grep -oE "[0-9]+" | awk -v p="$PHASE_ARG" '$1 > p' | sort -n)
```

For each downstream phase (in ascending order), shift down by 1:
- Rename directory: `.planning/phases/NN-slug/` → `.planning/phases/(NN-1)-slug/`
- Update all frontmatter `phase:` fields in the directory.
- Update all ROADMAP.md occurrences of `Phase NN` → `Phase (NN-1)`.
- Update STATE.md if it references these phase numbers.

This is a multi-file renumber — apply carefully and verify after each phase:
```bash
git add .planning/ ROADMAP.md
```

After all renumbering: run a final consistency check:
```bash
# Verify no gaps in integer phase numbers in ROADMAP.md
grep -oE "^#{1,3} Phase [0-9]+:" ROADMAP.md \
  | grep -oE "[0-9]+" | sort -n | uniq
```

Print the resulting sequence and confirm it is gap-free.

---

## Step 7: Commit

If `--no-commit`: skip.

```bash
git add ROADMAP.md .planning/
if [[ "$RENUMBER" == "true" ]]; then
  git commit -m "chore(roadmap): remove Phase ${PHASE_ARG} — ${PHASE_SLUG}, renumber downstream"
else
  git commit -m "chore(roadmap): remove Phase ${PHASE_ARG} — ${PHASE_SLUG}"
fi
```

---

## Step 8: Report

```
Phase removed.

  Phase:      {PHASE_ARG} — {phase title}
  Directory:  {deleted | archived to .planning/archive/}
  Renumbered: {yes — phases {list} shifted down | no — gap remains}
  Commit:     {hash}

Current phase count: {N} phases in ROADMAP.md
```

---

## Error Handling

| Error | Response |
|-------|----------|
| Phase not in ROADMAP.md | "Nothing to remove." |
| Phase has execution artifacts without --force | Stop with options |
| User types anything other than `yes` at confirmation | Abort |
| ROADMAP.md write fails | Abort with manual instructions |
| Rename fails during renumber | Stop renumber, commit partial state, report which phases were renamed |
