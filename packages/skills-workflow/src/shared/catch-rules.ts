/**
 * Declarative catch rules — markdown-based pre-commit validation.
 *
 * Rules are defined in `.sun/catch-rules.md` using a structured format:
 *
 * ```markdown
 * ## No console.log
 * - pattern: `console\.log`
 * - severity: error
 * - message: Use structured logging instead of console.log
 * ```
 *
 * The parser extracts rule blocks from H2 headings, then `applyCatchRules`
 * runs each rule's regex against file content and collects matches.
 *
 * Requirements: LH-15
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CatchRule {
  name: string;
  pattern: RegExp;
  message: string;
  severity: 'error' | 'warning';
}

export interface CatchRuleMatch {
  rule: CatchRule;
  matches: string[];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse catch rules from a markdown document.
 *
 * Expected format per rule:
 *   ## Rule Name
 *   - pattern: `regex`
 *   - severity: error | warning
 *   - message: Human-readable explanation
 *
 * Invalid or incomplete blocks are silently skipped.
 */
export function parseCatchRules(markdown: string): CatchRule[] {
  const rules: CatchRule[] = [];
  const lines = markdown.split('\n');

  let currentName: string | null = null;
  let currentPattern: string | null = null;
  let currentSeverity: 'error' | 'warning' | null = null;
  let currentMessage: string | null = null;

  function flush(): void {
    if (currentName && currentPattern && currentSeverity && currentMessage) {
      try {
        rules.push({
          name: currentName,
          pattern: new RegExp(currentPattern, 'g'),
          message: currentMessage,
          severity: currentSeverity,
        });
      } catch {
        // Invalid regex — skip this rule
      }
    }
    currentName = null;
    currentPattern = null;
    currentSeverity = null;
    currentMessage = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // H2 heading starts a new rule block
    if (trimmed.startsWith('## ')) {
      flush();
      currentName = trimmed.slice(3).trim();
      continue;
    }

    if (!currentName) continue;

    // Extract pattern from backtick-delimited value
    const patternMatch = trimmed.match(/^-\s*pattern:\s*`([^`]+)`/);
    if (patternMatch) {
      currentPattern = patternMatch[1];
      continue;
    }

    // Extract severity
    const severityMatch = trimmed.match(/^-\s*severity:\s*(error|warning)/);
    if (severityMatch) {
      currentSeverity = severityMatch[1] as 'error' | 'warning';
      continue;
    }

    // Extract message
    const messageMatch = trimmed.match(/^-\s*message:\s*(.+)/);
    if (messageMatch) {
      currentMessage = messageMatch[1].trim();
      continue;
    }
  }

  // Flush last block
  flush();

  return rules;
}

// ---------------------------------------------------------------------------
// Applicator
// ---------------------------------------------------------------------------

/**
 * Apply catch rules to content and return all matches.
 *
 * Each rule's pattern is tested against the content. If there are matches,
 * they are collected with the rule reference for reporting.
 */
export function applyCatchRules(
  content: string,
  rules: CatchRule[],
): CatchRuleMatch[] {
  const results: CatchRuleMatch[] = [];

  for (const rule of rules) {
    // Reset lastIndex for global regexes (they are stateful)
    rule.pattern.lastIndex = 0;

    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = rule.pattern.exec(content)) !== null) {
      matches.push(match[0]);
      // Safety: prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        rule.pattern.lastIndex++;
      }
    }

    if (matches.length > 0) {
      results.push({ rule, matches });
    }
  }

  return results;
}
