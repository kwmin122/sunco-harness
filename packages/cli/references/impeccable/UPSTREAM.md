# Upstream Tracking — Impeccable

| Field | Value |
|-------|-------|
| **Source** | https://github.com/pbakaus/impeccable |
| **Pinned commit** | `00d485659af82982aef0328d0419c49a2716d123` |
| **Fetched** | 2026-04-18 |
| **Next sync review** | 2026-07-18 (quarterly) |
| **License** | Apache License 2.0 |
| **Upstream copyright** | © 2025 Paul Bakaus |

---

## Provenance verification order

This is the exact order used during Phase 38/M2.1 vendoring. Any re-vendoring (see "Refresh workflow" below) must repeat this order.

1. `git clone --depth 1 https://github.com/pbakaus/impeccable.git tmp/impeccable-upstream`
2. `cd tmp/impeccable-upstream && git rev-parse HEAD` → record SHA
3. Verify LICENSE at pinned SHA:
   - `test -f LICENSE`
   - `grep -q "Apache License" LICENSE`
   - `grep -q "Copyright 2025 Paul Bakaus" LICENSE`
4. Verify NOTICE.md at pinned SHA:
   - `test -f NOTICE.md`
   - `grep -q "Anthropic" NOTICE.md`
5. If any verification fails → abort, do NOT copy, revisit `SUNCO-ATTRIBUTION.md`.
6. On success, copy files pristine to `references/impeccable/`:
   - `LICENSE` → `LICENSE`
   - `NOTICE.md` → `NOTICE.md`
   - `source/skills/**` → `source/skills/`
   - `src/detect-antipatterns.mjs` → `src/detect-antipatterns.mjs`

## Pristine invariant (R5 + Gate 2 G4)

Vendored source under `references/impeccable/source/` and `references/impeccable/src/` is byte-identical to upstream@`00d485659af82982aef0328d0419c49a2716d123`. **Zero patches applied.** Any modification must go through `references/impeccable/wrapper/` — never the vendored source.

**Verification command** (run anytime upstream is re-cloned):

```bash
cd ~/SUN/sunco-harness
diff -r tmp/impeccable-upstream/source/skills packages/cli/references/impeccable/source/skills
diff -q tmp/impeccable-upstream/src/detect-antipatterns.mjs packages/cli/references/impeccable/src/detect-antipatterns.mjs
diff -q tmp/impeccable-upstream/LICENSE packages/cli/references/impeccable/LICENSE
diff -q tmp/impeccable-upstream/NOTICE.md packages/cli/references/impeccable/NOTICE.md
# All should return empty. Any output = pristine violation, investigate.
```

Automated invariant checks are in `packages/cli/bin/smoke-test.cjs` Section 13.

**Known upstream strings preserved verbatim** (these MUST remain unchanged in the vendored copy, including in non-Claude runtime installs):

- `.claude/skills` in `source/skills/impeccable/scripts/cleanup-deprecated.mjs` — Anthropic-specific runtime path reference inside upstream script. The `install.cjs` no-replacement handling for `references/impeccable/source/` ensures this literal survives `copyDirWithReplacement`'s `.claude/` → `{runtimeDir}/` rewrite.
- `.impeccable.md` references in `source/skills/impeccable/SKILL.md` (2×) and `source/skills/shape/SKILL.md` — Impeccable's own convention for in-project design-context files. Vendored copy MUST preserve these; the `wrapper/context-injector.mjs` layer handles the mapping to SUNCO's `.planning/domains/frontend/DESIGN-CONTEXT.md`.

## Excluded intentionally

| File | Reason for exclusion |
|------|----------------------|
| `src/detect-antipatterns-browser.js` | SUNCO v1.4 uses Node CLI detector path only. Browser detector may be reconsidered if a browser/runtime integration phase is added in future milestones. |

Other upstream directories/files (`.claude/`, `.codex/`, `.cursor/`, `.gemini/`, `.kiro/`, `.opencode/`, `.pi/`, `.rovodev/`, `.trae/`, `.trae-cn/`, `.github/`, `bin/`, `content/`, `extension/`, `functions/`, `lib/`, `public/`, `scripts/`, `server/`, `tests/`, `AGENTS.md`, `biome.json`, `bun.lock`, `CLAUDE.md`, `DEVELOP.md`, `HARNESSES.md`, `package.json`, `README.md` (upstream), `README.npm.md`, `skills-lock.json`, `wrangler.toml`) are **not vendored** — Phase 38 scope is LICENSE + NOTICE + `source/skills/` + `src/detect-antipatterns.mjs` only (per spec §6 Phase 2.1 deliverables 1-3).

## Refresh / upgrade workflow

When upgrading to a newer Impeccable version:

1. `rm -rf tmp/impeccable-upstream` (or work in a new tmp path).
2. `git clone --depth 1 https://github.com/pbakaus/impeccable.git tmp/impeccable-upstream`.
3. `cd tmp/impeccable-upstream && git rev-parse HEAD` → new pinned SHA.
4. Run the provenance verification order above at the new SHA.
5. Compare upstream structure changes. If upstream added/removed files within the vendoring scope (LICENSE, NOTICE.md, `source/skills/`, `src/detect-antipatterns.mjs`), or added new `.claude/`-style runtime-specific strings, adjust the copy plan and `install.cjs` no-replacement scope accordingly.
6. Update this `UPSTREAM.md` with new pinned SHA, fetched date, next review date.
7. Re-run Phase 38-style copy operations.
8. Run smoke-test Section 13. All pristine invariant assertions must pass before committing.
9. Commit with message referencing old SHA → new SHA delta and any scope/invariant changes.

Upstream provenance and license compliance (Apache-2.0) are preserved across refreshes because the vendoring process itself does not alter upstream content.

## License & attribution layering

`references/impeccable/` uses a 3-file attribution layering:

| File | Authored by | Purpose |
|------|-------------|---------|
| `LICENSE` | Paul Bakaus (upstream) | Apache-2.0 verbatim |
| `NOTICE.md` | Paul Bakaus / Anthropic (upstream) | Upstream attribution — Impeccable copyright + Anthropic frontend-design skill attribution |
| `SUNCO-ATTRIBUTION.md` | SUNCO | SUNCO-specific integration notes, wrapper-not-patch rationale, and how Impeccable plugs into SUNCO's Phase 39/41 flow |
| `README.md` | SUNCO | Integration overview, directory layout, wrapper design entry points |
| `wrapper/README.md` | SUNCO | Wrapper layer explanation: pristine rationale + context-injector + detector-adapter + fallback policy |

No separate `SUNCO-AUTHORED-NOTICE.md` exists. Two `NOTICE`-named files would be ambiguous; SUNCO attribution stays in `SUNCO-ATTRIBUTION.md` by design.

---

*Introduced in Phase 38/M2.1 (2026-04-18). Gate 2 closed: Codex GREEN, Claude GREEN (v1 G6/G8 YELLOW → v2 GREEN after scope trim; G1 license verification sub-item added). Spec: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §6 Phase 2.1.*
