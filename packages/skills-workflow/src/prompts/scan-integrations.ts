/**
 * Scan prompt: INTEGRATIONS.md
 *
 * Generates the agent prompt for analyzing a codebase's external integrations.
 * Output: a markdown document describing APIs, databases, third-party services,
 * auth providers, and storage/CDN.
 */

import type { PreScanContext } from '../shared/pre-scan.js';
import { formatPreScan } from './format-pre-scan.js';

export function buildScanIntegrationsPrompt(preScan: PreScanContext): string {
  return `You are analyzing an existing codebase to document its external integrations and service dependencies.

${formatPreScan(preScan)}

## Task

Produce an **INTEGRATIONS.md** document with the following sections. Look for environment variable patterns (.env.example), SDK imports in package.json, config files referencing external services, and Docker Compose service definitions.

### Required Sections

1. **External APIs** -- REST/GraphQL/gRPC endpoints this project calls. Evidence from SDK dependencies, API client files, URL patterns in config.
2. **Databases** -- Database systems used (PostgreSQL, MySQL, SQLite, MongoDB, Redis). Evidence from ORM/driver dependencies, connection string patterns, migration directories.
3. **Third-party Services** -- SaaS integrations (Stripe, SendGrid, Sentry, etc.). Evidence from SDK packages in package.json and env var names.
4. **Authentication Providers** -- OAuth providers, SSO services, auth libraries. Evidence from auth config files, passport strategies, NextAuth providers.
5. **CDNs / Storage** -- Cloud storage (S3, GCS, Azure Blob), CDN configuration, static asset hosting. Evidence from SDK dependencies and config patterns.

### Output Format

Produce pure markdown. The output IS the document -- no wrapping, no code fences around the whole thing. Start with \`# Integrations\` as the first line.

### Grounding Rule

Only report what the pre-scan data supports. Do NOT hallucinate. If a section has no evidence, write "No evidence found in pre-scan data." for that section.`;
}
