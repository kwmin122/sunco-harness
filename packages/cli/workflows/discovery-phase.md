# Discovery Phase Workflow

Execute codebase and technology discovery at the appropriate depth before planning a phase. Produces DISCOVERY.md (for Level 2-3) that directly informs PLAN.md creation. Used by `/sunco:plan` when unknowns are detected, and directly by users who want to explore before planning.

---

## Depth Levels

| Level | Name | Time | Output | When |
|-------|------|------|--------|------|
| 1 | Quick Verify | 2-5 min | No file — proceed with confirmed knowledge | Confirming a known library's current API |
| 2 | Standard | 15-30 min | DISCOVERY.md | Choosing between options, new integration point |
| 3 | Deep Dive | 1+ hour | Comprehensive DISCOVERY.md with confidence gates | Architectural decisions, novel problems |

Depth is determined by the phase scope. Pass `depth=verify`, `depth=standard`, or `depth=deep` as argument. Default: `standard`.

---

## Source Hierarchy

Always consult sources in this order:

1. **Context7 MCP** — current library docs, no hallucination risk
2. **Official docs** — when Context7 lacks coverage
3. **WebSearch** — for comparisons and ecosystem trends only

Never rely on training knowledge for library APIs. Claude's training data is 6-18 months stale. Always verify.

---

## Overview

Five steps:

1. **Determine depth** — route to level 1, 2, or 3
2. **Identify unknowns** — what do we need to learn before planning?
3. **Execute discovery** — search, read, verify
4. **Write DISCOVERY.md** — structured findings with confidence levels
5. **Confidence gate** — if LOW confidence, ask how to proceed

---

## Step 1: Determine Depth

Parse the depth argument:
- `depth=verify` → Level 1
- `depth=standard` or no argument → Level 2
- `depth=deep` → Level 3

If called from `/sunco:plan`, the planner already set the depth. If called directly, ask:

```
Discovery depth?
  1. Quick Verify (2-5 min)  — confirming a known library's current syntax
  2. Standard (15-30 min)    — choosing between options, new integration
  3. Deep Dive (1+ hour)     — architectural decision, novel problem
```

---

## Step 2: Identify Unknowns

For Level 2-3, define what to learn before planning.

Read phase scope from ROADMAP.md:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
cat .planning/ROADMAP.md | grep -A 20 "Phase ${PADDED}"
```

Ask (inline, not a structured prompt): "What's uncertain about this phase?"

Common unknowns:
- Which library to use, and what's the current API?
- How does X integrate with our existing Y?
- What are the performance tradeoffs between approach A and B?
- Are there gotchas in this pattern we haven't hit before?

Group unknowns into a discovery scope:
- Include: specific questions to answer
- Exclude: things we already know with confidence
- Preferred approach (if pre-decided): just verify, don't re-decide

---

## Level 1: Quick Verify (2-5 minutes)

For: Single known library, confirming current syntax is unchanged.

**Process:**

1. Identify the library and specific API concern (e.g., "smol-toml stringify signature")

2. Resolve in Context7:
```
mcp__context7__resolve-library-id with libraryName: "[library]"
```

3. Fetch relevant docs:
```
mcp__context7__get-library-docs with:
  context7CompatibleLibraryID: [from step 2]
  topic: "[specific concern, e.g. stringify options]"
```

4. Verify:
   - Current version matches what's in package.json
   - API signature is unchanged from what plan assumes
   - No deprecation notices or breaking changes in recent releases

5. **If verified:** Return confirmation. No file needed.
   - "smol-toml stringify API confirmed current. Matches expected signature."

6. **If discrepancy found:** Note it inline and escalate to Level 2 automatically.
   - "API signature changed in v1.6. Escalating to Standard discovery."

**Output:** Verbal confirmation or escalation to Level 2. No DISCOVERY.md created.

---

## Level 2: Standard Discovery (15-30 minutes)

For: Integration with a new library, choosing between two options.

**Process:**

1. **List what to compare:**
   - Option A: [name, npm package, version]
   - Option B: [name, npm package, version]
   - Comparison criteria: developer ergonomics, bundle size, TypeScript quality, maintenance status

2. **Context7 for each option:**
```
For each library:
  mcp__context7__resolve-library-id libraryName: "[library]"
  mcp__context7__get-library-docs context7CompatibleLibraryID: [id] topic: "[use case]"
