/**
 * Natural language keyword matcher — proactive skill suggestion.
 *
 * Detects when user input implies a SUNCO skill should be invoked.
 * Works across Claude Code, Codex, Cursor by analyzing text patterns.
 *
 * Phase 24c — Routing + Proactive
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProactiveSuggestion {
  skillId: string;
  command: string;
  reason: string;
  confidence: number; // 0-1
}

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

interface KeywordPattern {
  /** Regex patterns to match */
  patterns: RegExp[];
  /** Skill to suggest */
  skillId: string;
  /** Slash command */
  command: string;
  /** Why this skill is suggested */
  reason: string;
}

const PATTERNS: KeywordPattern[] = [
  {
    patterns: [
      /(?:does|is)\s+(?:this|it|the|this\s+\w+)\s+work/i,
      /(?:feature|기능)\s+(?:is\s+)?(?:ready|완료|done)/i,
      /(?:test|테스트)\s+(?:this|it|the)/i,
      /(?:find|찾아)\s+(?:bugs?|버그)/i,
    ],
    skillId: 'workflow.verify',
    command: '/sunco:verify',
    reason: 'Verify the implementation works correctly',
  },
  {
    patterns: [
      /why\s+(?:is|does|did)\s+(?:this|it)\s+(?:break|broken|fail|crash|error)/i,
      /(?:왜|why)\s+(?:안\s*돼|안\s*되|broken)/i,
      /(?:500|error|exception|crash|bug)\s/i,
      /(?:investigate|조사|분석)\s/i,
    ],
    skillId: 'workflow.debug',
    command: '/sunco:debug',
    reason: 'Investigate and classify the failure',
  },
  {
    patterns: [
      /(?:push|merge|deploy|ship|land)\s+(?:to|this|it|the)/i,
      /(?:create|make)\s+(?:a\s+)?(?:PR|pull\s*request|MR)/i,
      /(?:배포|머지|푸시)\s/i,
      /(?:ready\s+to\s+ship|let'?s\s+ship)/i,
    ],
    skillId: 'workflow.ship',
    command: '/sunco:ship',
    reason: 'Ship the changes via PR',
  },
  {
    patterns: [
      /(?:check|review)\s+(?:my|the|this)\s+(?:code|diff|changes)/i,
      /(?:리뷰|코드\s*리뷰)\s/i,
      /(?:look\s+at|review)\s+(?:this|the)\s+(?:PR|MR)/i,
    ],
    skillId: 'workflow.review',
    command: '/sunco:review',
    reason: 'Multi-provider code review',
  },
  {
    patterns: [
      /(?:how\s+should|어떻게)\s+(?:I|we|i)\s+(?:approach|implement|build)/i,
      /(?:plan|설계|계획)\s+(?:this|the|for)/i,
      /(?:design|architect)\s+(?:this|the|a)/i,
    ],
    skillId: 'workflow.plan',
    command: '/sunco:plan',
    reason: 'Create an execution plan first',
  },
];

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Check if user input implies a skill should be proactively suggested.
 *
 * Returns the highest-confidence suggestion, or null if nothing matches.
 */
export function detectProactiveSuggestion(
  input: string,
): ProactiveSuggestion | null {
  let best: ProactiveSuggestion | null = null;

  for (const pattern of PATTERNS) {
    for (const re of pattern.patterns) {
      if (re.test(input)) {
        const confidence = 0.7; // Base confidence for keyword match

        if (!best || confidence > best.confidence) {
          best = {
            skillId: pattern.skillId,
            command: pattern.command,
            reason: pattern.reason,
            confidence,
          };
        }
        break; // One match per pattern group is enough
      }
    }
  }

  return best;
}

/**
 * Format a proactive suggestion for display.
 */
export function formatProactiveSuggestion(suggestion: ProactiveSuggestion): string {
  return `${suggestion.command} might help here — ${suggestion.reason}`;
}
