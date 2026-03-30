# Phase 16: Publish Ready - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

## Phase Boundary

Everything needed to `npm publish` — quality infrastructure, package preparation, documentation, CI/CD. This is the final gate before the world sees SUNCO.

## Wave 3: Quality Infrastructure

### C7: Agent Router real provider test
- Test with actual Claude Code CLI (if installed)
- Test with ANTHROPIC_API_KEY (if available)
- Graceful degradation when neither available
- Mock-free integration test that validates the full dispatch chain

### C3: Dogfooding — run sunco init on SUN itself
- `sunco init` in the SUN project root
- Verify: .sun/ created, stack detected (TypeScript/Node/Turborepo), layers identified, rules generated
- Fix any issues found

### C1: E2E integration test
- Scripted test: init → lint → health → status → graph
- Run in a temp directory with a sample TypeScript project
- Verify each skill produces expected artifacts
- This tests the REAL skill execution path, not mocked units

### C2: Error message review
- Run each skill with invalid inputs
- Verify error messages are clear, actionable, not stack traces
- Fix any raw Error objects leaking to user

### C4: Code coverage
- `npx vitest run --coverage`
- Measure line/branch/function coverage per package
- Set threshold: 70% minimum per package

### C6: Performance profiling
- Measure CLI boot time (`time node packages/cli/dist/cli.js --help`)
- Target: <500ms boot
- Measure skill loading time
- Identify and fix any slow imports

## Wave 4: Package + Publish Preparation

### A1-A5: Package preparation
- Root package.json: name=sunco, version=0.1.0
- packages/cli/package.json: bin field → sunco binary
- LICENSE: MIT
- README.md: installation, quick start, skill catalog, architecture
- .npmignore: exclude src/, tests, .planning/, tsconfig files

### A6: CI/CD
- GitHub Actions workflow: test → build → publish
- Trigger: push to main (test+build), npm publish on tag v*

### A7: CHANGELOG.md
- v0.1.0 changelog from git history

### A8: npm account
- Verify `sunco` package name available on npm
- If taken, fallback: `@sunco/cli` or `sunco-cli`

### D1: Korean introduction page
- README.md bilingual (English + Korean)
- Or separate README.ko.md

### D2: GitHub public
- Review all files for secrets/credentials
- Set repo to public
- Add topics: ai, coding-agent, harness-engineering, typescript, cli

### D5: Demo GIF
- asciinema recording: sunco init → sunco lint → sunco health → sunco status
- Embed in README
