/**
 * Feature Tracker — feature-session bidirectional tracking.
 *
 * Maintains a registry mapping features to sessions and vice versa.
 * Data is stored as `.sun/features.json` via FileStore (flat file).
 * Enables cross-session continuity: "which sessions touched feature X?"
 * and "which features did session Y work on?"
 *
 * Requirements: LH-20
 */

import type { FileStoreApi } from '@sunco/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeatureEntry {
  id: string;
  name: string;
  sessions: string[];
  status: 'active' | 'completed' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

export interface FeatureStore {
  features: FeatureEntry[];
  version: 1;
}

// ---------------------------------------------------------------------------
// Storage Constants
// ---------------------------------------------------------------------------

/** FileStore category (maps to .sun/ root) */
const CATEGORY = '.';
/** Filename within the category */
const FILENAME = 'features.json';

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

/**
 * Read the feature store from disk.
 * Returns an empty store if the file does not exist or is corrupt.
 */
export async function readFeatureStore(fileStore: FileStoreApi): Promise<FeatureStore> {
  const raw = await fileStore.read(CATEGORY, FILENAME);
  if (!raw) {
    return { features: [], version: 1 };
  }

  try {
    const parsed = JSON.parse(raw) as FeatureStore;
    if (!Array.isArray(parsed.features)) {
      return { features: [], version: 1 };
    }
    return parsed;
  } catch {
    return { features: [], version: 1 };
  }
}

/**
 * Write the feature store to disk.
 */
export async function writeFeatureStore(
  fileStore: FileStoreApi,
  store: FeatureStore,
): Promise<void> {
  await fileStore.write(CATEGORY, FILENAME, JSON.stringify(store, null, 2));
}

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------

/**
 * Register a session against a feature.
 * Creates the feature entry if it does not exist.
 * Adds the sessionId to the feature's session list (deduped).
 * Updates the `updatedAt` timestamp.
 */
export async function trackFeature(
  fileStore: FileStoreApi,
  featureId: string,
  featureName: string,
  sessionId: string,
): Promise<void> {
  const store = await readFeatureStore(fileStore);
  const now = new Date().toISOString();

  let entry = store.features.find((f) => f.id === featureId);
  if (!entry) {
    entry = {
      id: featureId,
      name: featureName,
      sessions: [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    store.features.push(entry);
  }

  if (!entry.sessions.includes(sessionId)) {
    entry.sessions.push(sessionId);
  }
  entry.updatedAt = now;

  await writeFeatureStore(fileStore, store);
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Get all session IDs that have touched a given feature.
 * Returns empty array if the feature is not found.
 */
export async function getFeatureSessions(
  fileStore: FileStoreApi,
  featureId: string,
): Promise<string[]> {
  const store = await readFeatureStore(fileStore);
  const entry = store.features.find((f) => f.id === featureId);
  return entry ? [...entry.sessions] : [];
}

/**
 * Get all features a given session has worked on.
 * Returns empty array if the session is not found in any feature.
 */
export async function getSessionFeatures(
  fileStore: FileStoreApi,
  sessionId: string,
): Promise<FeatureEntry[]> {
  const store = await readFeatureStore(fileStore);
  return store.features.filter((f) => f.sessions.includes(sessionId));
}
