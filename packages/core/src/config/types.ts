/**
 * @sunco/core - Config System Types
 *
 * Zod schemas and TypeScript types for SUNCO's TOML-based configuration.
 * Three-layer hierarchy: global (~/.sun/config.toml) -> project (.sun/config.toml) -> directory (.sun.toml)
 *
 * Decisions: D-01 (monorepo structure), CFG-01~03 (TOML config)
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Skill Policy (D-09: whitelist approach, D-10: system presets)
// ---------------------------------------------------------------------------

export const SkillPolicySchema = z.object({
  /** Preset name (e.g., 'harness', 'workflow', 'full'). 'none' = no preset skills. */
  preset: z.string().default('none'),
  /** Skill IDs to add on top of preset */
  add: z.array(z.string()).default([]),
  /** Skill IDs to remove from preset */
  remove: z.array(z.string()).default([]),
});

export type SkillPolicyConfig = z.infer<typeof SkillPolicySchema>;

// ---------------------------------------------------------------------------
// Agent Config (D-15~D-25: agent router settings)
// ---------------------------------------------------------------------------

export const AgentConfigSchema = z.object({
  /** Default provider ID (e.g., 'claude-code-cli', 'claude-sdk') */
  defaultProvider: z.string().default('claude-code-cli'),
  /** Default timeout in milliseconds for agent execution */
  timeout: z.number().default(120_000),
  /** Max retries on transient failure */
  maxRetries: z.number().default(1),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// ---------------------------------------------------------------------------
// UI Config (D-30~D-40: interactive UX settings)
// ---------------------------------------------------------------------------

export const UiConfigSchema = z.object({
  /** Theme name */
  theme: z.string().default('default'),
  /** Suppress all interactive output */
  silent: z.boolean().default(false),
  /** Output JSON instead of interactive UI */
  json: z.boolean().default(false),
});

export type UiConfig = z.infer<typeof UiConfigSchema>;

// ---------------------------------------------------------------------------
// State Config (STE-01~05: state engine settings)
// ---------------------------------------------------------------------------

export const StateConfigSchema = z.object({
  /** Path to SQLite database relative to .sun/ */
  dbPath: z.string().default('.sun/state.db'),
});

export type StateConfig = z.infer<typeof StateConfigSchema>;

// ---------------------------------------------------------------------------
// Root Config (D-01: project-level config)
// ---------------------------------------------------------------------------

export const SunConfigSchema = z.object({
  skills: SkillPolicySchema.default({}),
  agent: AgentConfigSchema.default({}),
  ui: UiConfigSchema.default({}),
  state: StateConfigSchema.default({}),
});

export type SunConfig = z.infer<typeof SunConfigSchema>;
