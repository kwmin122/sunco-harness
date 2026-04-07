/**
 * Skill router — parse CLAUDE.md routing rules and match user intent to skills.
 *
 * Supports multi-platform: Claude Code, Codex, Cursor.
 * Routes natural language input to the most appropriate SUNCO skill.
 *
 * Phase 24c — Routing + Proactive
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoutingRule {
  /** Trigger patterns (keywords, phrases) */
  triggers: string[];
  /** Target skill ID */
  skillId: string;
  /** Human-readable description */
  description: string;
}

export interface RouteMatch {
  skillId: string;
  confidence: number; // 0-1
  matchedTrigger: string;
  rule: RoutingRule;
}

// ---------------------------------------------------------------------------
// Default routing rules (built-in, no CLAUDE.md needed)
// ---------------------------------------------------------------------------

export const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  {
    triggers: ['bug', 'error', 'broken', 'crash', 'fail', '왜 안 돼', '에러', '버그', 'debug', '디버그'],
    skillId: 'workflow.debug',
    description: 'Debug and investigate errors',
  },
  {
    triggers: ['ship', 'deploy', 'push', 'pr', 'pull request', 'merge', '배포', '머지', '푸시'],
    skillId: 'workflow.ship',
    description: 'Ship changes via PR',
  },
  {
    triggers: ['test', 'qa', 'quality', '테스트', '품질', 'verify', '검증'],
    skillId: 'workflow.verify',
    description: 'Run verification pipeline',
  },
  {
    triggers: ['review', 'code review', '리뷰', '코드 리뷰', 'check my diff'],
    skillId: 'workflow.review',
    description: 'Multi-provider code review',
  },
  {
    triggers: ['plan', 'design', '설계', '계획', 'how should', 'approach'],
    skillId: 'workflow.plan',
    description: 'Create execution plan',
  },
  {
    triggers: ['status', 'progress', '상태', '진행', 'where am i', '어디까지'],
    skillId: 'core.status',
    description: 'Check project status',
  },
  {
    triggers: ['init', 'setup', 'start', '초기화', '시작', 'new project'],
    skillId: 'harness.init',
    description: 'Initialize project harness',
  },
  {
    triggers: ['lint', 'architecture', '아키텍처', 'violations'],
    skillId: 'harness.lint',
    description: 'Check architecture compliance',
  },
  {
    triggers: ['health', 'score', '건강', '점수'],
    skillId: 'harness.health',
    description: 'Check project health',
  },
  {
    triggers: ['release', 'version', 'changelog', '릴리스', '버전'],
    skillId: 'workflow.release',
    description: 'Create release with version bump',
  },
];

// ---------------------------------------------------------------------------
// CLAUDE.md Routing Parser
// ---------------------------------------------------------------------------

/**
 * Parse routing rules from a CLAUDE.md file's `## Skill routing` section.
 *
 * Expected format:
 * ```
 * ## Skill routing
 * - triggers → skill_id
 * - "bugs, errors, broken" → workflow.debug
 * ```
 */
export function parseRoutingSection(content: string): RoutingRule[] {
  const match = content.match(/## Skill routing\s*\n([\s\S]*?)(?=\n##\s|\n$|$)/);
  if (!match) return [];

  const rules: RoutingRule[] = [];
  const lines = match[1].split('\n');

  for (const line of lines) {
    // Pattern: - triggers → skill_id  or  - triggers -> skill_id
    const ruleMatch = line.match(/^[-*]\s*(.+?)\s*(?:→|->)+\s*(\S+)/);
    if (!ruleMatch) continue;

    const triggersStr = ruleMatch[1].replace(/["']/g, '').trim();
    const skillId = ruleMatch[2].trim();
    const triggers = triggersStr.split(/[,;]/).map((t) => t.trim().toLowerCase()).filter(Boolean);

    if (triggers.length > 0 && skillId) {
      rules.push({ triggers, skillId, description: triggersStr });
    }
  }

  return rules;
}

/**
 * Load routing rules: built-in defaults + CLAUDE.md overrides.
 */
export async function loadRoutingRules(cwd: string): Promise<RoutingRule[]> {
  const rules = [...DEFAULT_ROUTING_RULES];

  try {
    const claudeMd = await readFile(join(cwd, 'CLAUDE.md'), 'utf-8');
    const custom = parseRoutingSection(claudeMd);
    // Custom rules take priority (prepend)
    rules.unshift(...custom);
  } catch {
    // No CLAUDE.md or no routing section
  }

  return rules;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Match user input to the best routing rule.
 *
 * Returns the highest-confidence match, or null if no match.
 */
export function matchRoute(
  input: string,
  rules: RoutingRule[],
): RouteMatch | null {
  const normalized = input.toLowerCase();
  let bestMatch: RouteMatch | null = null;

  for (const rule of rules) {
    for (const trigger of rule.triggers) {
      if (normalized.includes(trigger)) {
        const confidence = trigger.length / normalized.length;
        const boosted = Math.min(1, confidence + 0.3); // Base boost for any match

        if (!bestMatch || boosted > bestMatch.confidence) {
          bestMatch = {
            skillId: rule.skillId,
            confidence: boosted,
            matchedTrigger: trigger,
            rule,
          };
        }
      }
    }
  }

  return bestMatch;
}

// ---------------------------------------------------------------------------
// Routing section generator (for init)
// ---------------------------------------------------------------------------

/**
 * Generate a CLAUDE.md routing section for a project.
 */
export function generateRoutingSection(): string {
  return `## Skill routing

When the user's request matches an available skill, invoke it as the FIRST action.

Key routing rules:
- bugs, errors, broken, debug → workflow.debug
- ship, deploy, push, PR → workflow.ship
- test, QA, verify → workflow.verify
- review, code review → workflow.review
- plan, design, approach → workflow.plan
- status, progress → core.status
- lint, architecture → harness.lint
- health, score → harness.health
- release, version → workflow.release
`;
}
