# Phase 31: Hashline Stale-Edit Guard - Context

**Gathered:** 2026-04-10
**Status:** Candidate — pending prioritization
**Upstream:** Phase 27 (OMO UX patterns)

<domain>
## Phase Boundary

This phase implements a **Hashline**-style guard: when a file is read for editing, the system injects or associates a content-hash per line (invisible in the agent’s natural view of file content). When an edit is applied, hashes are verified; if the on-disk file changed between read and edit (stale read), the edit fails fast instead of silently clobbering concurrent changes. The goal is preventing lost-update bugs when multiple agents or humans touch the same files.

This phase does not redefine SUNCO’s skill-only architecture; the guard sits at the execution/edit boundary. It does not promise full CRDT or merge semantics—only conflict detection and safe failure.
</domain>

<decisions>
## Open Questions (pre-discuss)

1. **Injection point** — Executor layer, file provider, editor adapter, or another choke point in the read→edit pipeline?
2. **Performance** — Expected overhead for large files (hashing strategy, incremental updates, caching)?
3. **Opt-in model** — Global default, per-skill flag, per-repo config, or environment-gated experimental mode?
4. **Git interaction** — How do `git checkout`, `git pull`, and rebases interact with stored hashes (invalidate vs reconcile)?
5. **Alignment with OpenCode/OMO** — What from existing Hashline implementations is normative vs optional for SUNCO’s contract?
</decisions>

<canonical_refs>
## References

- `.planning/research/opencode-integration.md` §1.2 (Hashline section)
- OMO / OpenCode Hashline implementation (reference for behavior and edge cases)
</canonical_refs>

<deferred>
## Deferred

- Automatic three-way merge or intelligent conflict resolution.
- Line-hash persistence across arbitrary external editors outside the harness.
- Cryptographic non-repudiation (hashes are for staleness detection, not signing).
</deferred>