```
Pull: API style, configuration, integration examples relevant to our stack.

3. **Official docs** for anything Context7 doesn't cover (changelog, migration guide, known issues).

4. **WebSearch** for current-year comparisons:
   - "[option A] vs [option B] 2026"
   - "[option A] TypeScript support issues"
   - "[option] with ESM Node.js 24"

5. **Cross-verify:** Any WebSearch claim → confirm with Context7 or official source. Discard unverifiable claims.

6. **Write DISCOVERY.md** (see file structure below).

7. Return to `/sunco:plan` with the file path.

**Output:** `.planning/phases/XX-name/DISCOVERY.md`

---

## Level 3: Deep Dive (1+ hour)

For: Architectural decisions, patterns with no clear precedent in this codebase.

**Process:**

1. **Scope the discovery:**
   - Clear objective: "Determine how to implement skill-to-skill state passing without coupling skill implementations"
   - Include: state models, serialization formats, resume patterns
   - Exclude: UI, shipping, anything outside the core question
   - Questions to answer: [list explicitly]

2. **Exhaustive Context7 research:**
   - All libraries relevant to the domain
   - Multiple topics per library if needed
   - Cross-reference related concepts (e.g., "event sourcing" if researching state)

3. **Official documentation deep read:**
   - Architecture guides and best practices
   - Migration and upgrade guides (to understand design intent)
   - Known limitations sections

4. **WebSearch for production context:**
   - "How [X] is typically solved in [domain] at scale"
   - "[pattern] anti-patterns"
   - "[approach] production experience [current year]"

5. **Cross-verify ALL findings:**
   - Every WebSearch claim → verify with Context7 or official source
   - Mark each finding: verified / assumed / contradicted
   - List contradictions explicitly — flag for user review

6. **Identify validation checkpoints:**
   If any critical finding has LOW confidence, create a checkpoint task:
   - "Validate: [claim] — run [test/POC] in Phase X, Step Y"

7. **Write comprehensive DISCOVERY.md** (see file structure below).

8. Run confidence gate.

**Output:** `.planning/phases/XX-name/DISCOVERY.md` (comprehensive)

---

## DISCOVERY.md File Structure

```markdown
# Discovery: [Topic]

Phase: XX — [Phase Name]
Depth: standard | deep
Date: [ISO date]
Status: complete | in-progress

## Objective

[One sentence: what question this discovery answers]

## Scope

Include:
- [what was researched]

Exclude:
- [what was deliberately skipped]

## Recommendation

[One clear recommendation with rationale]
Confidence: HIGH | MEDIUM | LOW

## Findings

### [Option A / Approach A]

**Source:** Context7 + official docs
**Version verified:** [version]

Key facts:
- [fact 1]
- [fact 2]

Code example (from Context7):
```[language]
[actual current example]
```

Verdict: [chosen | rejected | use for X]

### [Option B / Approach B]

[same structure]

## Integration Notes

[How the chosen option fits into SUNCO's existing architecture]
[Any adapter or wrapper needed?]
[Files that need to change]

## Open Questions

- [question 1] — can be addressed during implementation
- [question 2] — needs user decision before planning

## Assumptions

- [assumption 1]
- [assumption 2]

## Validation Checkpoints (Level 3 only)

- [ ] [claim] — validate in Phase X, Step Y
```

---

## Step 4: Confidence Gate

After creating DISCOVERY.md, check the confidence level.

**HIGH confidence:**
Proceed directly. Print: "Discovery complete (high confidence). [Recommendation in one line]."

**MEDIUM confidence:**
Print inline: "Discovery complete (medium confidence). [Brief reason for uncertainty]. Proceed to planning?"
Wait for response. If no → offer to dig deeper.

**LOW confidence:**
Present options:

```
Discovery confidence is LOW: [reason]

Options:
  1. Dig deeper (more research before planning)
  2. Proceed anyway (plan with explicit uncertainty caveats)
  3. Pause (I need to think about this first)
```

Wait for user response. Route accordingly.

---

## Step 5: Open Questions Gate

If DISCOVERY.md has open questions:

```
Open questions from discovery:

  1. Should state be JSON or binary? [affects Plan 2]
  2. Do we need streaming support in v1.1 or v2.0? [affects architecture]

Acknowledge and proceed? (yes / address first)
```

If "address first": gather user input, update discovery file, then proceed.

---

## Output and Next Steps

```
Discovery complete → .planning/phases/XX-name/DISCOVERY.md
Recommendation: [one-liner]
Confidence: HIGH

Next:
  /sunco:discuss XX   gather phase context with discovery as input
  /sunco:plan XX      create phase plan (will read DISCOVERY.md automatically)
```

DISCOVERY.md is not committed separately. It is committed when the phase transitions or completes.

---

## Success Criteria

**Level 1:**
- [ ] Context7 consulted for specific library/topic
- [ ] Current API verified (or discrepancy found and escalated)
- [ ] Verbal confirmation returned — no file created

**Level 2:**
- [ ] All options researched via Context7 + official docs
- [ ] WebSearch findings cross-verified against authoritative sources
- [ ] DISCOVERY.md written with clear recommendation
- [ ] Confidence MEDIUM or higher

**Level 3:**
- [ ] Discovery scope defined with explicit include/exclude
- [ ] Context7 exhaustively consulted for all relevant libraries
- [ ] All WebSearch claims verified — contradictions flagged
- [ ] Validation checkpoints defined for LOW confidence findings
- [ ] Confidence gate passed
- [ ] DISCOVERY.md ready to directly inform PLAN.md
