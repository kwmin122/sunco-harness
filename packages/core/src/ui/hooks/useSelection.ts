/**
 * @sunco/core - useSelection Hook
 *
 * Custom hook for keyboard-driven selection in lists.
 * Handles up/down arrow navigation and enter for confirmation.
 * Layer 3 support hook for interaction patterns.
 */

import { useState, useCallback, useMemo } from 'react';
import { useInput } from 'ink';

export interface UseSelectionOptions<T> {
  /** Items to select from */
  items: readonly T[];
  /** Default selected index (default 0) */
  defaultIndex?: number;
  /** Whether the selection is active (accepting input) */
  isActive?: boolean;
  /** Callback when selection is confirmed (enter key) */
  onConfirm?: (item: T, index: number) => void;
}

export interface UseSelectionResult<T> {
  /** Currently highlighted index */
  selectedIndex: number;
  /** Currently highlighted item */
  selectedItem: T | undefined;
}

/**
 * useSelection: keyboard-driven list selection.
 *
 * - Up/Down arrows to navigate
 * - Enter to confirm (calls onConfirm)
 * - Wraps around at boundaries
 */
export function useSelection<T>(
  options: UseSelectionOptions<T>,
): UseSelectionResult<T> {
  const {
    items,
    defaultIndex = 0,
    isActive = true,
    onConfirm,
  } = options;

  const [selectedIndex, setSelectedIndex] = useState(
    Math.min(defaultIndex, Math.max(0, items.length - 1)),
  );

  const handleConfirm = useCallback(() => {
    if (onConfirm && items[selectedIndex]) {
      onConfirm(items[selectedIndex], selectedIndex);
    }
  }, [onConfirm, items, selectedIndex]);

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setSelectedIndex((prev) =>
          prev <= 0 ? items.length - 1 : prev - 1,
        );
      } else if (key.downArrow) {
        setSelectedIndex((prev) =>
          prev >= items.length - 1 ? 0 : prev + 1,
        );
      } else if (key.return) {
        handleConfirm();
      }
    },
    { isActive },
  );

  const selectedItem = useMemo(() => items[selectedIndex], [items, selectedIndex]);

  return { selectedIndex, selectedItem };
}
