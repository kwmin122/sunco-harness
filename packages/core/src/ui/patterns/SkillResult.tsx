/**
 * @sunco/core - SkillResult Pattern (Layer 3)
 *
 * Final output after skill execution. Shows summary and recommendation cards.
 * Maps to the "result" phase of the skill state machine:
 * idle -> entry -> choice? -> running -> [result]
 *
 * Decisions: D-32 (state machine)
 * Requirements: UX-02 (recommendation cards), UX-03 (visual status feedback)
 */

import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/tokens.js';
import { StatusSymbol } from '../components/StatusSymbol.js';
import { RecommendationCard } from '../components/RecommendationCard.js';
import type { ResultInput } from '../adapters/SkillUi.js';

export interface SkillResultProps extends ResultInput {
  /** Callback when result display completes */
  onComplete?: () => void;
}

/**
 * SkillResult: Displays skill execution result.
 *
 * - StatusSymbol (success/error) + title
 * - Summary text
 * - Optional detail lines (dimmed)
 * - Optional warning lines (yellow)
 * - Optional recommendation cards (next actions)
 */
export const SkillResult: React.FC<SkillResultProps> = ({
  success,
  title,
  summary,
  details,
  warnings,
  recommendations,
  onComplete: _onComplete,
}) => (
  <Box flexDirection="column" paddingX={1}>
    {/* Header: status icon + title */}
    <Box gap={1}>
      <StatusSymbol status={success ? 'success' : 'error'} />
      <Text color={success ? theme.colors.success : theme.colors.error} bold>
        {title}
      </Text>
    </Box>

    {/* Summary */}
    {summary && (
      <Box paddingLeft={2}>
        <Text color={theme.colors.text}>{summary}</Text>
      </Box>
    )}

    {/* Details */}
    {details && details.length > 0 && (
      <Box flexDirection="column" paddingLeft={2} marginTop={1}>
        {details.map((line, i) => (
          <Text key={`detail-${i}`} color={theme.colors.dim}>
            {theme.symbols.bullet} {line}
          </Text>
        ))}
      </Box>
    )}

    {/* Warnings */}
    {warnings && warnings.length > 0 && (
      <Box flexDirection="column" paddingLeft={2} marginTop={1}>
        {warnings.map((line, i) => (
          <Text key={`warn-${i}`} color={theme.colors.warning}>
            {theme.symbols.warning} {line}
          </Text>
        ))}
      </Box>
    )}

    {/* Recommendations */}
    {recommendations && recommendations.length > 0 && (
      <RecommendationCard recommendations={recommendations} />
    )}
  </Box>
);
