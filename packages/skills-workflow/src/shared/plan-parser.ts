/**
 * Plan parser - Parse PLAN.md frontmatter and XML task blocks
 *
 * Extracts YAML frontmatter (between --- delimiters) and XML-like task blocks
 * from PLAN.md files. Uses regex-based parsing (no XML/YAML library) to match
 * the established convention in state-reader.ts and roadmap-parser.ts.
 */

export interface PlanFrontmatter {
  phase: string;
  plan: number;
  type: 'execute' | 'tdd';
  wave: number;
  depends_on: number[];
  files_modified: string[];
  autonomous: boolean;
  requirements: string[];
}

export interface PlanTask {
  name: string;
  files: string[];
  action: string;
  verify: string;
  done: string[];
}

export interface ParsedPlan {
  frontmatter: PlanFrontmatter;
  objective: string;
  context: string;
  tasks: PlanTask[];
  raw: string;
}

/**
 * Parse a PLAN.md file content into a structured ParsedPlan.
 * Extracts YAML frontmatter, objective, context, and task blocks.
 * Throws if no frontmatter delimiters found.
 */
export function parsePlanMd(content: string): ParsedPlan {
  const frontmatter = parseFrontmatter(content);
  const objective = extractBlock(content, 'objective');
  const context = extractBlock(content, 'context');
  const tasks = extractTasks(content);

  return {
    frontmatter,
    objective,
    context,
    tasks,
    raw: content,
  };
}

/**
 * Group an array of ParsedPlan by wave number.
 * Plans without a wave (undefined/NaN/0) default to wave 1.
 * Returns a Map with keys sorted ascending.
 */
export function groupPlansByWave(plans: ParsedPlan[]): Map<number, ParsedPlan[]> {
  const groups = new Map<number, ParsedPlan[]>();

  for (const plan of plans) {
    const wave = plan.frontmatter.wave || 1;
    const existing = groups.get(wave);
    if (existing) {
      existing.push(plan);
    } else {
      groups.set(wave, [plan]);
    }
  }

  // Return sorted Map
  const sorted = new Map<number, ParsedPlan[]>();
  const keys = [...groups.keys()].sort((a, b) => a - b);
  for (const key of keys) {
    sorted.set(key, groups.get(key)!);
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse YAML-like frontmatter from content between --- delimiters.
 * Supports scalar values, inline arrays ([]), and multiline arrays (- item).
 */
function parseFrontmatter(content: string): PlanFrontmatter {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    throw new Error('No frontmatter found: missing --- delimiters');
  }

  const fm = fmMatch[1];

  const getScalar = (key: string): string => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m?.[1]?.trim() ?? '';
  };

  const getArray = (key: string): string[] => {
    // Check for inline empty array: key: []
    const inlineEmpty = fm.match(new RegExp(`^${key}:\\s*\\[\\]`, 'm'));
    if (inlineEmpty) return [];

    // Check for inline array with values: key: [a, b, c]
    const inlineValues = fm.match(new RegExp(`^${key}:\\s*\\[(.+)\\]`, 'm'));
    if (inlineValues) {
      return inlineValues[1]
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }

    // Check for multiline array: key:\n  - item1\n  - item2
    const multiline = fm.match(new RegExp(`^${key}:\\s*\\n((?:[ \\t]+-[ \\t]+.+\\n?)*)`, 'm'));
    if (multiline && multiline[1].trim()) {
      return multiline[1]
        .split('\n')
        .map((line) => line.replace(/^\s*-\s+/, '').trim())
        .filter(Boolean);
    }

    return [];
  };

  const waveRaw = getScalar('wave');
  const wave = waveRaw ? parseInt(waveRaw, 10) : 1;

  return {
    phase: getScalar('phase'),
    plan: parseInt(getScalar('plan'), 10),
    type: getScalar('type') as 'execute' | 'tdd',
    wave: isNaN(wave) ? 1 : wave,
    depends_on: getArray('depends_on').map(Number).filter((n) => !isNaN(n)),
    files_modified: getArray('files_modified'),
    autonomous: getScalar('autonomous') === 'true',
    requirements: getArray('requirements'),
  };
}

/**
 * Extract text content from a named XML-like block.
 * Returns empty string if block not found.
 */
function extractBlock(content: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const m = content.match(re);
  return m?.[1]?.trim() ?? '';
}

/**
 * Extract all <task> blocks from the content.
 * Parses <name>, <files>, <action>, <verify>/<automated>, <done> from each task.
 */
function extractTasks(content: string): PlanTask[] {
  const taskRegex = /<task[^>]*>([\s\S]*?)<\/task>/g;
  const tasks: PlanTask[] = [];
  let match: RegExpExecArray | null;

  while ((match = taskRegex.exec(content)) !== null) {
    const block = match[1];

    const extractTag = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return m?.[1]?.trim() ?? '';
    };

    const name = extractTag('name');
    const filesStr = extractTag('files');
    const action = extractTag('action');

    // Verify: extract <automated> nested inside <verify> if present
    const verifyBlock = extractTag('verify');
    const automatedMatch = verifyBlock.match(/<automated>([\s\S]*?)<\/automated>/);
    const verify = automatedMatch ? automatedMatch[1].trim() : verifyBlock;

    const doneStr = extractTag('done');

    // Parse files: split by comma or newline
    const files = filesStr
      .split(/[,\n]/)
      .map((f) => f.trim())
      .filter(Boolean);

    // Parse done: split by newline, strip "- " prefix
    const done = doneStr
      .split('\n')
      .map((d) => d.replace(/^-\s*/, '').trim())
      .filter(Boolean);

    tasks.push({ name, files, action, verify, done });
  }

  return tasks;
}
