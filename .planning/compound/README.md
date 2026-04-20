# `.planning/compound/` — Compound artifacts

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

## What lives here

Compound artifacts auto-written by `/sunco:compound` (Phase 54/M6 deliverable). Each file is a structured retrospective produced when the SUNCO Compound-Router's trigger score crosses threshold (≥5) or when an always-on event fires (RELEASE stage exit, milestone closure).

File naming convention: `<scope>-<ref>-<YYYYMMDD>.md` (e.g., `release-v0.12.0-20260420.md`, `milestone-M6-20260501.md`, `incident-72a391a-20260415.md`).

## Structure

Each artifact conforms to `packages/cli/schemas/compound.schema.json` (Phase 54):

- YAML frontmatter: `kind: compound`, `version: 1`, `scope`, `ref`, `window.{from,to}`, `status`, `source_evidence[]`, `sections[]` (8 canonical names), `clean_room_notice: true`, `generated_by: sunco-compound-router`
- 8 required markdown sections in canonical order: `context`, `learnings`, `patterns_sdi`, `rule_promotions`, `automation`, `seeds`, `memory_proposals`, `approval_log`

Template: `packages/cli/references/compound/template.md`.

## Write policy (auto-write boundary)

**Auto-write**: `.planning/compound/*.md` only. Path-allowlist enforced at `compound-router.mjs` writer boundary. Any other path throws `CompoundWriterPathError`.

**Proposal-only sinks**: `memory/`, `.claude/rules/`, `.planning/backlog/`, SDI counter state. These are emitted as structured sections *inside* the compound artifact (`patterns_sdi`, `rule_promotions`, `memory_proposals`) but never written to directly by compound-router or sink-proposer. User ACK required via downstream flow.

## Lifecycle

`draft` → `proposed` (auto-written at this status) → `partially-approved` → `approved` → `archived`.

Compound-router writes at `proposed`. Status transitions to `partially-approved` / `approved` happen via user edits as sink proposals are reviewed. `archived` applies when a later compound artifact supersedes this one.

## Phase 54 scope

This directory exists **empty** at Phase 54 Commit B landing. The first compound artifact is written by the first `/sunco:compound` invocation (user-triggered). Phase 55 dogfood will populate retroactive v1.4 compound artifact at `.planning/compound/release-v0.12.0-20260420.md` per DESIGN-v1.md §10 row 3 expectation.

## Phase 55 retroactive backfill contract

Phase 55 will produce `.planning/compound/release-v0.12.0-20260420.md` using the same `compound-router.mjs` + `sink-proposer.mjs` runtime as interactive `/sunco:compound`. The retroactive artifact uses `scope: release`, `ref: v0.12.0`, `window` covering the v1.4 milestone span, and populates `source_evidence[]` with retroactive route decision log entries (also backfilled per DESIGN §11 31d).

## Hard-locks honored by compound-router writing here

- Only `*.md` files (no subdirectories; no other extensions)
- Never writes outside `.planning/compound/` (path-allowlist enforced at writer boundary)
- Never auto-transitions status (status transitions require user edit)
- Never writes sink state (memory / rules / backlog / SDI counter) — proposals live inside the artifact, not outside
