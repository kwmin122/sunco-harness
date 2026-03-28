/**
 * Barrel export for all prompt builders.
 */

export { buildResearchPrompt } from './research.js';
export { buildSynthesisPrompt } from './synthesis.js';
export { formatPreScan } from './format-pre-scan.js';

// Scan prompt builders (from plan 04-02)
export { buildScanStackPrompt } from './scan-stack.js';
export { buildScanArchitecturePrompt } from './scan-architecture.js';
export { buildScanStructurePrompt } from './scan-structure.js';
export { buildScanConventionsPrompt } from './scan-conventions.js';
export { buildScanTestsPrompt } from './scan-tests.js';
export { buildScanIntegrationsPrompt } from './scan-integrations.js';
export { buildScanConcernsPrompt } from './scan-concerns.js';

// Discuss prompt builders (from plan 05-01)
export { buildDiscussAnalyzePrompt } from './discuss-analyze.js';
export { buildDiscussDeepDivePrompt } from './discuss-deepdive.js';
export { buildDiscussScenarioPrompt } from './discuss-scenario.js';

// Assume prompt builder (from plan 05-02)
export { buildAssumePrompt } from './assume.js';

// Phase 5 research prompts (distinct from Phase 4's research.ts)
export { buildResearchDomainPrompt } from './research-domain.js';
export { buildResearchSynthesizePrompt } from './research-synthesize.js';

// Plan prompt builders (from plan 05-04)
export { buildPlanCreatePrompt, buildPlanRevisePrompt } from './plan-create.js';
export { buildPlanCheckerPrompt } from './plan-checker.js';

// Execute prompt builders (from plan 06-02)
export { buildExecutePrompt } from './execute.js';
export type { ExecuteAgentSummary } from './execute.js';

// Review prompt builders (from plan 06-03)
export { buildReviewPrompt, REVIEW_DIMENSIONS } from './review.js';
export type { ReviewFinding } from './review.js';
export { buildReviewSynthesizePrompt } from './review-synthesize.js';

// Verify expert prompt builders (from plan 07-01)
export { buildVerifySecurityPrompt } from './verify-security.js';
export { buildVerifyPerformancePrompt } from './verify-performance.js';
export { buildVerifyArchitecturePrompt } from './verify-architecture.js';
export { buildVerifyCorrectnessPrompt } from './verify-correctness.js';
export { buildVerifyCoordinatorPrompt } from './verify-coordinator.js';
export { buildVerifyAdversarialPrompt } from './verify-adversarial.js';
export { buildVerifyIntentPrompt } from './verify-intent.js';

// Test generation prompt builders (from plan 07-01)
export { buildTestGenPrompt } from './test-gen.js';
export { buildTestGenMockPrompt } from './test-gen-mock.js';
