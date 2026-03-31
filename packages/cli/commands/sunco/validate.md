---
name: sunco:validate
description: Run test coverage audit and produce structured report
allowed-tools:
  - Bash
  - Read
---

<objective>
Run the SUNCO validate skill to audit test coverage across the project. Identifies untested modules, coverage gaps by layer, and produces a structured report with coverage percentages and the highest-impact areas to add tests. Deterministic: zero LLM cost.
</objective>

<process>
1. Run: `node $HOME/.claude/sunco/bin/cli.js validate`
2. Display the output clearly:
   - Overall test coverage percentage
   - Per-layer coverage breakdown (e.g., domain: 87%, service: 62%, infra: 45%)
   - List of untested or under-tested files (sorted by blast radius — most-imported first)
   - Any test configuration issues detected (missing test runner config, broken test files)
3. Based on the results:
   - Coverage < 60%: Flag as critical — highlight the top 5 files by blast radius that have no tests
   - Coverage 60–80%: Suggest adding tests for the lowest-coverage layer
   - Coverage > 80%: Confirm good coverage and suggest maintaining it
4. If test infrastructure is not yet configured (no vitest.config, no test files found):
   - Report the gap clearly
   - Suggest running `/sunco:init` which can scaffold a baseline test configuration
5. After validation, suggest: "Use `/sunco:headless validate` in CI to gate on coverage thresholds."
</process>
