# Phase Argument Parsing

How SUNCO parses phase arguments from CLI inputs. Applied by `/sunco:execute`, `/sunco:plan`, `/sunco:discuss`, and any command that accepts a phase identifier.

---

## Overview

Phase arguments can be supplied as numbers, strings, or decimal numbers. SUNCO normalizes all formats to a canonical phase identifier before acting.

**Examples of valid phase arguments:**
```bash
sunco execute 3
sunco execute 03
sunco execute 03-skill-registry
sunco execute 3.1
sunco execute "03.1-hotfix-loader"
sunco execute next          # resolves to next incomplete phase
sunco execute current       # resolves to current phase from STATE.md
```

---

## Phase Number Extraction

### Integer phases

```typescript
// Input formats that resolve to phase 3:
"3"             → 3
"03"            → 3
"3-skill-registry"    → 3
"03-skill-registry"   → 3
"phase-03"      → 3  (tolerates "phase-" prefix)

// Regex:
const PHASE_INTEGER_PATTERN = /^(?:phase-)?0*(\d+)(?:[.-].*)?$/i
```

**Normalization rules:**
1. Strip leading zeros: `"03"` → `3`
2. Strip "phase-" prefix if present
3. Strip name suffix (everything after the first `-` that follows the number)
4. Result is always an integer

### Directory name reconstruction

After extracting the number, SUNCO reconstructs the canonical directory name by looking up the phase in ROADMAP.md:

```typescript
// "3" resolves to the actual directory:
const phases = readRoadmap()
const phase = phases.find(p => p.number === 3)
// → { number: 3, name: "skill-registry", dir: "03-skill-registry" }
```

If the number does not exist in ROADMAP.md, the command errors with:
```
Error: Phase 99 not found in ROADMAP.md
Existing phases: 01, 02, 03, 04
```

---

## Flag Detection Patterns

Phase arguments can include modifier flags that change execution behavior.

### `--force` / `-f`

Bypasses the "phase already complete" guard. Allows re-executing a completed phase.

```bash
sunco execute 3 --force
sunco execute 03-skill-registry -f
```

Without `--force`, executing a completed phase shows:
```
Phase 03 is already marked complete. Use --force to re-execute.
```

### `--dry-run` / `-n`

Prints what would be executed without running it. Shows wave structure and task list.

```bash
sunco execute 3 --dry-run
sunco plan 3 --dry-run
```

### `--wave N`

Execute only a specific wave within a phase. Used for resume after partial failure.

```bash
sunco execute 3 --wave 2    # Run Wave 2 only, skip Wave 1
```

Wave number must be a positive integer. If the wave does not exist, the command errors.

### `--plan N`

Execute only a specific plan within a phase. Plans are numbered within their phase.

```bash
sunco execute 3 --plan 2    # Run Plan 02 only within Phase 03
```

### `--skip-verify`

Skip post-execution verification. Not recommended outside rapid iteration.

```bash
sunco execute 3 --skip-verify
```

---

## Decimal Phases

Decimal phases (3.1, 3.2) represent urgent work inserted between two existing integer phases. See `decimal-phase-calculation.md` for insertion rules.

### Decimal parsing

```typescript
// Input formats for decimal phases:
"3.1"                  → { major: 3, minor: 1 }
"03.1"                 → { major: 3, minor: 1 }
"03.1-hotfix-loader"   → { major: 3, minor: 1, name: "hotfix-loader" }
"3.10"                 → { major: 3, minor: 10 }  // not 1.0

// Regex:
const PHASE_DECIMAL_PATTERN = /^0*(\d+)\.(\d+)(?:-(.+))?$/
```

**Decimal phases sort after their major phase and before the next integer phase:**
```
03 → 03.1 → 03.2 → 04
```

### Decimal phase validation

The following are rejected with a clear error:

```bash
sunco execute 3.0    # Error: Minor version must be >= 1
sunco execute 3.01   # Error: Use 3.1, not 3.01 (leading zero in minor)
sunco execute 3.1.2  # Error: Nested decimals not supported (max depth: X.Y)
```

---

## Special Keywords

| Keyword | Resolves to |
|---------|-------------|
| `next` | Next incomplete phase in ROADMAP.md order |
| `current` | Phase marked as `in_progress` in STATE.md |
| `last` | Last phase in ROADMAP.md (regardless of status) |
| `all` | All phases (used by `/sunco:auto` only) |

### Resolution logic

```typescript
function resolvePhaseKeyword(keyword: string): PhaseRef {
  switch (keyword) {
    case 'current':
      return readState().currentPhase ?? error('No phase in progress')
    case 'next':
      return readRoadmap().phases.find(p => p.status !== 'complete')
        ?? error('All phases complete')
    case 'last':
      return readRoadmap().phases.at(-1) ?? error('No phases in roadmap')
    default:
      return parsePhaseNumber(keyword)
  }
}
```

---

## Error Handling

### Bad argument format

```
Error: Cannot parse "abc" as a phase argument.
Expected: a number (3, 03), a phase name (03-skill-registry),
          a decimal (3.1), or a keyword (next, current, last).
```

### Phase not found

```
Error: Phase 99 does not exist in ROADMAP.md.
Run `sunco status` to see existing phases.
```

### Wave not found

```
Error: Phase 03 does not have a Wave 5.
Phase 03 has 3 waves. Valid: --wave 1, --wave 2, --wave 3.
```

### Ambiguous decimal

```
Error: Phase 03.1 does not exist. Did you mean one of:
  03 (skill-registry)
  04 (skill-loader)
To insert a decimal phase between 03 and 04, run:
  sunco phase insert 3.1 --name "your-phase-name"
```
