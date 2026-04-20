# Confidence Calibration — SUNCO Workflow Router

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

## Principle

Confidence is a **deterministic, pure-function number** derived from evidence signals with a frozen weight map. No LLM participates in the numeric calculation. The number drives band-based behavior (auto-proceed vs ask vs refuse) that preserves user agency when evidence is thin.

## Bands

| Band | Range | Behavior |
|------|-------|----------|
| `HIGH` | `≥ 0.80` | Router presents recommendation + auto-proceeds on `action.mode = auto_safe` actions. For `requires_user_ack`, router emits a one-line prompt with default ACK. |
| `MEDIUM` | `0.50 – 0.799` | Router presents top-2 stage options with reasoning; user selects. |
| `LOW` | `< 0.50` | Router shows evidence summary + stage candidate list; **no recommendation**. User clarifies or corrects evidence. |
| `UNKNOWN` | Freshness Gate drift or ambiguous evidence | Router emits freshness report; no stage decision. Separate from band math. |

## Deterministic formula

```
confidence = Σ (w_i × signal_i) / Σ (w_i)
```

where `signal_i ∈ [0, 1]` and `w_i` is a frozen constant.

### Frozen weight map (v1 — NOT user-tunable)

| Signal | Weight `w_i` | Source |
|--------|--------------|--------|
| `phase_artifacts_complete` | 0.25 | `.planning/phases/<N>/` expected files presence ratio |
| `git_state_matches_stage` | 0.20 | `git status` + `git log` coherence with declared stage |
| `state_md_alignment` | 0.15 | STATE.md frontmatter vs ROADMAP.md vs disk state |
| `test_state_known` | 0.15 | last known smoke/test run outcome persisted in repo |
| `precondition_coverage` | 0.15 | entry_preconditions satisfied ratio for candidate stage |
| `recent_user_intent_match` | 0.10 | intent_hint from `/sunco:do` or last user action |

Weights are declared as a single frozen object literal in the source module `references/router/src/confidence.mjs` (Phase 52b). No configuration file overrides weights in v1. Tunable weights are D3 in open decisions; v2 candidate.

## Enforcement invariants

The Phase 52b runtime must satisfy these invariants. Phase 52a asserts the contract; Phase 52b asserts the runtime via Smoke Section 27 runtime subset (27p-s).

### I1 — Determinism

`compute_confidence(evidence) -> number` is a pure function. Same `evidence` inputs yield byte-identical confidence output across 100 repeated calls. No timestamp, random, or provider-roundtrip in the calculation path.

**Smoke assertion (27p, 52b)**: 100-iteration invocation on a fixture evidence map produces byte-identical output.

### I2 — Bounds

- `confidence((empty evidence)) == 0`
- `confidence((all positive signals == 1)) == 1.0`

**Smoke assertions (27r, 52b)**: both edge cases asserted explicitly.

### I3 — Monotonicity

Removing a single positive signal (setting it to 0) must cause confidence to **strictly decrease or preserve**, never increase.

**Smoke assertion (27q, 52b)**: six-signal fixture; remove each signal in turn; verify non-increasing delta.

### I4 — No LLM

The `compute_confidence` module must not import any LLM SDK (anthropic, openai, ai, agent, etc.). Narrative `reason[]` rendering may call an LLM, but the numeric confidence path stays deterministic.

**Smoke assertion (27s, 52b)**: source grep on `references/router/src/confidence.mjs` for SDK imports; must return zero matches.

## Failure fallback mode

If any I1-I4 invariant fails, the router ships in a **degraded mode**:

- `HIGH` band is disabled (auto-proceed suppressed)
- Router emits only `MEDIUM` or `LOW` recommendations
- Each route decision includes a `reason` entry: `"confidence-invariant-failure: <I1|I2|I3|I4> — HIGH band suppressed"`
- Degraded mode persists until the failing invariant is repaired and Smoke Section 27 runtime subset re-passes

This prevents a bug in the confidence module from silently pushing users into auto-execution.

## Band behavior details

### HIGH band (≥ 0.80)

- Router recommends a single next stage + `action.command`
- If `action.mode = auto_safe` and `approval_envelope.risk_level ∈ {read_only, local_mutate}`, router auto-proceeds (no prompt)
- If `requires_user_ack`, one-line prompt: "Proceed with `<command>`? [Y/n]" with default Y
- User may always interrupt with Ctrl-C or explicit `/sunco:router reset <target>`

### MEDIUM band (0.50 – 0.799)

- Router emits top-2 `recommended_next` options ordered by contributing signal weight
- Each option includes a brief reason trace
- User selects option 1, option 2, or provides clarification
- No auto-proceed regardless of `action.mode`

### LOW band (< 0.50)

- Router emits evidence summary (Tier 1/2 signals with raw values) + full stage candidate list
- **No recommendation** — the router explicitly declines
- User is expected to clarify scope, correct evidence drift, or invoke a specific stage command manually
- This prevents low-evidence narrative from becoming a self-fulfilling recommendation

## Bias prevention

Confidence reporter **never self-inflates**:

- Weights are frozen constants; router cannot adjust them at runtime
- Evidence signals are produced by pure parsers with no smoothing or defaulting; missing signal → explicit 0 with reason in `evidence_refs[]`
- `reason[]` rendering order is determined by contributing weight, not by narrative preference
- No feedback loop where a high confidence output boosts subsequent classifications

## Open decision pointer

D3 — "learned confidence weights from `.planning/router/decisions/` history" is a v2 candidate. v1 uses deterministic frozen weights only. Any shift to learned weights must re-validate all four invariants (I1-I4) and re-express determinism in probabilistic terms (e.g., same history + same inputs → same output).
