# Freeze — Restrict Edits to a Directory

Lock file edits to a specific directory. Any Edit or Write operation targeting a file outside the allowed path will be **blocked**.

---

## Step 1: Determine Freeze Directory

If a directory was provided as argument:
```bash
FREEZE_DIR=$(cd "$ARGUMENTS" 2>/dev/null && pwd)
echo "FREEZE_DIR: $FREEZE_DIR"
```

If no argument provided, ask the user via AskUserQuestion:
- "Which directory should I restrict edits to? Files outside this path will be blocked."
- Text input — the user types a path.

---

## Step 2: Set Freeze Boundary

Resolve to absolute path and ensure trailing slash:
```bash
FREEZE_DIR="${FREEZE_DIR%/}/"
echo "Freeze boundary: $FREEZE_DIR"
```

Validate the directory exists:
```bash
[ -d "$FREEZE_DIR" ] && echo "VALID" || echo "INVALID"
```

If INVALID: ask user to provide a valid directory path.

---

## Step 3: Activate

Confirm to the user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO FREEZE — Edit boundary active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Edits restricted to: [FREEZE_DIR]
 Edit/Write outside this path → BLOCKED
 Read/Bash/Glob/Grep → unaffected
 Run /sunco:unfreeze to remove restriction
```

---

## How It Works

From this point forward, before every Edit or Write tool call:

1. Check if the target `file_path` starts with `FREEZE_DIR`.
2. If YES: proceed normally.
3. If NO: **do NOT execute the edit.** Instead, tell the user:
   ```
   ❌ BLOCKED: Edit outside freeze boundary
   Target:    [file_path]
   Boundary:  [FREEZE_DIR]
   Run /sunco:unfreeze to remove restriction.
   ```

---

## Notes

- The trailing `/` prevents `/src` from matching `/src-old`
- Freeze applies to Edit and Write tools only — Read, Bash, Glob, Grep are unaffected
- This prevents accidental edits, not a security boundary — Bash `sed` commands can still modify files outside
- To change the boundary, run `/sunco:freeze` again with a new directory
- To remove it, run `/sunco:unfreeze`
