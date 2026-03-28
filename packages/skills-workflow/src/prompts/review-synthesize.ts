/**
 * Review synthesis prompt builder for sunco review (Phase 6).
 *
 * Combines independent per-provider review results into a unified REVIEWS.md.
 * The synthesis agent merges findings, highlights common issues found by
 * multiple providers, flags disagreements, and sorts by severity-weighted priority.
 *
 * Requirements: WF-13
 * Decisions: D-11 (synthesis into unified REVIEWS.md with common findings + disagreements)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewResult {
  /** Provider ID that produced this review */
  providerId: string;
  /** Raw findings output from the review agent */
  findings: string;
}

export interface BuildReviewSynthesizePromptParams {
  /** Per-provider review results */
  reviews: ReviewResult[];
  /** Original diff (included for cross-reference) */
  diff: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum diff length for synthesis context */
const MAX_SYNTH_DIFF_CHARS = 20_000;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build a synthesis prompt that merges multiple independent reviews into REVIEWS.md.
 * The output follows a structured format with common findings, disagreements,
 * and severity-weighted priorities.
 *
 * @param opts - Synthesis parameters including per-provider review results
 * @returns Formatted prompt string for the synthesis agent
 */
export function buildReviewSynthesizePrompt(opts: BuildReviewSynthesizePromptParams): string {
  const { reviews, diff } = opts;

  const reviewSections = reviews
    .map(
      (r, i) => `### Provider ${i + 1}: ${r.providerId}

${r.findings}

---`,
    )
    .join('\n\n');

  // Truncate diff for synthesis context (smaller limit -- synthesis focuses on findings)
  let effectiveDiff = diff;
  if (diff.length > MAX_SYNTH_DIFF_CHARS) {
    effectiveDiff = diff.slice(0, MAX_SYNTH_DIFF_CHARS) + '\n\n[... diff truncated for synthesis context ...]';
  }

  return `You are a code review synthesis agent. Your task is to merge multiple independent code reviews from different AI providers into a single, unified REVIEWS.md report.

## Independent Reviews

${reviewSections}

## Original Diff (for reference)

\`\`\`diff
${effectiveDiff}
\`\`\`

## Synthesis Instructions

1. **Common Findings**: Identify issues found by 2 or more providers. These are high-confidence findings.
2. **Disagreements**: Flag cases where providers assigned different severity levels to the same issue, or where one provider found an issue another missed.
3. **Severity-Weighted Priority**: Sort all findings by severity (critical > high > medium > low). Within the same severity, common findings rank higher.
4. **Deduplicate**: Merge duplicate findings into one entry, noting which providers found it.
5. **Preserve Specifics**: Keep file paths, line numbers, and concrete suggestions from the original reviews.

## Output Format

Produce a markdown document with this EXACT structure (this will be written as REVIEWS.md):

# Code Review Report

## Summary

Brief 2-3 sentence summary: how many providers reviewed, total findings count, critical/high findings count, overall assessment.

## Common Findings

Issues found by 2+ providers (highest confidence):

| # | Severity | Issue | File | Providers | Suggestion |
|---|----------|-------|------|-----------|------------|
| 1 | critical/high/medium/low | Description | file:line | provider1, provider2 | Fix suggestion |

If no common findings: "No common findings across providers."

## Disagreements

Cases where providers disagree on severity or existence of an issue:

| Issue | Provider A | Provider B | Resolution |
|-------|-----------|-----------|------------|
| Description | severity (providerA) | severity (providerB) | Recommended severity with reasoning |

If no disagreements: "No disagreements between providers."

## All Findings

Complete list sorted by severity-weighted priority:

### Critical

| # | Issue | File | Provider(s) | Suggestion |
|---|-------|------|-------------|------------|

### High

(same table format)

### Medium

(same table format)

### Low

(same table format)

## Metadata

- **Providers:** ${reviews.map((r) => r.providerId).join(', ')}
- **Review date:** ${new Date().toISOString().split('T')[0]}
- **Total findings:** [count]
- **Common findings:** [count]
- **Disagreements:** [count]

---

IMPORTANT: Output ONLY the markdown content above. Start directly with "# Code Review Report". Do not add any text before or after.`;
}
