# Impeccable Integration (v1.4 M2 Frontend Fusion)

SUNCO wraps the vendored **Impeccable** skill so Claude Code users who need web-frontend UX review get Impeccable's deterministic checker + LLM critique under SUNCO's 6-stage review pipeline — without losing SUNCO's CLI-surface defaults.

This doc covers: when to use it, what you provide, what comes out, and how findings flow downstream.

---

## When to use Impeccable

Use `/sunco:ui-phase --surface web` and `/sunco:ui-review --surface web` when:

- The phase ships **web-browser UI** (HTML/CSS/JS — React, Vue, Svelte, etc.)
- You want deterministic UX-layer checks (contrast, focus-order, motion-reduce, semantic headings, keyboard traps, etc.) on top of general code review
- The phase has a frontend surface declared in `.planning/phases/${N}-*/${N}-CONTEXT.md` via `domains: [frontend]` (or `domains: [frontend, backend]`)

**Do NOT use `--surface web`** for:

- CLI / terminal UI phases → use `/sunco:ui-phase --surface cli` (default, no flag needed)
- Native desktop UI phases → use `/sunco:ui-phase --surface native`
- Backend-only phases → use `/sunco:backend-phase` instead
- Non-UI changes → no `/sunco:ui-*` command needed

Default behavior is **CLI surface**. `--surface web` is **opt-in**; v1.4 ships zero regression to existing CLI-surface invocations.

---

## What you provide — DESIGN-CONTEXT.md

Before invoking `/sunco:ui-phase --surface web`, populate the phase's frontend context via `/sunco:discuss ${N} --domain frontend`. The teach flow (Phase 39) asks 3 questions to produce `.planning/domains/frontend/DESIGN-CONTEXT.md`:

1. **Primary user action on this surface** — what does the user do on the page?
2. **Critical accessibility constraints** — any specific WCAG level, device class, i18n need?
3. **Design system boundaries** — tokens available? components allowed to extend? anti-patterns to watch?

DESIGN-CONTEXT.md is the **source of truth** for the ui-researcher-web agent. The vendored Impeccable skill expects `.impeccable.md` in its own convention — SUNCO's `context-injector.mjs` wrapper reads DESIGN-CONTEXT.md and presents its content to the skill as if it were `.impeccable.md`, preserving Impeccable's upstream interface while keeping SUNCO's naming authority.

You never write `.impeccable.md` yourself. The injector handles it.

---

## `/sunco:ui-phase --surface web`

Produces `.planning/domains/frontend/UI-SPEC.md` with a SPEC-BLOCK YAML body (`version: 1`, all 13 required fields per the `ui-spec.schema.json` contract). The SPEC-BLOCK is consumed downstream by:

- `/sunco:ui-review --surface web` (Impeccable detector + LLM critique)
- Phase 48 cross-domain-sync generator (when UI-SPEC + API-SPEC both exist — see `cross-domain.md`)
- Phase 49 verify-gate cross-domain layer (when the phase declares `domains: [frontend, backend]`)

Generation uses the `sunco-ui-researcher-web` agent with **clean-room reconstruction**, not vendored Impeccable authoring. The wrapper invokes the vendored skill only at review time (Phase 41), never at authoring time.

---

## `/sunco:ui-review --surface web`

Runs the Impeccable deterministic detector + LLM critique, then normalizes output into SUNCO's 6-pillar review format. Two files land in `.planning/domains/frontend/`:

1. **`IMPECCABLE-AUDIT.md`** — raw Impeccable findings (deterministic rules + LLM findings), unmodified from the vendored skill's emission format. This is the audit trail.

2. **`UI-REVIEW.md`** — SUNCO 6-pillar wrapping: findings grouped by Accessibility / Motion / Typography / Color & Contrast / Layout & Responsive / Information Architecture, with per-pillar scores 0-10 and rollup verdict.

**Default `/sunco:ui-review` (no flag) = CLI surface.** Zero regression. The `--surface web` flag is what wraps the vendored skill.

---

## How Impeccable findings flow into the pipeline

```
/sunco:ui-review --surface web
   │
   ├─▶ sunco-ui-reviewer-web agent spawn
   │       │
   │       ├─▶ context-injector.mjs reads DESIGN-CONTEXT.md
   │       │   (presents as .impeccable.md to vendored skill)
   │       │
   │       ├─▶ detector-adapter.mjs invokes vendored Impeccable skill
   │       │
   │       └─▶ output captured, normalized
   │
   ├─▶ IMPECCABLE-AUDIT.md (raw findings)
   │
   └─▶ UI-REVIEW.md (6-pillar wrapping with scores)
```

Findings in `IMPECCABLE-AUDIT.md` carry a `severity: HIGH | MEDIUM | LOW` label + `kind: deterministic | heuristic | requires-human-confirmation` classification. The `severity` label flows into `/sunco:proceed-gate` severity × state policy (see `cross-domain.md` for policy details) once the gate's cross-domain or findings-consumption layer is wired for frontend-scope findings in a future milestone.

At v1.4, `/sunco:proceed-gate` consumes findings from **CROSS-DOMAIN-FINDINGS.md** (cross-domain layer, M4.2) and **VERIFICATION.md** (all 7 verify layers). Frontend-only IMPECCABLE-AUDIT findings still flow through VERIFICATION.md's Layer 1 multi-agent review.

---

## Vendored skill wrapper strategy (why wrappers, not patches)

The Impeccable skill is vendored at `packages/cli/references/impeccable/vendored/` — **pristine source**, never patched. SUNCO's adapter layer lives at `packages/cli/references/impeccable/wrapper/`:

- `context-injector.mjs` — translates DESIGN-CONTEXT.md → .impeccable.md virtual content (10 self-tests pass)
- `detector-adapter.mjs` — normalizes Impeccable raw output → SUNCO finding format (22 self-tests pass)

**Why not patch the vendored source?** Patching creates upstream-sync fragility — any rename or refactor upstream breaks patches silently. Wrappers keep vendored source pristine; SUNCO owns the adapter layer. See `references/impeccable/wrapper/README.md` for the adapter contract.

If the upstream Impeccable skill changes its output schema, only `detector-adapter.mjs` needs updating — never the vendored source, never SUNCO's skills.

---

## Related docs

- **`backend-excellence.md`** — M3 backend-side companion (deterministic backend detector + 4 surfaces)
- **`cross-domain.md`** — M4 integration (CROSS-DOMAIN.md + CROSS-DOMAIN-FINDINGS.md + `/sunco:proceed-gate`)
- **`migration-v1.4.md`** — non-breaking adoption path from v0.11.x

---

*v1.4 M2 Frontend Fusion — Phase 38 (vendoring wrapper) + Phase 39 (discuss teach) + Phase 40 (ui-phase-web) + Phase 41 (ui-review WRAP).*
