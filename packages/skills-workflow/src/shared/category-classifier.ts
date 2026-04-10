/**
 * Deterministic category classifier for `/sunco:do` (Phase 27 Plan B, D-12).
 *
 * Verb/noun keyword dictionary (ko + en) maps natural language input to one of
 * 6 categories. NO LLM calls. Low-confidence inputs fall back to `deep` or `next`.
 */

import type { Category } from '@sunco/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassifierSignal {
  kind: 'verb' | 'noun' | 'phrase' | 'phase_state';
  value: string;
}

export interface ClassifierResult {
  category: Category;
  confidence: number;
  matched_signals: ClassifierSignal[];
  fallback_reason?: 'low_confidence' | 'ambiguous_multi_match' | 'no_match';
}

// ---------------------------------------------------------------------------
// Keyword dictionaries (en + ko)
// ---------------------------------------------------------------------------

interface CategoryPatterns {
  verbs: RegExp[];
  nouns: RegExp[];
  phrases: RegExp[];
}

const CATEGORY_PATTERNS: Record<Category, CategoryPatterns> = {
  quick: {
    verbs: [
      /\b(?:fix|rename|typo|tweak|adjust|change|update|remove|delete|add)\b/i,
      /(?:고치|수정|바꿔|변경|제거|삭제|추가|고쳐)/i,
    ],
    nouns: [
      /\b(?:typo|bug|indent|whitespace|comment|import|lint)\b/i,
      /(?:오타|들여쓰기|주석|임포트)/i,
    ],
    phrases: [
      /\b(?:quick fix|small change|one-liner|minor|trivial)\b/i,
      /(?:간단한|사소한|작은)/i,
    ],
  },
  deep: {
    verbs: [
      /\b(?:implement|build|create|develop|construct|execute|run)\b/i,
      /(?:구현|만들|개발|실행|빌드)/i,
    ],
    nouns: [
      /\b(?:phase|feature|system|module|pipeline|architecture)\b/i,
      /(?:페이즈|기능|시스템|모듈|파이프라인|아키텍처)/i,
    ],
    phrases: [
      /\b(?:run plan|execute phase|implement phase|full implementation)\b/i,
      /(?:플랜 실행|페이즈 구현)/i,
    ],
  },
  planning: {
    verbs: [
      /\b(?:plan|design|discuss|think|brainstorm|scope|approach)\b/i,
      /(?:계획|설계|논의|생각|브레인스톰|기획)/i,
    ],
    nouns: [
      /\b(?:plan|design|approach|strategy|roadmap|spec|requirement)\b/i,
      /(?:계획|설계|접근|전략|로드맵|스펙|요구사항)/i,
    ],
    phrases: [
      /\b(?:how should I|what approach|design the|plan for|think through)\b/i,
      /(?:어떻게 할까|접근 방법|설계해|계획 세)/i,
    ],
  },
  review: {
    verbs: [
      /\b(?:review|audit|check|inspect|examine|assess)\b/i,
      /(?:리뷰|검토|확인|점검|감사)/i,
    ],
    nouns: [
      /\b(?:PR|pull.?request|diff|code.?review|MR|merge.?request)\b/i,
      /(?:풀리퀘|코드리뷰|머지리퀘)/i,
    ],
    phrases: [
      /\b(?:review this|check my|look at the|audit the)\b/i,
      /(?:리뷰해|검토해|확인해)/i,
    ],
  },
  debug: {
    verbs: [
      /\b(?:debug|diagnose|investigate|troubleshoot|trace)\b/i,
      /(?:디버그|진단|조사|추적)/i,
    ],
    nouns: [
      /\b(?:bug|error|failure|crash|exception|stack.?trace|test.?fail)\b/i,
      /(?:버그|에러|오류|크래시|실패|스택트레이스)/i,
    ],
    phrases: [
      /\b(?:why (?:is|does|did)|tests? fail|not working|broken|what went wrong)\b/i,
      /(?:왜 안|왜 실패|작동 안|고장|뭐가 잘못)/i,
    ],
  },
  visual: {
    verbs: [
      /\b(?:style|layout|design|animate|theme)\b/i,
      /(?:스타일|레이아웃|디자인|애니메이트|테마)/i,
    ],
    nouns: [
      /\b(?:UI|UX|button|hover|CSS|SCSS|color|font|icon|component|responsive)\b/i,
      /(?:버튼|호버|컬러|폰트|아이콘|컴포넌트|반응형)/i,
    ],
    phrases: [
      /\b(?:fix the (?:button|layout|hover|style)|improve (?:UI|UX|design))\b/i,
      /(?:버튼 (?:고쳐|수정)|레이아웃 (?:개선|수정)|디자인 (?:개선|수정))/i,
    ],
  },
};

/** Category -> primary skill mapping */
const CATEGORY_SKILL_MAP: Record<Category, string> = {
  quick: 'workflow.quick',
  deep: 'workflow.execute',
  planning: 'workflow.discuss',
  review: 'workflow.review',
  debug: 'workflow.debug',
  visual: 'workflow.design-review',
};

/** Category -> secondary skill mapping (for fallback display) */
const CATEGORY_SKILL_ALT: Record<Category, string | undefined> = {
  quick: 'workflow.fast',
  deep: 'workflow.auto',
  planning: 'workflow.plan',
  review: undefined,
  debug: 'workflow.diagnose',
  visual: 'workflow.ui-review',
};

export { CATEGORY_SKILL_MAP, CATEGORY_SKILL_ALT };

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

const LOW_CONFIDENCE_THRESHOLD = 0.4;

export function classifyInput(input: string): ClassifierResult {
  const scores = new Map<Category, { score: number; signals: ClassifierSignal[] }>();

  for (const [cat, patterns] of Object.entries(CATEGORY_PATTERNS) as [Category, CategoryPatterns][]) {
    const signals: ClassifierSignal[] = [];
    let score = 0;

    for (const re of patterns.verbs) {
      const match = input.match(re);
      if (match) {
        signals.push({ kind: 'verb', value: match[0] });
        score += 0.35;
      }
    }
    for (const re of patterns.nouns) {
      const match = input.match(re);
      if (match) {
        signals.push({ kind: 'noun', value: match[0] });
        score += 0.25;
      }
    }
    for (const re of patterns.phrases) {
      const match = input.match(re);
      if (match) {
        signals.push({ kind: 'phrase', value: match[0] });
        score += 0.4;
      }
    }

    if (signals.length > 0) {
      scores.set(cat, { score: Math.min(score, 1.0), signals });
    }
  }

  if (scores.size === 0) {
    return {
      category: 'deep',
      confidence: 0,
      matched_signals: [],
      fallback_reason: 'no_match',
    };
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  const [topCat, topData] = sorted[0]!;

  if (sorted.length > 1 && sorted[1]![1].score >= topData.score * 0.85) {
    if (topData.score < LOW_CONFIDENCE_THRESHOLD) {
      return {
        category: 'deep',
        confidence: topData.score,
        matched_signals: topData.signals,
        fallback_reason: 'ambiguous_multi_match',
      };
    }
  }

  if (topData.score < LOW_CONFIDENCE_THRESHOLD) {
    return {
      category: 'deep',
      confidence: topData.score,
      matched_signals: topData.signals,
      fallback_reason: 'low_confidence',
    };
  }

  return {
    category: topCat,
    confidence: topData.score,
    matched_signals: topData.signals,
  };
}
