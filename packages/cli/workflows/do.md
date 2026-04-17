# Do Workflow

Route freeform natural language input to the appropriate SUNCO command. Parses the user's intent from the text, matches to a known command, and either executes it directly or presents the best match with the exact command to run. Used by `/sunco:do`.

---

## Overview

Three steps:

1. **Parse intent** — extract the verb and object from the input
2. **Match to command** — score against known command intents
3. **Execute or suggest** — run with confidence, or present best match

---

## Step 1: Parse Intent

The full text after `/sunco:do` is the raw input.

Extract:
- **Verb** — the action: start, create, check, show, fix, ship, verify, debug, update, add, run, plan, execute, review
- **Object** — the target: project, milestone, phase, workspace, skill, status, tests, PR, plan, issue
- **Modifiers** — qualifiers: new, next, current, all, quick

Examples:

| Input | Verb | Object | Modifier |
|-------|------|--------|----------|
| "start a new milestone" | start | milestone | new |
| "show me what's next" | show | next | — |
| "fix the build errors" | fix | errors | build |
| "plan phase 3" | plan | phase | 3 |
| "ship it" | ship | — | — |
| "where am I" | show | status | — |
| "add a todo: refactor config loader" | add | todo | "refactor config loader" |
| "run the tests" | run | tests | — |
| "create a workspace for the UI experiment" | create | workspace | UI experiment |

---

## Step 2: Match to Command

Score each known SUNCO command against the parsed intent. First match wins.

**Routing table:**

| Verb + Object | Command | Notes |
|---|---|---|
| start/create + milestone (new) | `/sunco:milestone new` | |
| start/create + project/idea | `/sunco:new` | Uses office-hours → Superpowers brainstorming → new chain |
| brainstorm + idea/project | `/sunco:brainstorming` | Uses vendored Superpowers brainstorming |
| create/add + workspace | `/sunco:workspaces new [name]` | Extract name from modifier |
| show/check + status | `/sunco:status` | |
| show/what + next | `/sunco:next` | |
| show/list + todos | `/sunco:todo list` | |
| add/capture + todo | `/sunco:todo add "[text]"` | Extract text from input |
| plan + phase [N] | `/sunco:plan [N]` | Extract phase number |
| execute/run + phase [N] | `/sunco:execute [N]` | |
| discuss + phase [N] | `/sunco:discuss [N]` | |
| verify + phase [N] | `/sunco:verify [N]` | |
| ship / submit / PR | `/sunco:ship` | |
| review + phase [N] | `/sunco:review [N]` | |
| fix/diagnose + errors/build/tests | `/sunco:diagnose --build` or `--test` | |
| debug + [description] | `/sunco:debug` | |
| resume/continue/where | `/sunco:resume` | |
| update + sunco | `/sunco:update` | |
| research + phase [N] | `/sunco:research [N]` | |
| scan + codebase | `/sunco:scan` | |
| health + check | `/sunco:health` | |
| add + note/idea | `/sunco:note "[text]"` | |
| pause / stop / save session | `/sunco:pause` | |
| generate + tests | `/sunco:test-gen` | |

**If phase number is in the input**, extract it:
- "plan phase 3" → N=3
- "execute 4" → N=4
- "run phase two" → N=2 (handle word numbers)

**If the input mentions a specific skill by name**, route to `/sunco:run [skill-name]`.

---

## Step 3: Execute or Suggest

**High confidence match (one clear route):**

Execute the command directly without asking:

```
Running: /sunco:plan 3

[Phase 3 planning workflow output...]
```

**Medium confidence (2-3 possible routes):**

Present options inline:

```
I think you want to:

  1. Plan phase 3        /sunco:plan 3       (planning mode)
  2. Execute phase 3     /sunco:execute 3    (run the plans)
  3. Discuss phase 3     /sunco:discuss 3    (gather context first)

Which one? (1 / 2 / 3)
```

Wait for response. Execute the chosen command.

**No match (unrecognized intent):**

```
I'm not sure what you mean by "[input]".

Available commands: /sunco:help

Closest guesses:
  /sunco:status    — show current project state
  /sunco:next      — detect what needs to happen next
  /sunco:resume    — restore context from last session
```

**Ambiguous with extractable text (todo/note):**

For "add a todo: refactor config loader":

```bash
# Extract the text after "todo:" and pass it directly
/sunco:todo add "refactor config loader"
```

Execute without prompting.

---

## Routing Shortcuts

These common natural language phrases always route to the same command:

| Input | Routes to |
|-------|-----------|
| "where were we" | `/sunco:resume` |
| "what's next" | `/sunco:next` |
| "how are we doing" | `/sunco:status` |
| "are we done" | `/sunco:status` |
| "ship it" | `/sunco:ship` |
| "take a break" | `/sunco:pause` |
| "I'm stuck" | `/sunco:debug` |
| "something's broken" | `/sunco:diagnose --build` |
| "start fresh" | `/sunco:resume` (will detect new project) |

---

## Success Criteria

- [ ] Input parsed for verb, object, and modifiers
- [ ] Phase numbers extracted from numeric or word form
- [ ] High confidence routes execute directly
- [ ] Medium confidence presents 2-3 options, waits for choice
- [ ] Unknown intents suggest `/sunco:help` and 3 closest commands
- [ ] Extractable text (todo content, notes) passed through without reprompting
