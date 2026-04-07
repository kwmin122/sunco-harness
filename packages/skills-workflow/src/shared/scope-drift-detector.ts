/**
 * Scope drift detector — compare diff against stated intent.
 *
 * Extracts intent from commit messages, PR description, and plan files,
 * then compares with actual changes to detect scope creep or missing work.
 *
 * Phase 24b — Smart Review (absorbed from gstack review)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DriftVerdict = 'CLEAN' | 'DRIFT_DETECTED' | 'REQUIREMENTS_MISSING';

export interface DriftResult {
  verdict: DriftVerdict;
  /** Files changed that are outside stated intent */
  outOfScopeFiles: string[];
  /** Requirements mentioned but not in diff */
  missingRequirements: string[];
  /** Summary for display */
  summary: string;
}

// ---------------------------------------------------------------------------
// Intent extraction
// ---------------------------------------------------------------------------

/**
 * Extract stated intent from commit messages and plan content.
 * Returns a list of keywords/phrases that represent the intended scope.
 */
export function extractIntent(sources: {
  commitMessages?: string[];
  planContent?: string;
  prDescription?: string;
}): string[] {
  const intents: Set<string> = new Set();

  // Extract from commit messages
  if (sources.commitMessages) {
    for (const msg of sources.commitMessages) {
      // Extract scope from conventional commit: feat(scope): description
      const scopeMatch = msg.match(/^\w+\(([^)]+)\):/);
      if (scopeMatch) intents.add(scopeMatch[1].toLowerCase());

      // Extract key nouns (simplified)
      const words = msg
        .replace(/^\w+(\([^)]+\))?:\s*/, '') // Remove conventional prefix
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
      for (const w of words) intents.add(w);
    }
  }

  // Extract from plan content (requirement IDs, file paths)
  if (sources.planContent) {
    const reqIds = sources.planContent.match(/[A-Z]{2,}-\d+/g);
    if (reqIds) for (const id of reqIds) intents.add(id.toLowerCase());

    const filePaths = sources.planContent.match(/(?:src|packages|lib)\/[\w/.-]+/g);
    if (filePaths) for (const fp of filePaths) intents.add(fp);
  }

  // Extract from PR description
  if (sources.prDescription) {
    const words = sources.prDescription
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
    for (const w of words) intents.add(w);
  }

  return [...intents];
}

// ---------------------------------------------------------------------------
// Drift detection
// ---------------------------------------------------------------------------

/**
 * Detect scope drift by comparing changed files against stated intent.
 */
export function detectDrift(
  changedFiles: string[],
  intentKeywords: string[],
  requirements?: string[],
): DriftResult {
  if (intentKeywords.length === 0) {
    return {
      verdict: 'CLEAN',
      outOfScopeFiles: [],
      missingRequirements: [],
      summary: 'No intent data available for drift detection.',
    };
  }

  // Check which changed files are related to intent
  const outOfScope: string[] = [];
  for (const file of changedFiles) {
    const fileLower = file.toLowerCase();
    const isRelated = intentKeywords.some(
      (kw) => fileLower.includes(kw) || kw.includes(fileLower.split('/').pop()?.replace(/\.\w+$/, '') ?? ''),
    );
    if (!isRelated) {
      outOfScope.push(file);
    }
  }

  // Check for missing requirements
  const missing: string[] = [];
  if (requirements) {
    for (const req of requirements) {
      const reqLower = req.toLowerCase();
      const isAddressed = changedFiles.some((f) => f.toLowerCase().includes(reqLower)) ||
        intentKeywords.some((kw) => kw.includes(reqLower));
      if (!isAddressed) {
        missing.push(req);
      }
    }
  }

  // Determine verdict
  let verdict: DriftVerdict = 'CLEAN';
  const lines: string[] = [];

  if (missing.length > 0) {
    verdict = 'REQUIREMENTS_MISSING';
    lines.push(`${missing.length} requirements not addressed in diff.`);
  } else if (outOfScope.length > changedFiles.length * 0.3) {
    verdict = 'DRIFT_DETECTED';
    lines.push(`${outOfScope.length}/${changedFiles.length} files are outside stated intent.`);
  }

  if (outOfScope.length > 0 && verdict === 'CLEAN') {
    lines.push(`${outOfScope.length} file(s) outside stated scope (minor drift).`);
  }

  if (lines.length === 0) {
    lines.push('All changes aligned with stated intent.');
  }

  return {
    verdict,
    outOfScopeFiles: outOfScope,
    missingRequirements: missing,
    summary: lines.join(' '),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could',
  'should', 'does', 'make', 'into', 'when', 'than', 'also', 'just', 'some',
  'more', 'very', 'only', 'about', 'them', 'then', 'each', 'which', 'their',
  'update', 'change', 'changes', 'updated', 'added', 'fixed', 'removed',
]);
