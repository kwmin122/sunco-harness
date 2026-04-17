# Orchestrate Workflow

SUNCO's dynamic multi-agent router. Inspired by OmO's Sisyphus (AGPL-3.0, principles only, NOT vendored — clean-room reimplementation) and gstack's role-based sprint discipline.

## Why a separate orchestrator?

`/sunco:do` is a category front-door: it picks one skill and runs it. That is correct for small asks. But real work often needs a sequence of roles with different permissions (explorer reads, oracle reviews, developer writes, verifier proves). Hard-coding that sequence produces OmO's failure mode: every request gets the same pipeline whether it needs it or not.

`/sunco:orchestrate` solves that by detecting signals in the task description and building an ordered plan from those signals only. No signals, no step.

## Routing rules

The deterministic rules (implemented in `shared/orchestration-router.ts`):

| Signal | Evidence pattern | Role fired |
|---|---|---|
| unknown-location | `where is`, `locate`, `어디`, `찾아`, `trace how` | explorer |
| external-api | `api docs`, `sdk`, `library usage`, `공식 문서` | librarian |
| risky-change | `refactor`, `migrate`, `public api`, `schema change`, `cross-file`, `구조 변경` | oracle (read-only, both sides of developer) |
| ui-surface | `ui`, `ux`, `.tsx`, `component`, `css`, `디자인`, `화면` | frontend (replaces developer) |
| docs-only | `readme`, `changelog`, `docs`, `문서 수정` | docs (short-circuits) |
| test-failure | `tests failing`, `flaky test`, `테스트 실패` | debugger → verifier |
| explicit-verify | `verify`, `verification`, `검증`, `7-layer` | verifier only |
| exact-file | any `path/to/file.ts[:line]` match | reduces read-only prelude |

Multiple signals compose:
- `risky-change + external-api` → librarian → oracle → developer → oracle → verifier
- `unknown-location + ui-surface` → explorer → frontend → verifier

## HARD rules

- **No fixed pipeline.** The step list is signal-driven. If no signals match, the default path is `developer → verifier`. Never mandate `explorer → oracle → developer` for every task.
- The orchestrator does not write code. Every write step is delegated.
- Read-only roles always run before write roles when both are present.
- `--plan` / `--dry-run` is available for every task. Use it when in doubt.
- `--stop-on-fail` aborts the chain on first failure; default continues with remaining read-only steps so the user sees as much context as possible.

## Context Pack

Each step receives a Context Pack rendered as plaintext:

```
## Context Pack
Original request: <user's task>
Explicit files: src/a.ts, src/b.ts   (only if present in request)
Prior steps:
  - [explorer] located src/a.ts:42
  - [librarian] Stripe webhooks: use stripe.webhooks.constructEvent
```

The Context Pack is immutable from the user's perspective: `originalRequest` never changes, and `priorOutputs` only grows append-only. This mirrors OmO's "context preservation" principle without copying any OmO code.

## Attribution

- OmO (cexll/myclaude, AGPL-3.0): signal taxonomy and routing-first principle.
- gstack: role separation idea (Think/Plan/Build/Review/Test/Ship/Reflect).
- Superpowers: design-before-code HARD-GATE applies here too — orchestrate never substitutes for `/sunco:brainstorming`.

No code was copied from any of the above. The router is a clean-room deterministic implementation.
