/**
 * @sunco/core - InteractiveChoice Pattern (Layer 3)
 *
 * Multi-option selection with keyboard navigation and Recommended badge.
 * Maps to the "choice" phase of the skill state machine:
 * idle -> entry -> [choice?] -> running -> result
 *
 * Uses ink-select-input for the selection list.
 * Returns UiChoiceResult when user confirms a selection.
 *
 * Decisions: D-32 (state machine), D-34 (intent-based API), D-36 (UiChoiceResult)
 * Requirements: UX-01 (recommended badge on interactive options)
 */

import React, { useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { theme } from '../theme/tokens.js';
import { Badge } from '../primitives/Badge.js';
import type { AskInput, AskOption, UiChoiceResult } from '../adapters/SkillUi.js';

/** SelectInput item shape (mirrors ink-select-input's Item<V>) */
interface SelectItem {
  key?: string;
  label: string;
  value: string;
}

export interface InteractiveChoiceProps extends AskInput {
  /** Callback when user selects an option */
  onSelect?: (result: UiChoiceResult) => void;
}

/**
 * Build SelectInput items from AskOptions.
 * ink-select-input uses { label, value } items.
 */
function buildSelectItems(options: AskOption[]): SelectItem[] {
  return options.map((opt) => ({
    label: opt.label,
    value: opt.id,
  }));
}

/**
 * InteractiveChoice: Multi-option selection with Recommended badge (UX-01).
 * Renders a message prompt and a selectable list of options.
 */
export const InteractiveChoice: React.FC<InteractiveChoiceProps> = ({
  message,
  options,
  defaultId,
  onSelect,
}) => {
  const items = buildSelectItems(options);
  const initialIndex = defaultId
    ? Math.max(0, options.findIndex((o) => o.id === defaultId))
    : 0;

  const handleSelect = useCallback(
    (item: SelectItem) => {
      const opt = options.find((o) => o.id === item.value);
      if (opt && onSelect) {
        onSelect({
          selectedId: opt.id,
          selectedLabel: opt.label,
          source: 'keyboard',
        });
      }
    },
    [options, onSelect],
  );

  // Build label -> option lookup for the custom itemComponent
  // (ink-select-input ItemProps only provides isSelected + label, not value)
  const labelToOption = useMemo(
    () => new Map(options.map((o) => [o.label, o])),
    [options],
  );

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={theme.colors.text} bold>{message}</Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          initialIndex={initialIndex}
          onSelect={handleSelect}
          itemComponent={({ isSelected, label }) => {
            const opt = labelToOption.get(label);
            return (
              <Box gap={1}>
                <Text
                  color={isSelected ? theme.colors.primary : theme.colors.text}
                  bold={isSelected}
                >
                  {label}
                </Text>
                {opt?.description && (
                  <Text color={theme.colors.dim}>
                    {opt.description}
                  </Text>
                )}
                {opt?.isRecommended && (
                  <Badge label="Recommended" color={theme.colors.success} />
                )}
              </Box>
            );
          }}
        />
      </Box>
    </Box>
  );
};
