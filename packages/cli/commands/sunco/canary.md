---
name: sunco:canary
description: Post-deploy monitoring. Periodic health checks, error detection, performance tracking, rollback trigger. Uses curl for HTTP checks.
argument-hint: "<url> [--duration <time>] [--baseline] [--quick]"
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---

<context>
**Arguments:**
- `<url>` — Required. Production URL to monitor.

**Flags:**
- `--duration <time>` — Monitoring duration. Default: 10m. Range: 1m to 30m.
- `--baseline` — Capture baseline measurements (run BEFORE deploying).
- `--quick` — Single-pass health check (no continuous monitoring).
- `--pages /,/api/health,/dashboard` — Specific paths to check.

**Examples:**
- `/sunco:canary https://myapp.com` — 10-minute monitoring
- `/sunco:canary https://myapp.com --duration 5m` — 5-minute monitoring
- `/sunco:canary https://myapp.com --baseline` — Capture baseline
- `/sunco:canary https://myapp.com --quick` — One-time health check
</context>

<objective>
Monitor production after deploy. Perform periodic health checks, detect errors and performance regressions, and alert on issues with rollback option.

**After this command:** Review the canary report. If issues found, investigate or rollback.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/canary.md end-to-end.
</process>

<success_criteria>
- URL accessible and responding
- Health checks performed at regular intervals
- HTTP status codes verified (200 expected)
- Response time tracked and compared to baseline
- Alerts fired on degradation (persistent, not transient)
- Rollback offered on critical issues
- Report saved to `.sun/canary-reports/`
- Baseline captured if --baseline mode
</success_criteria>
