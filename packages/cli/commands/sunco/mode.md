---
name: sunco:mode
description: "SUNCO Mode ON — every non-slash input routes directly through the Workflow Router. Persistent session wrapper over /sunco:router."
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
When SUNCO Mode is ON, every non-slash user message is intercepted by the UserPromptSubmit hook (`packages/cli/hooks/sunco-mode-router.cjs`) and routed **directly** to `/sunco:router --intent "<text>"`. No intermediate `/sunco:do` layer (G3a direct-to-router per Gate 53 L3). The router's RouteDecision drives the response.

**Engine:** `/sunco:mode` shares the Phase 52b router runtime with `/sunco:do`, `/sunco:next`, and `/sunco:manager`. No wrapper duplicates stage-inference or decision-writing logic. Mode is the *persistent* wrapper; `/sunco:next` is the *one-shot* wrapper.
</context>

<objective>
Transform Claude Code into SUNCO-powered mode. Every non-slash input auto-routes to the Workflow Router, which classifies stage, computes confidence, and proposes the matching command with approval-envelope enforcement.

**Visual cue:** When mode is ON, prefix all responses with the SUNCO energy indicator.

**After activation:** Just talk naturally. The router handles stage classification; this wrapper surfaces the result.
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
         direct-to-router active
         (no /sunco:do nesting)
```

After the banner, say: "그냥 말해. 라우터가 판단한다."

## System-Level Routing (direct-to-router, G3a)

When mode is active, `packages/cli/hooks/sunco-mode-router.cjs` (a UserPromptSubmit hook) detects non-slash natural language input and signals auto-routing **directly to `/sunco:router --intent <text>`**. There is no `/sunco:do` intermediate dispatch — the hook routes once, to the single router engine. This is a real system interceptor, not just a prompt hint, and it preserves the **single routing surface invariant**: one router invocation per user prompt in mode-ON sessions.

Nesting `/sunco:do` under mode would produce 2-level dispatch (mode hook → /sunco:do → router), which violates the "wrappers share router engine, no duplicated routing logic" rule from Gate 53 L12 + user intervention.

## Ongoing Behavior (while mode is active)

From this point on, for EVERY user message:

1. **Hook signals router** — `sunco-mode-router.cjs` prepends a routing directive invoking `/sunco:router --intent "<user text>"`
2. **Router classifies stage** — Freshness Gate (7-point) → evidence collection → stage classification → confidence compute → narrative reasons → structural validation → decision write (ephemeral tier)
3. **RouteDecision returned** — `current_stage`, `recommended_next`, `confidence` + band, `action.command`, `approval_envelope`
4. **Response rendered with mode indicator** — prefix per below; downstream `/sunco:*` command runs per approval envelope (ACK for `requires_user_ack` risk levels)
5. **UNKNOWN fallback** — if freshness drift fires, emit drift report + HOLD; subsequent user inputs still route each time (router re-runs freshness every invocation)

For slash-prefixed input (user explicitly typed `/sunco:*`), the hook does NOT intercept — direct invocation is preserved. Stage commands remain byte-identical when invoked directly.

## Response Format (while mode is active)

Every response MUST start with:

```
* SUNCO > [stage or direct] (router: confidence <n> <BAND>)
```

Examples:
```
* SUNCO > WORK (router: 0.86 HIGH)
/sunco:execute 53 proposed (risk=local_mutate · approval=auto_safe)...

* SUNCO > UNKNOWN (router: drift)
Freshness drift: 2/7 checks failed. HOLD — remediate before routing.

* SUNCO > direct
Answer without router invocation (user typed a direct `/sunco:*` command).
```

## Approval Envelope Propagation (L14 hard invariant)

While in mode, every routed proposal preserves `approval_envelope.{risk_level, triggers_required, forbidden_without_ack}` as emitted by the classifier. Mode does NOT upgrade risk level. Any operation on `forbidden_without_ack[]` (`git push`, `git push --tag`, `npm publish`, `npm login`, `rm -rf`, memory writes, `.claude/rules/` writes, schema mutation, `.planning/REQUIREMENTS.md` mutation, `.planning/ROADMAP.md` phase insert/remove) is proposed only — user ACK required before execution. L14 invariant: `remote_mutate` and `external_mutate` are NEVER `auto_safe` regardless of band.

## Context Bar

At the end of significant responses, show the context bar using simple ASCII:

```
___________________________________________________
* SUNCO Mode | Context: [==========----] 65% | Router invocations: 3
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

  Router invocations: [count]
  Duration: [time]

  "...다음에 또 변신하지."
```
</process>

<constraints>
- Direct-to-router (G3a per Gate 53 L3). The mode hook routes non-slash input to `/sunco:router --intent <text>` with no intermediate `/sunco:do` layer (single routing surface invariant).
- All routing delegates to the Phase 52b runtime via `/sunco:router`. This wrapper contains zero stage-inference, freshness-gate, confidence, or decision-writer logic (Gate 53 L5 + L12).
- L14 invariant: `remote_mutate` and `external_mutate` never emit `auto_safe` regardless of HIGH band; mode never upgrades risk level.
- `approval_envelope.forbidden_without_ack[]` preserved verbatim.
- UNKNOWN/HOLD on freshness drift is explicit; router re-runs freshness each invocation (no cached state between prompts).
- Stage commands remain byte-identical when invoked directly (R1 regression guarantee); mode hook skips slash-prefixed input.
</constraints>
