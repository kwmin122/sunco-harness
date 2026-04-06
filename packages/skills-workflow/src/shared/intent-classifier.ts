/**
 * Intent Classifier — deterministic user input classification.
 *
 * Classifies user input into 5 intent types using keyword matching.
 * Zero LLM cost. Supports both English and Korean keywords.
 *
 * Used by:
 *   - sunco-mode-router.cjs (hook)
 *   - model-selector.ts (routing decisions)
 *
 * Requirements: LH-06
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntentType = 'lookup' | 'implement' | 'investigate' | 'plan' | 'review';

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  keywords: string[];
}

// ---------------------------------------------------------------------------
// Keyword Patterns
// ---------------------------------------------------------------------------

/** Individual keywords per intent. English words use exact word boundaries. Korean uses includes. */
const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  lookup: ['find', 'where', 'show', 'list', 'what is', 'get', 'search', 'display', '어디', '찾아', '보여', '뭐', '어떤', '검색', '목록'],
  implement: ['add', 'create', 'write', 'build', 'fix', 'make', 'implement', 'refactor', 'update', 'change', 'modify', 'remove', 'delete', '만들', '추가', '수정', '작성', '구현', '변경', '삭제', '고쳐', '리팩토링'],
  investigate: ['debug', 'why', 'error', 'fail', 'failing', 'failed', 'broken', 'crash', 'crashed', 'issue', 'bug', 'trace', 'diagnose', 'wrong', '왜', '에러', '버그', '실패', '깨진', '문제', '원인', '디버그'],
  plan: ['plan', 'planning', 'design', 'architect', 'architecture', 'roadmap', 'strategy', 'propose', 'spec', 'requirement', '계획', '설계', '아키텍처', '로드맵', '전략', '제안', '요구사항'],
  review: ['review', 'check', 'verify', 'audit', 'validate', 'inspect', 'assess', 'evaluate', 'test', '검토', '확인', '검증', '감사', '평가', '테스트', '리뷰'],
};

/** Priority order for tie-breaking (action intents > analysis intents) */
const INTENT_PRIORITY: IntentType[] = ['plan', 'review', 'implement', 'investigate', 'lookup'];

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

/**
 * Classify user input into one of 5 intent types.
 *
 * @param input - Raw user input text
 * @returns Intent classification with confidence score and matched keywords
 */
export function classifyIntent(input: string): IntentResult {
  const scores: Record<IntentType, string[]> = {
    lookup: [],
    implement: [],
    investigate: [],
    plan: [],
    review: [],
  };

  const lower = input.toLowerCase();

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [IntentType, string[]][]) {
    for (const keyword of keywords) {
      const isKorean = /[가-힣]/.test(keyword);
      if (isKorean) {
        if (lower.includes(keyword)) {
          scores[intent].push(keyword);
        }
      } else {
        // Exact word boundary matching for English
        const re = new RegExp(`\\b${keyword}\\b`, 'i');
        if (re.test(lower)) {
          scores[intent].push(keyword);
        }
      }
    }
  }

  // Find intent with most keyword matches (ties broken by priority)
  let bestIntent: IntentType = 'implement'; // default
  let bestScore = 0;

  for (const intent of INTENT_PRIORITY) {
    const keywords = scores[intent];
    if (keywords.length > bestScore) {
      bestScore = keywords.length;
      bestIntent = intent;
    }
  }

  // Confidence: 0 = no match (default), 0.5 = 1 match, 0.8 = 2 matches, 1.0 = 3+ matches
  const confidence = bestScore === 0 ? 0.3 : bestScore === 1 ? 0.6 : bestScore === 2 ? 0.8 : 1.0;

  return {
    intent: bestIntent,
    confidence,
    keywords: scores[bestIntent],
  };
}
