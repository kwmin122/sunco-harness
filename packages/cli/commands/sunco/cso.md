---
name: sunco:cso
description: Chief Security Officer mode. OWASP Top 10 audit, STRIDE threat modeling, attack surface mapping, secret detection, dependency CVE scanning, data classification review.
argument-hint: "[--diff] [--scope <domain>] [--owasp] [--supply-chain]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - Agent
  - AskUserQuestion
---

<context>
**Flags:**
- `--diff` — Security review of current branch changes only.
- `--scope <domain>` — Focused audit on a specific domain (e.g., auth, payments, api).
- `--owasp` — OWASP Top 10 focused assessment only.
- `--supply-chain` — Dependency and supply chain risk analysis only.
</context>

<objective>
Run a comprehensive security posture audit. Produce a findings report with severity ratings, exploit scenarios, and remediation plans. Read-only — never modify code.

**After this command:** Review findings and decide remediation priority.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/cso.md end-to-end.
</process>

<success_criteria>
- Attack surface mapped with endpoint counts
- OWASP Top 10 categories assessed
- STRIDE threat model for major components
- Data classification complete (Restricted/Confidential/Internal/Public)
- Findings with ≥8/10 confidence only, each with exploit scenario
- Remediation roadmap for top findings
- Report saved to `.sun/security-reports/`
- No code modifications made
</success_criteria>
