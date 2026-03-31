---
name: sunco:mode
description: "SUNCO Mode ON — every input auto-routes to the best skill. Like going Super Saiyan."
argument-hint: "[on|off]"
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
- `on` (default) — Activate SUNCO Mode
- `off` — Deactivate SUNCO Mode

**What this does:**
When SUNCO Mode is ON, every message you type is automatically analyzed and routed to the most appropriate `/sunco:*` command. You don't need to remember command names — just describe what you want in natural language.
</context>

<objective>
Transform Claude Code into SUNCO-powered mode. Every input auto-routes to the best skill.

**Visual cue:** When mode is ON, prefix all responses with the SUNCO energy indicator.

**After activation:** Just talk naturally. SUNCO handles the routing.
</objective>

<process>
## Activation

If argument is "off":
1. Delete the mode marker: `rm -f ~/.sunco/mode-active`
2. Respond:
```
⚡ SUNCO Mode OFF

Back to normal. Use /sunco:help to see available commands.
```
3. Stop.

If argument is "on" or empty (default):
1. Create mode marker:
```bash
mkdir -p ~/.sunco && echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > ~/.sunco/mode-active
```

2. Display the transformation sequence:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ⚡⚡⚡ SUNCO MODE ACTIVATED ⚡⚡⚡

  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║     █▀ █░█ █▄░█ █▀▀ █▀█               ║
  ║     ▄█ █▄█ █░▀█ █▄▄ █▄█               ║
  ║                                          ║
  ║   ◆ 57 skills armed and ready           ║
  ║   ◆ 6-layer verification online          ║
  ║   ◆ Harness engineering engaged          ║
  ║   ◆ Auto-routing enabled                 ║
  ║                                          ║
  ╚══════════════════════════════════════════╝

  Now just talk. I'll route to the right skill.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Ongoing Behavior (while mode is active)

From this point on, for EVERY user message:

1. **Analyze intent** — What is the user trying to do?
2. **Match to skill** — Find the best `/sunco:*` command:

| User intent pattern | Route to |
|---|---|
| "새 프로젝트" / "start project" / "bootstrap" | `/sunco:new` |
| "계획" / "plan" / "break down" | `/sunco:plan` |
| "실행" / "execute" / "build" / "implement" | `/sunco:execute` |
| "검증" / "verify" / "check" / "review quality" | `/sunco:verify` |
| "디버그" / "debug" / "fix bug" / "왜 안돼" | `/sunco:debug` |
| "린트" / "lint" / "code quality" | `/sunco:lint` |
| "건강" / "health" / "codebase score" | `/sunco:health` |
| "PR" / "ship" / "배포" / "deploy" | `/sunco:ship` |
| "문서" / "doc" / "documentation" | `/sunco:doc` |
| "테스트" / "test" / "generate tests" | `/sunco:test-gen` |
| "스캔" / "scan" / "analyze codebase" | `/sunco:scan` |
| "진행상황" / "progress" / "where am I" | `/sunco:progress` |
| "다음" / "next" / "what should I do" | `/sunco:next` |
| "빠르게" / "quick fix" / "just do it" | `/sunco:quick` |
| "메모" / "note" / "remember" | `/sunco:note` |
| "일시정지" / "pause" / "save session" | `/sunco:pause` |
| "재개" / "resume" / "continue" | `/sunco:resume` |
| "통계" / "stats" / "metrics" | `/sunco:stats` |
| "설정" / "settings" / "configure" | `/sunco:settings` |
| "자동" / "auto" / "run everything" | `/sunco:auto` |
| Simple question or unclear | Answer directly, no skill needed |

3. **Execute** — Run the matched skill with the user's input as context
4. **Energy prefix** — Start every response with: `⚡ SUNCO >`

## Response Format (while mode is active)

Every response MUST start with:

```
⚡ SUNCO > [skill-name or "direct"]
```

Examples:
```
⚡ SUNCO > lint
Running architecture boundary check...

⚡ SUNCO > debug
Analyzing the error...

⚡ SUNCO > direct
Here's the answer to your question...
```

## Context Bar

At the end of significant responses, show the context usage bar:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ SUNCO Mode | Context: ██████████░░░░░░ 65% | Skills used: 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Estimate context usage based on conversation length (rough approximation):
- Short conversation (< 10 exchanges): 10-30%
- Medium (10-30 exchanges): 30-60%
- Long (30-50 exchanges): 60-85%
- Very long (50+ exchanges): 85-95%

## Deactivation

If the user says "mode off", "/sunco:mode off", "turn off", "deactivate":
1. Delete marker: `rm -f ~/.sunco/mode-active`
2. Show:
```
⚡ SUNCO Mode OFF — 파워 다운

Session stats:
- Skills invoked: [count]
- Duration: [time]

Back to normal mode.
```
</process>
