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
1. Delete the mode marker: `rm -f ~/.sun/mode-active`
2. Respond:
```
⚡ SUNCO Mode OFF

Back to normal. Use /sunco:help to see available commands.
```
3. Stop.

If argument is "on" or empty (default):
1. Create mode marker:
```bash
mkdir -p ~/.sun && echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > ~/.sun/mode-active
```

2. Display the transformation sequence — **Super Saiyan style.** Show the truecolor ANSI art banner first, then the status block.

**Step 2a: Show the Super Saiyan banner image**

```bash
node -e "try { const { BANNER } = require('$HOME/.claude/hooks/sunco-mode-banner.cjs'); console.log(BANNER); } catch { console.log('>>> SUNCO MODE <<<'); }"
```

**Step 2b: Show the status block**

```
           S  U  N  C  O
             M  O  D  E

         81 skills      armed
         7-layer       online
         harness     engaged
         auto-routing active

         >>> POWER: UNLIMITED <<<
```

After the banner, say: "그냥 말해. 알아서 라우팅한다."

## System-Level Routing

When mode is active, the `sunco-mode-router.cjs` UserPromptSubmit hook detects non-slash
natural language input and signals auto-routing via `/sunco:do`. This is a real system
interceptor, not just a prompt hint.

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
4. **Prefix** — Start every response with the mode indicator

## Response Format (while mode is active)

Every response MUST start with:

```
* SUNCO > [skill-name or "direct"]
```

Examples:
```
* SUNCO > lint
아키텍처 경계 검사 중...

* SUNCO > debug
에러 분석 중...

* SUNCO > direct
답변...
```

## Context Bar

At the end of significant responses, show the context bar using simple ASCII:

```
___________________________________________________
* SUNCO Mode | Context: [==========----] 65% | Skills used: 3
___________________________________________________
```

Estimate context usage based on conversation length:
- Short conversation (< 10 exchanges): 10-30%
- Medium (10-30 exchanges): 30-60%
- Long (30-50 exchanges): 60-85%
- Very long (50+ exchanges): 85-95%

**Style rules:**
- NO rainbow colors. NO emoji spam. NO cute symbols.
- NO Unicode block characters (they render as checkerboard in Claude Code terminal).
- Use only: plain ASCII (`*`, `-`, `=`, `_`, `>`, `|`, `/`, `\`).
- Tone: terse, powerful, zero fluff. Like Goku — doesn't talk much, just acts.

## Deactivation

If the user says "mode off", "/sunco:mode off", "turn off", "deactivate":
1. Delete marker: `rm -f ~/.sun/mode-active`
2. Show:
```
___________________________________
  SUNCO MODE -- power down
___________________________________

  Skills used: [count]
  Duration: [time]

  "...다음에 또 변신하지."
```
</process>
