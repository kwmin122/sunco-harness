/**
 * Error sanitizer — redact PII and internal info before web search or logging.
 *
 * Default patterns: absolute paths, IP addresses, emails, API keys, JWT tokens.
 * Custom patterns can be added via config or function parameter.
 *
 * Phase 23a — Iron Law Engine
 */

import type { SanitizeResult } from './debug-types.js';

// ---------------------------------------------------------------------------
// Default redaction patterns
// ---------------------------------------------------------------------------

interface RedactionRule {
  type: string;
  pattern: RegExp;
  replacement: string;
}

const DEFAULT_RULES: RedactionRule[] = [
  {
    type: 'path',
    pattern: /(?:\/Users\/|\/home\/|C:\\Users\\)[^\s:'")\]]+/g,
    replacement: '[PATH]',
  },
  {
    type: 'ipv4',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '[IP]',
  },
  {
    type: 'ipv6',
    pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    replacement: '[IP]',
  },
  {
    type: 'email',
    pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    replacement: '[EMAIL]',
  },
  {
    type: 'aws_key',
    pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: '[API_KEY]',
  },
  {
    type: 'github_token',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/g,
    replacement: '[API_KEY]',
  },
  {
    type: 'generic_key',
    pattern: /\b(?:sk|pk|api|key|token|secret|password)[-_]?[a-zA-Z0-9]{20,}\b/gi,
    replacement: '[API_KEY]',
  },
  {
    type: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    replacement: '[TOKEN]',
  },
];

// ---------------------------------------------------------------------------
// Sanitize
// ---------------------------------------------------------------------------

/**
 * Sanitize text by redacting PII and internal information.
 *
 * @param text - Raw text to sanitize
 * @param extraPatterns - Additional regex patterns to redact (replaced with `[REDACTED]`)
 * @returns Sanitized text with redaction counts
 */
export function sanitizeForSearch(
  text: string,
  extraPatterns: RegExp[] = [],
): SanitizeResult {
  const redactionCounts = new Map<string, number>();
  let result = text;

  // Apply default rules
  for (const rule of DEFAULT_RULES) {
    const matches = result.match(rule.pattern);
    if (matches && matches.length > 0) {
      redactionCounts.set(
        rule.type,
        (redactionCounts.get(rule.type) ?? 0) + matches.length,
      );
      result = result.replace(rule.pattern, rule.replacement);
    }
  }

  // Apply extra patterns
  for (const pattern of extraPatterns) {
    // Clone the regex to ensure global flag and reset lastIndex
    const flags = pattern.flags.includes('g')
      ? pattern.flags
      : pattern.flags + 'g';
    const re = new RegExp(pattern.source, flags);
    const matches = result.match(re);
    if (matches && matches.length > 0) {
      redactionCounts.set(
        'custom',
        (redactionCounts.get('custom') ?? 0) + matches.length,
      );
      result = result.replace(re, '[REDACTED]');
    }
  }

  const redactions = [...redactionCounts.entries()].map(([type, count]) => ({
    type,
    count,
  }));
  const totalRedacted = redactions.reduce((sum, r) => sum + r.count, 0);

  return { text: result, redactions, totalRedacted };
}

/**
 * Expose default rules for inspection/testing.
 */
export const defaultRedactionRules = DEFAULT_RULES.map((r) => ({
  type: r.type,
  pattern: r.pattern,
}));
