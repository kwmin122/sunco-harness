/**
 * @sunco/skills-harness - Agent Doc Analyzer
 *
 * Static text analysis of agent instruction files (CLAUDE.md, agents.md, AGENTS.md).
 * Extracts line count, sections, instruction density, key section detection,
 * contradiction detection, and 60-line warning flag.
 *
 * Per D-16: Pure static analysis, no LLM calls.
 * Per D-18: Read-only -- never modifies files.
 */

import { readFile } from 'node:fs/promises';
import type { AgentDocMetrics, AgentDocSection, Contradiction } from './types.js';

/** Regex for markdown headers (h1-h3) */
const HEADER_RE = /^(#{1,3})\s+(.+)/;

/** Words that indicate an instruction line */
const IMPERATIVE_WORDS = [
  'must',
  'should',
  'always',
  'never',
  'use',
  'avoid',
  'do not',
  "don't",
  'prefer',
  'require',
  'ensure',
  'make sure',
];

/** Patterns for detecting key sections */
const CONVENTION_PATTERNS = ['convention', 'coding', 'style'];
const CONSTRAINT_PATTERNS = ['constraint', 'rule', 'requirement'];
const ARCHITECTURE_PATTERNS = ['architecture', 'structure', 'design'];

/**
 * Directive parsed from a line, used for contradiction detection.
 */
interface Directive {
  line: number;
  text: string;
  verb: 'positive' | 'negative';
  subject: string;
}

/**
 * Check if a line looks like an instruction.
 * Matches bullet points, numbered lists, or lines with imperative verbs.
 */
function isInstructionLine(line: string): boolean {
  const trimmed = line.trim();

  // Bullet points or numbered lists
  if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
    // Only count if it contains imperative language
    const lower = trimmed.toLowerCase();
    return IMPERATIVE_WORDS.some((word) => lower.includes(word));
  }

  // Plain text with imperative verbs
  const lower = trimmed.toLowerCase();
  return IMPERATIVE_WORDS.some((word) => lower.includes(word));
}

/**
 * Check if a section title matches any of the given patterns (case-insensitive).
 */
function matchesPatterns(title: string, patterns: string[]): boolean {
  const lower = title.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

/**
 * Extract a directive from a line for contradiction detection.
 * Returns null if the line doesn't contain a clear directive.
 */
function extractDirective(line: string, lineNum: number): Directive | null {
  const trimmed = line.trim().toLowerCase();

  // Match "always/use/must/should" + subject (positive)
  const positiveMatch = trimmed.match(
    /(?:always|must|should)\s+(?:use\s+)?(.+?)(?:\s*[.;,]|$)/,
  );
  if (positiveMatch) {
    return {
      line: lineNum,
      text: line.trim(),
      verb: 'positive',
      subject: positiveMatch[1]!.trim(),
    };
  }

  // Match "use" + subject (positive, in bullet context)
  if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
    const useMatch = trimmed.match(/(?:^[-*\d.]+\s*)use\s+(.+?)(?:\s*[.;,]|$)/);
    if (useMatch) {
      return {
        line: lineNum,
        text: line.trim(),
        verb: 'positive',
        subject: useMatch[1]!.trim(),
      };
    }
  }

  // Match "never/avoid/don't/do not" + subject (negative)
  const negativeMatch = trimmed.match(
    /(?:never|avoid|don't|do not)\s+(?:use\s+)?(.+?)(?:\s*[.;,]|$)/,
  );
  if (negativeMatch) {
    return {
      line: lineNum,
      text: line.trim(),
      verb: 'negative',
      subject: negativeMatch[1]!.trim(),
    };
  }

  return null;
}

/**
 * Simple string similarity check using word overlap.
 * Returns true if the subjects share significant overlap.
 */
function subjectsSimilar(a: string, b: string): boolean {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  const minSize = Math.min(wordsA.size, wordsB.size);
  return overlap > 0 && overlap / minSize >= 0.5;
}

/**
 * Detect contradictions between directives in the document.
 * Finds pairs where one is positive ("always use X") and
 * another is negative ("never use X") on similar subjects.
 */
function detectContradictions(lines: string[]): Contradiction[] {
  const directives: Directive[] = [];

  for (let i = 0; i < lines.length; i++) {
    const directive = extractDirective(lines[i]!, i + 1); // 1-based line numbers
    if (directive) {
      directives.push(directive);
    }
  }

  const contradictions: Contradiction[] = [];

  for (let i = 0; i < directives.length; i++) {
    for (let j = i + 1; j < directives.length; j++) {
      const a = directives[i]!;
      const b = directives[j]!;

      // Check for opposing verbs on similar subjects
      if (a.verb !== b.verb && subjectsSimilar(a.subject, b.subject)) {
        contradictions.push({
          lineA: a.line,
          lineB: b.line,
          textA: a.text,
          textB: b.text,
          reason: `Opposing directives on "${a.subject}" vs "${b.subject}"`,
        });
      }
    }
  }

  return contradictions;
}

/**
 * Parse markdown content into sections.
 */
function parseSections(lines: string[]): AgentDocSection[] {
  const sections: AgentDocSection[] = [];
  let currentSection: { title: string; startLine: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(HEADER_RE);
    if (match) {
      // Close previous section
      if (currentSection) {
        const endLine = i; // 0-based, so the previous section ends at line i (exclusive)
        const sectionLines = lines.slice(currentSection.startLine - 1, endLine);
        const instructionCount = sectionLines.filter(isInstructionLine).length;

        sections.push({
          title: currentSection.title,
          startLine: currentSection.startLine,
          endLine: endLine, // 1-based end line (inclusive of last content line)
          lineCount: endLine - currentSection.startLine + 1,
          instructionCount,
        });
      }

      currentSection = {
        title: match[2]!.trim(),
        startLine: i + 1, // 1-based
      };
    }
  }

  // Close the last section
  if (currentSection) {
    const sectionLines = lines.slice(currentSection.startLine - 1);
    const instructionCount = sectionLines.filter(isInstructionLine).length;

    sections.push({
      title: currentSection.title,
      startLine: currentSection.startLine,
      endLine: lines.length,
      lineCount: lines.length - currentSection.startLine + 1,
      instructionCount,
    });
  }

  return sections;
}

/**
 * Analyze an agent instruction file and extract metrics.
 *
 * @param filePath - Absolute path to the agent doc file
 * @returns Metrics extracted from the file (efficiencyScore defaults to 0, computed separately)
 */
export async function analyzeAgentDoc(filePath: string): Promise<AgentDocMetrics> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const totalLines = lines.length;

  const sections = parseSections(lines);
  const sectionCount = sections.length;

  const totalInstructions = sections.reduce((sum, s) => sum + s.instructionCount, 0);
  const instructionDensity = sectionCount > 0 ? totalInstructions / sectionCount : 0;

  const hasConventions = sections.some((s) => matchesPatterns(s.title, CONVENTION_PATTERNS));
  const hasConstraints = sections.some((s) => matchesPatterns(s.title, CONSTRAINT_PATTERNS));
  const hasArchitecture = sections.some((s) => matchesPatterns(s.title, ARCHITECTURE_PATTERNS));

  const contradictions = detectContradictions(lines);

  return {
    filePath,
    totalLines,
    sectionCount,
    sections,
    instructionDensity,
    hasConventions,
    hasConstraints,
    hasArchitecture,
    contradictions,
    lineCountWarning: totalLines > 60,
    efficiencyScore: 0, // Computed separately by efficiency-scorer
  };
}
