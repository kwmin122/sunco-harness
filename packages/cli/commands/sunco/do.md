---
name: sunco:do
description: Route freeform text to the right sunco command automatically. Describe what you want in natural language and the right command will be selected and run.
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
</context>

<objective>
Intelligent command router. Analyzes freeform input and routes to the most appropriate sunco command. If intent is ambiguous, asks one clarifying question.
</objective>

<process>
## Step 1: Parse intent

Analyze $ARGUMENTS for keywords and intent patterns:

| Pattern | Route to |
|---------|---------|
| "bootstrap", "new project", "start a project", "아이디어로 시작", "아이디어와 함께 스킬사용" | `/sunco:new` using the default office-hours → Superpowers brainstorming → new chain |
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
| "full auto", "run everything" | `/sunco:auto` |

## Step 2: Extract arguments

From the input, extract:
- Phase number if mentioned
- Task description if it's an ad-hoc task
- Any flags that should be passed

## Step 3: If ambiguous

If the intent matches 2+ commands equally:
Ask one clarifying question: "Did you mean to [option A] or [option B]?"

## Step 4: Route

Show: "Routing to: `/sunco:[command] [args]`"
Then execute the routed command with appropriate arguments.

## Examples

Input: "I need to fix a bug in the lint skill"
→ `/sunco:debug --file packages/skills-harness/src/lint.skill.ts`

Input: "start planning phase 3"
→ `/sunco:discuss 3`

Input: "ship phase 2 as a draft PR"
→ `/sunco:ship 2 --draft`

Input: "I want to capture an idea about adding a graph command"
→ `/sunco:note add graph command idea`
</process>
