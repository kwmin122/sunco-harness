# Phase 15: Document Generation - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

## Phase Boundary

Three document generation skills: HWPX (Korean government/enterprise standard), markdown docs (README/API), and a template system. All self-implemented, zero external dependencies.

## Implementation Decisions

### DOC-01: HWPX Document Generation
- HWPX = OWPML (KS X 6101 Korean standard) = ZIP containing XML files
- Self-implement: create XML files → zip into .hwpx
- No external library (not hwpxjs, not Hancom SDK)
- Reference: hancom-io/hwpx-owpml-model (Apache-2.0) for structure
- Minimum viable: section.xml (본문), header.xml (머리글), content.hpf (manifest)
- Agent reads project context (PROJECT.md, ROADMAP.md) → generates document content
- Templates: 제안서, 수행계획서, 보고서

### DOC-02: Markdown Document Generation
- `sunco doc:md --type readme` generates README.md from project analysis
- `sunco doc:md --type api` generates API documentation
- `sunco doc:md --type architecture` generates architecture document
- Agent-powered: reads codebase → generates structured markdown

### DOC-03: Template System
- .sun/templates/ directory for user-defined templates
- Template = markdown with {{placeholder}} variables
- `sunco doc --template <name>` uses template
- Built-in templates bundled with SUNCO

### Claude's Discretion
- HWPX XML structure details (minimal viable)
- Which template variables to support
- Whether to support HWP (binary) in addition to HWPX
