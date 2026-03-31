---
name: sunco:doc
description: Generate documents from the codebase and planning artifacts. Supports Korean standard formats (HWPX), Markdown, and structured templates.
argument-hint: "[--hwpx] [--md] [--template <name>] [--type <type>] [--out <path>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
---

<context>
**Flags:**
- `--hwpx` — Output as HWPX (Korean standard document format, .hwpx)
- `--md` — Output as Markdown (default if no format specified)
- `--template <name>` — Use a named template. Available: `proposal`, `plan`, `report`, `readme`, `api`
- `--type <type>` — Document type. Options: readme, api, architecture, 제안서, 수행계획서, 보고서
- `--out <path>` — Output file path. Default: `docs/[type]-[date].[ext]`
</context>

<objective>
Generate polished documents from planning artifacts and codebase analysis. Supports Korean government/enterprise standard document formats (HWPX) for 제안서 and 수행계획서.

**Creates:**
- Document at specified path (or `docs/[type]-[date].[ext]`)
</objective>

<process>
## Step 1: Determine document type

Parse $ARGUMENTS for `--type` and `--template`.

If neither specified: ask "What type of document? (readme / api / architecture / 제안서 / 수행계획서 / 보고서)"

## Step 2: Gather source material

**For README:**
- Read `CLAUDE.md` for project overview
- Read `.planning/PROJECT.md` for goals and constraints
- Read `.planning/REQUIREMENTS.md` for feature list
- Scan `packages/` for structure overview
- Read `package.json` for installation commands

**For API docs:**
- Scan `packages/*/src/**/*.ts` for exported functions
- Read JSDoc comments
- Check for existing OpenAPI specs

**For Architecture:**
- Read `CLAUDE.md` architecture section
- Read `.planning/PROJECT.md`
- Scan `packages/` structure
- Read key skill files for pattern documentation

**For 제안서 (Proposal):**
- Read `.planning/PROJECT.md` — vision, problem, goals
- Read `.planning/REQUIREMENTS.md` — scope
- Read `.planning/ROADMAP.md` — timeline
- Ask for: company name, project title, submission date, budget if needed

**For 수행계획서 (Execution Plan):**
- Read `.planning/ROADMAP.md` — all phases
- Read each PLAN.md for task details
- Ask for: team members, schedule, milestones

**For 보고서 (Report):**
- Read `.planning/STATE.md` — current status
- Read completed phase SUMMARY.md files
- Ask for: report period, audience

## Step 3: Generate content

Spawn an agent to generate the document:

"Generate a [type] document for this project.

Source material:
[collected material]

Format: [HWPX structure / Markdown]
Template: [if specified]
Audience: [developers / management / government]

Requirements for [type]:
[type-specific requirements]

For Korean documents (제안서/수행계획서):
- Use formal Korean (존댓말)
- Follow Korean government document structure
- Include: 개요, 추진배경, 사업목표, 추진전략, 기대효과
- Page structure: cover → table of contents → body → appendix"

## Step 4: Format output

**For Markdown:** Write directly.

**For HWPX:**
Generate as structured Markdown first, then note:
"To convert to HWPX, open in Hancom Office or use the hwpx converter:
`npx hwpx-convert [input.md] [output.hwpx]`"

Alternatively, generate an HTML structure that maps to HWP paragraph styles.

## Step 5: Write output file

Create `docs/` directory if needed.
Write document to output path.

Report: "Document generated: [path]"
</process>
