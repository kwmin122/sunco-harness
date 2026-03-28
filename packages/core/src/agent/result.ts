/**
 * @sunco/core - Result Normalizer
 *
 * Ensures consistent AgentResult shape from any provider output.
 * Extracts artifacts from structured output when present.
 *
 * Decision: D-20 (common result format)
 */

import type { AgentResult, Artifact, AgentUsage } from './types.js';

/**
 * Raw result data from a provider before normalization.
 * Allows partial/missing fields that get filled with defaults.
 */
export interface RawProviderResult {
  /** Text output (may be undefined if structured-only output) */
  text?: string;
  /** Whether execution succeeded */
  success?: boolean;
  /** Structured artifacts */
  artifacts?: Array<{
    path?: string;
    kind?: string;
    description?: string;
  }>;
  /** Warnings from the provider */
  warnings?: string[];
  /** Usage data */
  usage?: Partial<AgentUsage>;
  /** Raw provider-specific data for debugging */
  raw?: unknown;
}

/**
 * Normalize raw provider output into a consistent AgentResult.
 *
 * - Fills missing fields with safe defaults
 * - Validates artifact structure
 * - Ensures usage fields are present
 */
export function normalizeResult(
  raw: RawProviderResult,
  providerId: string,
): AgentResult {
  const artifacts: Artifact[] = [];
  if (raw.artifacts) {
    for (const a of raw.artifacts) {
      if (a.path && isValidArtifactKind(a.kind)) {
        artifacts.push({
          path: a.path,
          kind: a.kind,
          description: a.description,
        });
      }
    }
  }

  return {
    providerId,
    success: raw.success ?? true,
    outputText: raw.text ?? '',
    artifacts,
    warnings: raw.warnings ?? [],
    usage: {
      inputTokens: raw.usage?.inputTokens,
      outputTokens: raw.usage?.outputTokens,
      estimatedCostUsd: raw.usage?.estimatedCostUsd,
      estimated: raw.usage?.estimated ?? true,
      wallTimeMs: raw.usage?.wallTimeMs ?? 0,
    },
    raw: raw.raw,
  };
}

/** Valid artifact kinds */
const VALID_KINDS = new Set<string>(['created', 'modified', 'report']);

function isValidArtifactKind(
  kind: string | undefined,
): kind is 'created' | 'modified' | 'report' {
  return kind !== undefined && VALID_KINDS.has(kind);
}
