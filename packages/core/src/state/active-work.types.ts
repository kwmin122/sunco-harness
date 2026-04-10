/**
 * Active-work dashboard artifact types and Zod schema (Phase 27 Plan A).
 *
 * `.sun/active-work.json` is a read-only dashboard source consumed by status/next.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Version + categories
// ---------------------------------------------------------------------------

/** Schema version for future migrations */
export const ACTIVE_WORK_VERSION = '1' as const;

/** Internal routing primitive categories (D-11); not user-facing taxonomy */
export const CATEGORIES = [
  'quick',
  'deep',
  'planning',
  'review',
  'debug',
  'visual',
] as const;

export type Category = (typeof CATEGORIES)[number];

const CategorySchema = z.enum(CATEGORIES);

const iso8601 = z.string().datetime({ offset: true });

// ---------------------------------------------------------------------------
// Record shapes
// ---------------------------------------------------------------------------

export type ActivePhase = {
  id: string;
  slug: string;
  state: string;
  current_step: string;
  category: Category;
  plan_id?: string;
};

export type BackgroundWorkItem = {
  kind: string;
  agent_id: string;
  started_at: string;
  description: string;
  state: string;
  completed_at?: string;
};

export type BlockedOn = {
  reason: string;
  since: string;
};

export type NextRecommendedAction = {
  command: string;
  reason: string;
  category: Category;
};

export type RecentSkillCall = {
  skill: string;
  at: string;
  duration_ms: number;
};

export type RoutingMiss = {
  at: string;
  input: string;
  classified_as: Category | null;
  fallback_reason: string;
  user_correction: string | null;
};

export type ActiveWork = {
  updated_at: string;
  active_phase: ActivePhase | null;
  background_work: BackgroundWorkItem[];
  blocked_on: BlockedOn | null;
  next_recommended_action: NextRecommendedAction | null;
  recent_skill_calls: RecentSkillCall[];
  routing_misses: RoutingMiss[];
};

/** Patch merges into current document; `updated_at` is always set by the writer */
export type ActiveWorkPatch = Partial<Omit<ActiveWork, 'updated_at'>>;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ActivePhaseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  state: z.string(),
  current_step: z.string(),
  category: CategorySchema,
  plan_id: z.string().optional(),
});

const BackgroundWorkItemSchema = z.object({
  kind: z.string(),
  agent_id: z.string(),
  started_at: iso8601,
  description: z.string(),
  state: z.string(),
  completed_at: iso8601.optional(),
});

const BlockedOnSchema = z.object({
  reason: z.string(),
  since: iso8601,
});

const NextRecommendedActionSchema = z.object({
  command: z.string(),
  reason: z.string(),
  category: CategorySchema,
});

const RecentSkillCallSchema = z.object({
  skill: z.string(),
  at: iso8601,
  duration_ms: z.number().nonnegative(),
});

const RoutingMissSchema = z.object({
  at: iso8601,
  input: z.string(),
  classified_as: z.union([CategorySchema, z.null()]),
  fallback_reason: z.string(),
  user_correction: z.union([z.string(), z.null()]),
});

export const ActiveWorkSchema = z.object({
  updated_at: iso8601,
  active_phase: z.union([ActivePhaseSchema, z.null()]),
  background_work: z.array(BackgroundWorkItemSchema).max(100),
  blocked_on: z.union([BlockedOnSchema, z.null()]),
  next_recommended_action: z.union([NextRecommendedActionSchema, z.null()]),
  recent_skill_calls: z.array(RecentSkillCallSchema).max(50),
  routing_misses: z.array(RoutingMissSchema).max(100).default([]),
});
