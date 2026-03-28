/**
 * Shared types for @sunco/skills-workflow
 *
 * Types used across workflow skills for roadmap parsing,
 * state reading, handoff management, and git state capture.
 */

/** A parsed phase from ROADMAP.md phase list */
export interface ParsedPhase {
  /** Phase number (integer or decimal, e.g. 3 or 3.1) */
  number: number | string;
  /** Phase name */
  name: string;
  /** Phase description */
  description: string;
  /** Whether the phase checkbox is checked */
  completed: boolean;
  /** Requirement IDs listed under this phase */
  requirements: string[];
  /** Plans listed under this phase */
  plans: { name: string; completed: boolean }[];
  /** Total plan count from progress table (null if unknown) */
  planCount: number | null;
  /** Number of completed plans */
  completedCount: number;
}

/** A row from the ROADMAP.md progress table */
export interface ParsedProgress {
  /** Phase number (integer or decimal) */
  phaseNumber: number | string;
  /** Phase name */
  phaseName: string;
  /** Number of completed plans */
  plansComplete: number;
  /** Total plans (null if unknown/?) */
  plansTotal: number | null;
  /** Status string (e.g. "Complete", "In Progress", "Planned") */
  status: string;
}

/** Parsed state from STATE.md YAML frontmatter and body */
export interface ParsedState {
  /** Current phase number (null if not set) */
  phase: number | null;
  /** Current plan identifier (null if not set) */
  plan: string | null;
  /** Current status string */
  status: string;
  /** Last activity description */
  lastActivity: string;
  /** Progress metrics */
  progress: {
    totalPhases: number;
    completedPhases: number;
    totalPlans: number;
    completedPlans: number;
    percent: number;
  };
}

/** Git repository state snapshot */
export interface GitState {
  /** Current branch name */
  branch: string;
  /** Whether there are uncommitted changes */
  uncommittedChanges: boolean;
  /** List of uncommitted file paths */
  uncommittedFiles: string[];
}

/** A todo item tracked in .sun/ state */
export interface TodoItem {
  id: number;
  text: string;
  done: boolean;
  createdAt: string;
  doneAt: string | null;
}

/** A seed idea tracked in .sun/ state */
export interface SeedItem {
  id: number;
  idea: string;
  trigger: string;
  createdAt: string;
  surfaced: boolean;
  surfacedAt: string | null;
}

/** A backlog item tracked in .sun/ state */
export interface BacklogItem {
  id: number;
  text: string;
  createdAt: string;
  promotedAt: string | null;
}
