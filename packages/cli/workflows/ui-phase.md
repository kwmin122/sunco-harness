# UI Phase Workflow — Surface Dispatcher

Router for `/sunco:ui-phase`. Parses `--surface {cli|web|native}` and dispatches to the corresponding surface-specific workflow. Default surface is `cli` to preserve backward-compatible no-flag behavior.

> **Non-negotiable** (spec R4 — explicit-only triggers): stack detection below emits warnings only. It NEVER overrides an explicit `--surface` value, and NEVER auto-changes surface routing. The user, not the workflow, owns surface selection.

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | current phase from STATE.md |
| `--surface <name>` or `--surface=<name>` | `SURFACE` | `cli` |

Normalize `SURFACE` to lowercase. Accept exactly these values: `cli`, `web`, `native`.

**Invalid value handling.** If `SURFACE` is set but not one of the accepted values, emit a usage error and exit without dispatch:

```
ERROR: Invalid --surface value: <received>
Valid: cli, web, native
Usage: /sunco:ui-phase [phase] [--surface {cli|web|native}]
```

**Repeated flag handling.** If `--surface` appears multiple times, use the last occurrence (standard flag semantics) and emit a single line to stderr:

```
⚠ --surface specified multiple times; using last value: <value>
```

**Missing flag handling.** If `--surface` is omitted, default to `cli` — identical to pre-dispatcher behavior. The CLI path (see `ui-phase-cli.md`) is byte-identical to the pre-Phase-36 `ui-phase.md` except for the removal of the vestigial `--surface` parsing row (router now owns surface selection).

---

## Step 2: Sanity Pre-check (warning only, non-blocking)

Read `./package.json` if present. If absent, skip this step silently — no warning, no error.

Detect surface-stack signals:

```bash
WEB_HIT=$(grep -Eo '"(react|vue|svelte|next|astro|nuxt|remix|solid|qwik)"' ./package.json 2>/dev/null | head -1)
CLI_HIT=$(grep -Eo '"(ink|blessed|terminal-kit|chalk|commander|meow)"' ./package.json 2>/dev/null | head -1)
```

Emit a warning to stderr only when a mismatch is detected between detected stack and requested `--surface`:

| Detected stack      | `--surface cli` | `--surface web` | `--surface native` |
|---------------------|-----------------|-----------------|--------------------|
| Web-stack only      | ⚠ warning       | (no warning)    | ⚠ warning          |
| CLI-stack only      | (no warning)    | ⚠ warning       | ⚠ warning          |
| Both / neither      | (no warning)    | (no warning)    | (no warning)       |

**Warning format:**

```
⚠ SANITY: package.json suggests <detected> stack, but --surface <chosen> was requested.
  Continuing with <chosen> as explicitly requested. (Explicit-only policy — no auto-routing.)
```

The warning does **not** change the dispatch. The user's explicit flag always wins.

---

## Step 3: Dispatch

Based on the resolved `SURFACE`:

| `SURFACE` | Include file             | Status                                        |
|-----------|--------------------------|-----------------------------------------------|
| `cli`     | `ui-phase-cli.md`        | Active — original workflow (renamed in Phase 36/M1.2) |
| `web`     | `ui-phase-web.md`        | Stub — implementation pending in Phase 40/M2.3 |
| `native`  | `ui-phase-native.md`     | Stub — not supported in v1; candidate for v2  |

All surface branches receive the same `PHASE_ARG` resolution; the router does no additional phase parsing beyond Step 1.

**Include semantics.** When dispatching, read the full content of the target workflow file from `packages/cli/workflows/` (or `~/.claude/sunco/workflows/` in installed runtime) and follow its instructions as if invoked directly.

---

## Invariants (Phase 36/M1.2)

These constraints preserve the router's surface boundary. Phase 37+ must not weaken them without re-entering a Gate decision:

1. **Default=cli preserves no-flag behavior.** `/sunco:ui-phase <phase>` with no flag executes `ui-phase-cli.md`, which is byte-identical to the pre-Phase-36 `ui-phase.md` except for removal of the vestigial `--surface` parsing row. Zero regression on the CLI path.
2. **No auto-routing.** Stack detection (Step 2) emits warnings only. Surface choice is always explicit; the router never silently changes surface based on project shape.
3. **Pure surface branches.** `ui-phase-cli.md`, `ui-phase-web.md`, `ui-phase-native.md` each implement a single surface and do **not** re-parse `--surface`. The router owns surface selection.
4. **Rollback anchor.** Pre-Phase-36 stable state is `origin/main @ 6010039`. Rollback via `git revert` (new commit), not `git reset --hard` + force-push, because the stable state is already published.

---

## Install sync note

Source-of-truth lives in `packages/cli/workflows/`. The installed runtime at `~/.claude/sunco/workflows/` is populated by `packages/cli/bin/install.cjs` via file copy (not symlink). After any change to this router or its surface branches, a re-run of `npx popcoru` (or `node packages/cli/bin/install.cjs`) is required to reflect changes in the installed runtime. Phase 36 does not mutate the installed runtime; that is explicit, user-driven.

---

*Router introduced in Phase 36/M1.2 (2026-04-18). Context: `.planning/phases/36-ui-dispatcher-skeleton/36-CONTEXT.md`. Spec: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §4 Phase 1.2. Gate 1 judges: Codex GREEN, Claude GREEN (A3 YELLOW → observable-behavior-equivalent accepted).*
