/**
 * @sunco/core - RecommendationCard Component
 *
 * Displays next-step recommendations after skill execution.
 * Layer 2: Reusable shared component (D-31).
 *
 * Requirements: REC-02 (next best action), UX-01 (Recommended badge)
 */

import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/tokens.js';
import { Badge } from '../primitives/Badge.js';
import type { Recommendation } from '../../recommend/types.js';

export interface RecommendationCardProps {
  /** List of recommendations to display */
  recommendations: Recommendation[];
}

/**
 * RecommendationCard: Renders a list of recommended next actions.
 * Shows numbered recommendations with skill IDs, reasons, and a "(Recommended)" badge
 * for the primary recommendation (isDefault).
 */
export const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendations }) => (
  <Box flexDirection="column" marginTop={1}>
    <Text color={theme.colors.dim}>Next steps:</Text>
    {recommendations.map((rec, i) => (
      <Box key={rec.skillId} gap={1}>
        <Text color={theme.colors.dim}>{i + 1}.</Text>
        <Text color={theme.colors.primary}>sunco {rec.skillId}</Text>
        <Text color={theme.colors.dim}>{theme.symbols.arrow} {rec.reason}</Text>
        {rec.isDefault && <Badge label="Recommended" color={theme.colors.success} />}
      </Box>
    ))}
  </Box>
);
