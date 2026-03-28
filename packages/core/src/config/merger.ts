/**
 * @sunco/core - Deep Merge with Array-Replace Semantics
 *
 * Implements SUNCO's config merge strategy (D/CFG-02):
 * - Objects are deep-merged recursively
 * - Arrays REPLACE (not concatenate) -- directory config arrays override project arrays entirely
 * - Non-object values (scalars, null, arrays) from override win
 *
 * This is critical for three-layer config: global <- project <- directory
 */

type PlainObject = Record<string, unknown>;

/** Check if a value is a plain object (not array, not null) */
function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep merge two config objects.
 *
 * - Objects merge recursively (keys from both are combined)
 * - Arrays replace (override wins entirely)
 * - Scalars and null replace
 * - Does NOT mutate either input
 *
 * @param base - Lower-priority config layer
 * @param override - Higher-priority config layer
 * @returns New merged object
 */
export function deepMerge(base: PlainObject, override: PlainObject): PlainObject {
  const result: PlainObject = {};

  // Copy all base keys
  for (const key of Object.keys(base)) {
    result[key] = base[key];
  }

  // Apply overrides
  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overVal = override[key];

    if (isPlainObject(baseVal) && isPlainObject(overVal)) {
      // Both are plain objects: recurse
      result[key] = deepMerge(baseVal, overVal);
    } else {
      // Everything else (arrays, scalars, null, type mismatch): override wins
      result[key] = overVal;
    }
  }

  return result;
}
