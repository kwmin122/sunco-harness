/**
 * @sunco/core - useKeymap Hook
 *
 * Custom hook for keyboard shortcuts via Ink's useInput.
 * Layer 3 support hook for interaction patterns.
 */

import { useInput } from 'ink';

/**
 * Attach keyboard shortcut handlers via Ink's useInput.
 *
 * @param keymap - Record of key names to handler functions.
 *   Supported keys: 'return', 'escape', 'upArrow', 'downArrow',
 *   'leftArrow', 'rightArrow', 'tab', 'backspace', 'delete',
 *   or single character keys (e.g., 'q', 'h').
 * @param isActive - Whether the keymap is active (default true).
 */
export function useKeymap(
  keymap: Record<string, () => void>,
  isActive = true,
): void {
  useInput(
    (input, key) => {
      // Check named keys first
      if (key.return && keymap['return']) {
        keymap['return']();
        return;
      }
      if (key.escape && keymap['escape']) {
        keymap['escape']();
        return;
      }
      if (key.upArrow && keymap['upArrow']) {
        keymap['upArrow']();
        return;
      }
      if (key.downArrow && keymap['downArrow']) {
        keymap['downArrow']();
        return;
      }
      if (key.leftArrow && keymap['leftArrow']) {
        keymap['leftArrow']();
        return;
      }
      if (key.rightArrow && keymap['rightArrow']) {
        keymap['rightArrow']();
        return;
      }
      if (key.tab && keymap['tab']) {
        keymap['tab']();
        return;
      }
      if (key.backspace && keymap['backspace']) {
        keymap['backspace']();
        return;
      }
      if (key.delete && keymap['delete']) {
        keymap['delete']();
        return;
      }

      // Check character keys (single character input)
      if (input && keymap[input]) {
        keymap[input]();
      }
    },
    { isActive },
  );
}
