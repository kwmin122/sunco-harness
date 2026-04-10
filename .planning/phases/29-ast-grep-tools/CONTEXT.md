# Phase 29: AST-Grep Deterministic Tools - Context

**Gathered:** 2026-04-10
**Status:** Candidate — pending prioritization
**Upstream:** Phase 27 (OMO UX patterns)

<domain>
## Phase Boundary

This phase wraps the ast-grep CLI for deterministic, pattern-based code search and navigation. It enhances existing workflow capabilities—specifically `workflow.graph` and `workflow.scan`—with AST pattern matching instead of (or in addition to) text-only matching. Support for many languages comes from ast-grep’s tree-sitter grammars (the “25-language” navigation story aligns with ast-grep’s grammar coverage).

This phase does not replace the skill model or introduce ad-hoc shell commands in product UX; integration stays behind skills and shared modules. It does not commit to reimplementing ast-grep or owning grammar maintenance beyond what the wrapper delegates to ast-grep.
</domain>

<decisions>
## Open Questions (pre-discuss)

1. **ast-grep vs tree-sitter direct** — Is the official ast-grep CLI the long-term integration surface, or should SUNCO bind tree-sitter directly for tighter control at the cost of more maintenance?
2. **Language scope** — Ship a broad “many languages” story immediately, or phase in a smaller allowlist (e.g. TS/JS first) to reduce test and CI surface?
3. **Integration point** — Extend `graph.skill` / `scan.skill` in place, or introduce a shared module (e.g. `ast-pattern` helpers) consumed by both?
4. **Performance and CI** — Where do ast-grep invocations run (local CLI only vs bundled binary), and what are the gates for deterministic timeouts and large repos?
5. **Contract with Phase 27** — How do OMO-inspired harness UX expectations (navigation, scan results) constrain CLI output shape and skill responses?
</decisions>

<canonical_refs>
## References

- `packages/skills-workflow/src/graph.skill.ts`
- `packages/skills-workflow/src/scan.skill.ts`
- `.planning/research/opencode-integration.md` §3.1
</canonical_refs>

<deferred>
## Deferred

- Full IDE-style “go to definition” across all 25 languages as a standalone product.
- Custom grammar authoring or forks of tree-sitter grammars inside SUNCO.
- Non-deterministic or LLM-assisted pattern inference (this phase stays deterministic).
</deferred>
