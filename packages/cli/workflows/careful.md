# Careful — Destructive Command Guardrails

Safety mode is now **active**. From this point forward, scrutinize every Bash command before executing it. If a destructive command is detected, warn the user and ask for confirmation before proceeding.

---

## Activation

Confirm to the user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO CAREFUL — Safety mode active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Destructive commands will trigger warnings.
 Override available for each warning.
 Deactivate by ending the session.
```

---

## What's Protected

Check every Bash command against these destructive patterns:

| Pattern | Example | Risk |
|---------|---------|------|
| `rm -rf` / `rm -r` / `rm --recursive` | `rm -rf /var/data` | Recursive delete |
| `DROP TABLE` / `DROP DATABASE` | `DROP TABLE users;` | Data loss |
| `TRUNCATE` | `TRUNCATE orders;` | Data loss |
| `git push --force` / `git push -f` | `git push -f origin main` | History rewrite |
| `git reset --hard` | `git reset --hard HEAD~3` | Uncommitted work loss |
| `git checkout .` / `git restore .` | `git checkout .` | Uncommitted work loss |
| `git clean -f` / `git clean -fd` | `git clean -fd` | Untracked file loss |
| `git branch -D` | `git branch -D feature` | Branch deletion |
| `kubectl delete` | `kubectl delete pod` | Production impact |
| `docker rm -f` / `docker system prune` | `docker system prune -a` | Container/image loss |

## Safe Exceptions

These patterns are allowed without warning:
- `rm -rf node_modules` / `.next` / `dist` / `__pycache__` / `.cache` / `build` / `.turbo` / `coverage` / `.sun/tmp`

---

## How It Works

For every Bash command you are about to execute:

1. Check the command string against destructive patterns above.
2. If no match: execute normally.
3. If match found AND matches a safe exception: execute normally.
4. If match found AND NOT a safe exception:

   Present a warning via AskUserQuestion:
   ```
   ⚠️  DESTRUCTIVE COMMAND DETECTED
   ─────────────────────────────────
   Command:  [the command]
   Risk:     [what could go wrong]
   ```
   - A) Proceed — I understand the risk
   - B) Cancel — don't run this command

   If A: execute the command.
   If B: skip the command and continue.

---

## Session Scope

This mode persists for the entire conversation. There is no way to deactivate it mid-session except by ending the conversation. This is intentional — safety mode should not be easily bypassed.

---

## Combine with /sunco:freeze

For maximum safety, combine with `/sunco:freeze` to restrict edits to a specific directory while also getting warnings on destructive commands.
