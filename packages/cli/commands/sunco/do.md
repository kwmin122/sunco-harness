---
name: sunco:do
description: Route freeform text to the right sunco command via the Workflow Router. Describe what you want in natural language; the router classifies stage from repo evidence + your intent and proposes the matching command, with approval-boundary enforcement.
argument-hint: "<natural language description>"
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
- `<natural language description>` — What you want to do, in plain language.

**Engine:** `/sunco:do` is a thin wrapper over `/sunco:router`. Stage inference, freshness gate, confidence calibration, and approval envelope all come from the Phase 52b router runtime. This command contributes the `intent_hint` and a fallback keyword table when the router returns UNKNOWN/LOW without an actionable recommendation.
</context>

<objective>
Intelligent command router over natural language. The Workflow Router is invoked first with `intent_hint = <your text>`. Its RouteDecision (current stage + recommended_next + confidence + approval_envelope) drives the response. On UNKNOWN stage OR LOW band without actionable recommendation, a static keyword table provides a fallback route.

**Auto-routing is not auto-execution.** Any recommendation with `risk_level ∈ {repo_mutate, repo_mutate_official, remote_mutate, external_mutate}` requires user ACK before the downstream command runs. The router's `approval_envelope.forbidden_without_ack[]` is preserved verbatim in the presentation; no wrapper ever upgrades risk level to `auto_safe` (L14 hard invariant).
</objective>

<process>
## Step 1: Invoke the router with intent hint (router-first, per DESIGN §7.2)

Every `/sunco:do <text>` invocation calls the Workflow Router first:

```
/sunco:router --intent "<$ARGUMENTS>"
```

This delegates all stage classification, freshness gate (7 sub-predicates), confidence calibration, narrative reason rendering, decision writing (ephemeral tier by default), and approval envelope construction to the Phase 52b runtime (`classifier.mjs`, `evidence-collector.mjs`, `confidence.mjs`, `decision-writer.mjs`). No stage inference is re-implemented in this wrapper.

The router returns a schema-valid RouteDecision with:
- `current_stage` ∈ BRAINSTORM/PLAN/WORK/REVIEW/VERIFY/PROCEED/SHIP/RELEASE/COMPOUND/PAUSE/UNKNOWN
- `recommended_next` ∈ same enum + HOLD
- `confidence` number in [0,1] with band HIGH/MEDIUM/LOW
- `action.command` — the proposed `/sunco:*` command string
- `approval_envelope.risk_level` — the risk tier; `forbidden_without_ack[]` preserved verbatim
- `freshness.status` — fresh / drift / conflicted

## Step 2: Dispatch by band + approval mode

| Band | `action.mode` | Behavior |
|------|---------------|----------|
| HIGH | `auto_safe` (only for `read_only` + `local_mutate`) | Router may auto-proceed (one-line announce); downstream command runs |
| HIGH / MEDIUM | `requires_user_ack` | One-line prompt: "Route to `<action.command>` (risk=`<risk_level>`)? ACK to proceed." Downstream command runs only after explicit ACK |
| MEDIUM | `manual_only` or no clear action | Show top-2 candidates + reasoning; user selects |
| LOW | `manual_only` | Evidence summary + candidate list; no auto-proceed |
| UNKNOWN | `manual_only` | Freshness drift report; see Step 4 fallback |

## Step 3: L14 approval envelope propagation (hard invariant)

The `approval_envelope` emitted by the router is presented verbatim — `risk_level`, `triggers_required[]`, and `forbidden_without_ack[]`. This wrapper NEVER upgrades `remote_mutate` or `external_mutate` to `auto_safe`, regardless of confidence band. Any operation on the `forbidden_without_ack` list (`git push`, `git push --tag`, `npm publish`, `npm login`, `rm -rf`, memory writes, `.claude/rules/` writes, schema mutation, `.planning/REQUIREMENTS.md` mutation, `.planning/ROADMAP.md` phase insert/remove) is proposed only — the user (or a user-invoked skill) executes after ACK.

## Step 4: UNKNOWN / HOLD fallback (static keyword table)

When the router returns `current_stage = UNKNOWN` (freshness drift) OR `band = LOW` without an actionable `action.command`, consult this static keyword table from prior intent patterns as a **fallback-only** route lookup:

