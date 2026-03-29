/**
 * health-deep.ts — Garbage Collection prompt builder
 *
 * Instructs an agent to perform deep entropy detection:
 * - Documentation that contradicts current code state (doc-code mismatch)
 * - Imports that reference non-existent modules (dead imports)
 * - TODOs/FIXMEs older than 30 days (stale TODOs)
 * - Architecture patterns that drift from documented conventions
 * - Dead code or unused exports
 *
 * Output: JSON array of { type, file, description, suggestion, severity }
 *
 * Pattern: OpenAI Garbage Collection — agent as entropy detector
 */

export interface HealthDeepParams {
  readme: string;
  claudeMd: string;
  recentGitLog: string;
  sourceFiles: string[]; // list of file paths
  existingHealthReport: string;
}

export interface HealthDeepFinding {
  type: 'doc-code-mismatch' | 'dead-import' | 'stale-todo' | 'convention-drift' | 'dead-code';
  file: string;
  description: string;
  suggestion: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Build the deep entropy detection prompt.
 *
 * @param params - Project context gathered by the health skill
 * @returns Prompt string for ctx.agent.run()
 */
export function buildHealthDeepPrompt(params: HealthDeepParams): string {
  const { readme, claudeMd, recentGitLog, sourceFiles, existingHealthReport } = params;

  const fileList = sourceFiles.slice(0, 200).join('\n');
  const fileCount = sourceFiles.length;
  const truncated = fileCount > 200 ? `\n... and ${fileCount - 200} more files` : '';

  return `You are a garbage collection agent performing deep entropy detection on a TypeScript codebase.

Your job is to find quality debt that deterministic linters cannot catch: documentation drift, dead imports, stale todos, convention violations, and dead code.

## Project Context

### README.md
${readme || '(not found)'}

### CLAUDE.md (conventions + constraints)
${claudeMd || '(not found)'}

### Recent Git Log (last 50 commits)
${recentGitLog || '(not found)'}

### Source Files (${fileCount} total)
${fileList}${truncated}

### Existing Health Report
${existingHealthReport || '(not available)'}

## Your Task

Analyze the project context above and find entropy across these categories:

### 1. Documentation-Code Mismatch (doc-code-mismatch)
Find places where documentation describes something that contradicts the actual code state:
- README claims a feature exists but the implementation is missing or different
- CLAUDE.md describes conventions that are violated in the codebase
- Comments in source files describe logic that no longer matches the code
- Architecture docs reference files or patterns that no longer exist

### 2. Dead Imports (dead-import)
Identify imports that likely reference non-existent or removed modules:
- Import paths that look like they were renamed or moved
- References to packages that may have been removed from dependencies
- Circular or self-referential imports that serve no purpose

### 3. Stale TODOs and FIXMEs (stale-todo)
Find technical debt markers that have been sitting too long:
- TODO/FIXME comments that reference work that should be done but is overdue
- Comments like "temporary", "hack", "workaround" that have been in place for a long time
- Comments referencing specific tickets or issues that were likely closed

### 4. Convention Drift (convention-drift)
Spot patterns that violate the documented conventions in CLAUDE.md:
- Technology choices that contradict the tech stack decisions
- Code patterns explicitly listed as "What NOT to Use"
- Architectural violations of the "Skill-Only" or "Deterministic First" principles

### 5. Dead Code (dead-code)
Identify likely unused code:
- Exported functions or types that appear to have no consumers
- Files that are not imported anywhere in the source list
- Commented-out code blocks that should be removed

## Output Format

Respond ONLY with a JSON code block. No explanation before or after.

\`\`\`json
{
  "findings": [
    {
      "type": "doc-code-mismatch",
      "file": "path/to/file.ts",
      "description": "Specific description of the entropy found",
      "suggestion": "Concrete action to resolve this",
      "severity": "medium"
    }
  ]
}
\`\`\`

Severity guidelines:
- critical: Actively misleading documentation or broken imports that cause runtime errors
- high: Significant tech debt that affects correctness or maintenance
- medium: Convention violations or stale todos that should be addressed soon
- low: Minor cleanup items

Only report findings you are confident about based on the context provided. Prefer precision over recall — a false positive wastes developer time. If you find no issues in a category, omit findings for that category.`;
}
