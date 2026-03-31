---
name: sunco:workstreams
description: Manage parallel workstreams — create isolated branches for concurrent milestone work, switch between them, and merge on completion.
argument-hint: "<subcommand> [name]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `list` — Show all workstreams with status (active/paused/completed).
- `create <name>` — Create a new workstream with its own branch and planning namespace.
- `switch <name>` — Stash current work and switch to a different workstream.
- `status <name>` — Show detailed status for a specific workstream.
- `complete <name>` — Merge the workstream branch back and archive its planning artifacts.
- `resume <name>` — Resume a paused workstream from its last saved state.
</context>

<objective>
Manage parallel workstreams so multiple lines of milestone work can proceed concurrently without interference. Each workstream lives on its own git branch (`sunco/ws-<name>`) with an isolated `.planning/` namespace (`.planning/workstreams/<name>/`).

**Creates:**
- `.planning/workstreams/<name>/STATE.md` — workstream-level state
- `.planning/workstreams/<name>/ROADMAP.md` — workstream-specific phases
- `.planning/workstreams/<name>/phases/` — phase artifacts for this workstream
- `.sun/workstreams.json` — registry of all workstreams and their status

**After this command:** Use `/sunco:discuss`, `/sunco:plan`, and `/sunco:execute` inside the active workstream branch as normal.
</objective>

<process>
## If `list`

Read `.sun/workstreams.json` (create empty registry if missing).

Display all workstreams:
```
WORKSTREAMS
-----------
NAME           BRANCH                    STATUS      LAST ACTIVE
main-feature   sunco/ws-main-feature     active      2026-03-31
refactor-api   sunco/ws-refactor-api     paused      2026-03-28
old-attempt    sunco/ws-old-attempt      completed   2026-03-20
```

If no workstreams exist: show "No workstreams yet. Run `/sunco:workstreams create <name>` to create one."

## If `create <name>`

Validate name: lowercase, hyphens only, no spaces.

Check that `sunco/ws-<name>` branch does not already exist:
```bash
git branch --list "sunco/ws-<name>"
```

If branch exists: error — "Workstream '<name>' already exists. Use `switch` to activate it."

Steps:
1. Get current branch:
   ```bash
   git branch --show-current
   ```
2. Create and checkout new branch:
   ```bash
   git checkout -b sunco/ws-<name>
   ```
3. Create workstream planning namespace:
   ```bash
   mkdir -p .planning/workstreams/<name>/phases
   ```
4. Ask: "What is the goal of this workstream? (one sentence)"
5. Write `.planning/workstreams/<name>/STATE.md`:
   ```markdown
   # Workstream: <name>
   
   **Goal:** [user input]
   **Branch:** sunco/ws-<name>
   **Created:** [timestamp]
   **Status:** active
   **Base branch:** [original branch]
   ```
6. Write `.planning/workstreams/<name>/ROADMAP.md` with placeholder.
7. Register in `.sun/workstreams.json`:
   ```json
   {
     "workstreams": {
       "<name>": {
         "branch": "sunco/ws-<name>",
         "baseBranch": "[original branch]",
         "status": "active",
         "createdAt": "[timestamp]",
         "lastActiveAt": "[timestamp]"
       }
     },
     "active": "<name>"
   }
   ```

Show: "Workstream '<name>' created on branch `sunco/ws-<name>`. You are now on this branch."
Show next action: "Run `/sunco:discuss` or `/sunco:plan` to begin work in this workstream."

## If `switch <name>`

Read `.sun/workstreams.json`.
If workstream does not exist: error — "Workstream '<name>' not found. Run `list` to see available workstreams."

Get current branch:
```bash
git branch --show-current
```

If current branch has uncommitted changes:
```bash
git stash push -m "sunco:workstreams auto-stash before switching to <name>"
```
Record stash ref in workstreams.json for the current workstream.

Update current workstream status to `paused` and `lastActiveAt` in workstreams.json.

Checkout target workstream branch:
```bash
git checkout sunco/ws-<name>
```

If target workstream has a saved stash: pop it:
```bash
git stash pop
```

Update workstreams.json: set `active` to `<name>`, set `<name>.status` to `active`.

Show:
```
Switched to workstream '<name>' (sunco/ws-<name>)
Goal: [from STATE.md]
Last active: [timestamp]
```

Show relevant STATE.md summary for the resumed workstream.

## If `status <name>`

Read `.sun/workstreams.json` — verify workstream exists.
Read `.planning/workstreams/<name>/STATE.md`.
Read `.planning/workstreams/<name>/ROADMAP.md`.

List phase artifacts:
```bash
ls .planning/workstreams/<name>/phases/ 2>/dev/null
```

Show git log for the workstream branch:
```bash
git log sunco/ws-<name> --oneline -10
```

Display:
```
WORKSTREAM: <name>
Branch: sunco/ws-<name>
Status: [active/paused/completed]
Goal: [from STATE.md]
Last active: [timestamp]

PHASES
------
[phase list with status]

RECENT COMMITS
--------------
[last 10 commits on branch]
```

## If `complete <name>`

Read `.sun/workstreams.json` — verify workstream exists.

**Pre-merge checklist:**
1. Run `/sunco:lint` on the workstream branch — must pass with zero errors.
2. Check for uncommitted changes:
   ```bash
   git status --porcelain
   ```
   If dirty: ask user to commit or stash first.

Ask: "Merge workstream '<name>' into [base branch]? This will squash-merge all commits. [yes/no]"

If yes:
1. Checkout base branch:
   ```bash
   git checkout [baseBranch]
   ```
2. Merge:
   ```bash
   git merge --no-ff sunco/ws-<name> -m "feat(workstream): merge <name> workstream"
   ```
3. Archive planning artifacts:
   ```bash
   mkdir -p .planning/workstreams/_archive
   mv .planning/workstreams/<name> .planning/workstreams/_archive/<name>-[timestamp]
   ```
4. Update workstreams.json: set status to `completed`.
5. Optionally delete the workstream branch:
   Ask: "Delete branch `sunco/ws-<name>`? [yes/no]"
   If yes: `git branch -d sunco/ws-<name>`

Show: "Workstream '<name>' merged and archived."
Show next action: "Run `/sunco:progress` to see updated project state."

## If `resume <name>`

Equivalent to `switch <name>` but targeted at `paused` workstreams.
Read `.sun/workstreams.json`.
If workstream status is not `paused`: show warning "Workstream '<name>' is not paused (status: [current status]). Use `switch` to activate it."
Otherwise: follow same steps as `switch <name>`.
</process>