| Pattern | Fallback route |
|---------|----------------|
| "bootstrap", "new project", "start a project", "아이디어로 시작" | `/sunco:new` |
| "brainstorm", "brainstorming", "브레인스토밍" | `/sunco:brainstorming` |
| "phase N", "discuss phase", "decisions for" | `/sunco:discuss N` |
| "plan phase", "create plans for" | `/sunco:plan N` |
| "execute phase", "run phase", "implement phase" | `/sunco:execute N` |
| "verify phase", "check phase" | `/sunco:verify N` |
| "ship", "create PR", "pull request" | `/sunco:ship N` |
| "debug", "fix bug", "something is broken" | `/sunco:debug` |
| "diagnose", "analyze error", "build failing" | `/sunco:diagnose` |
| "quick fix", "small change" | `/sunco:quick` |
| "trivial", "typo", "one-liner" | `/sunco:fast` |
| "progress", "where am I", "status" | `/sunco:progress` |
| "next step", "what should I do" | `/sunco:next` |
| "note", "capture idea", "write down" | `/sunco:note` |
| "todo", "task", "add to list" | `/sunco:todo` |
| "seed", "future idea", "trigger" | `/sunco:seed` |
| "backlog", "park this", "later" | `/sunco:backlog` |
| "pause", "stop for now", "save state" | `/sunco:pause` |
| "resume", "continue", "restore" | `/sunco:resume` |
| "scan codebase", "analyze project" | `/sunco:scan` |
| "research", "investigate approach" | `/sunco:research` |
| "assume", "preview assumptions" | `/sunco:assume` |
| "generate tests", "write tests for" | `/sunco:test-gen` |
| "document", "generate docs", "readme" | `/sunco:doc` |
| "add phase", "new phase" | `/sunco:phase --add` |
| "release", "publish", "version bump" | `/sunco:release` |

Show: `"Routing to: /sunco:<command> (fallback — router returned <UNKNOWN|LOW>; drift: <summary>)"`. The approval envelope from the router (even on UNKNOWN) still dictates ACK requirements; fallback does not bypass L14.

When router returned UNKNOWN AND no static keyword matches, emit the drift report + HOLD recommendation + candidate list; do NOT silently pick a default stage.

## Step 5: Ambiguous intent handling

If the router returns MEDIUM band with 2+ candidates at similar confidence, surface both with reasoning and ask one clarifying question: "Did you mean to [option A] or [option B]?" This is the router's own MEDIUM-band behavior; this wrapper simply presents it.

## Examples

Input: "I need to fix a bug in the lint skill"
→ Router likely returns `current_stage = WORK`, `recommended_next = WORK`, HIGH band, `action.command = /sunco:debug --file packages/skills-harness/src/lint.skill.ts`
→ `/sunco:debug --file packages/skills-harness/src/lint.skill.ts` after ACK (risk_level = repo_mutate)

Input: "start planning phase 3"
→ Router returns `current_stage = PLAN`, HIGH band, `action.command = /sunco:discuss 3` (entering PLAN begins with discuss per STAGE-MACHINE)
→ `/sunco:discuss 3`

Input: "ship phase 2 as a draft PR"
→ Router returns `current_stage = SHIP`, HIGH band, `action.command = /sunco:ship 2 --draft`, risk_level = remote_mutate (branch push) → ACK required
→ `/sunco:ship 2 --draft` after ACK

Input: "what's the weather"
→ Router returns `current_stage = UNKNOWN` with drift absent; band = LOW; no `action.command`
→ Fallback table yields no match → HOLD + candidate list + suggestion to rephrase
</process>

<constraints>
- Router-first per DESIGN §7.2 "Thin wrapper over router" (Gate 53 L1). Static keyword table is fallback-ONLY for UNKNOWN/LOW-without-action cases.
- L14 invariant: `remote_mutate` and `external_mutate` NEVER emit `auto_safe`; this wrapper never upgrades risk level.
- All routing delegates to `/sunco:router` and the Phase 52b runtime. This wrapper contains zero stage-inference, freshness-gate, confidence, or decision-writer logic.
- `approval_envelope.forbidden_without_ack[]` preserved verbatim in user-facing presentation.
- Stage commands remain byte-identical when invoked directly (R1 regression guarantee); this wrapper does not intercept direct invocation of `/sunco:plan`, `/sunco:execute`, etc.
</constraints>
