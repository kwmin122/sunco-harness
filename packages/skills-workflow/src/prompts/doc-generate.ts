/**
 * Document generation prompts for doc.skill.ts
 *
 * Builds agent prompts that instruct the model to produce structured
 * document content. Output uses section markers for HwpxWriter parsing.
 *
 * Requirements: DOC-01, DOC-02
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocPromptOptions {
  /** Document type: readme, api, architecture, 제안서, 수행계획서, 보고서, etc. */
  type: string;
  /** Output format requested: hwpx, md, or template */
  format: 'hwpx' | 'md' | 'template';
  /** Project context gathered from PROJECT.md, package.json, README, etc. */
  context: string;
  /** For template mode: placeholders found in the template */
  placeholders?: string[];
  /** Optional project name */
  projectName?: string;
}

// ---------------------------------------------------------------------------
// Section marker format (used by doc.skill.ts to parse HwpxWriter calls)
// ---------------------------------------------------------------------------

const SECTION_FORMAT = `
## Output Format

Structure your output using these section markers so it can be parsed into document sections:

\`\`\`
[TITLE] Document title here
[HEADING1] Section heading
[HEADING2] Subsection heading
[BODY] Regular paragraph text
[TABLE:headers] Col1,Col2,Col3
[ROW] value1,value2,value3
[PAGEBREAK]
\`\`\`

Rules:
- Every line must start with one of the markers above.
- [TABLE:headers] is followed by [ROW] lines for each data row.
- [PAGEBREAK] inserts a page break.
- Multiple [BODY] lines are allowed — each becomes a separate paragraph.
- Do NOT use markdown syntax (no # headers, no ** bold, no - bullets).
  Use [HEADING1], [HEADING2] etc. instead.
`.trim();

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Build the main document generation prompt.
 */
export function buildDocPrompt(options: DocPromptOptions): string {
  const { type, format, context, placeholders, projectName } = options;
  const docLabel = projectName ? `"${projectName}" project` : 'the project';

  if (format === 'template' && placeholders && placeholders.length > 0) {
    return buildTemplateFillPrompt(type, context, placeholders, docLabel);
  }

  if (format === 'hwpx') {
    return buildHwpxPrompt(type, context, docLabel);
  }

  // md format
  return buildMarkdownPrompt(type, context, docLabel);
}

function buildHwpxPrompt(type: string, context: string, docLabel: string): string {
  const docTypeInstructions = getDocTypeInstructions(type);

  return `You are generating a ${type} document for ${docLabel}.

## Project Context

${context}

## Document Type: ${type}

${docTypeInstructions}

${SECTION_FORMAT}

Generate the complete ${type} document now. Be thorough, professional, and accurate. Use only information available in the project context.`;
}

function buildMarkdownPrompt(type: string, context: string, docLabel: string): string {
  const docTypeInstructions = getDocTypeInstructions(type);

  return `You are generating a ${type} document for ${docLabel} in Markdown format.

## Project Context

${context}

## Document Type: ${type}

${docTypeInstructions}

## Output Format

Produce pure Markdown. Start with a # heading for the document title.
Use ## for sections, ### for subsections.
Be thorough, professional, and accurate.
Use only information available in the project context.

Generate the complete ${type} document now.`;
}

function buildTemplateFillPrompt(
  type: string,
  context: string,
  placeholders: string[],
  docLabel: string,
): string {
  const placeholderList = placeholders.map((p) => `- {{${p}}}`).join('\n');

  return `You are filling in a ${type} document template for ${docLabel}.

## Project Context

${context}

## Template Placeholders to Fill

${placeholderList}

## Output Format

Respond with a JSON object where each key is a placeholder name (without {{ }}) and the value is the text to substitute.

Example:
\`\`\`json
{
  "project_name": "My Project",
  "description": "A brief description...",
  "version": "1.0.0"
}
\`\`\`

Be accurate and concise. Use only information from the project context above.
Fill ALL placeholders listed.`;
}

// ---------------------------------------------------------------------------
// Document type instructions
// ---------------------------------------------------------------------------

function getDocTypeInstructions(type: string): string {
  const lower = type.toLowerCase();

  if (lower === 'readme') {
    return `Create a comprehensive README with:
- Project title and one-line description
- Features list
- Installation instructions
- Usage examples
- Configuration options (if any)
- License and contributing sections`;
  }

  if (lower === 'api' || lower === 'api-docs') {
    return `Create API documentation with:
- Overview of the API
- Authentication (if applicable)
- Endpoints or methods, each with: description, parameters, return values, examples
- Error codes and handling`;
  }

  if (lower === 'architecture') {
    return `Create an architecture document with:
- System overview and goals
- Component breakdown
- Data flow and interactions
- Technology decisions and rationale
- Deployment overview`;
  }

  if (lower === '제안서') {
    return `제안서(Proposal document)를 다음 구성으로 작성하세요:
- 제안 개요 및 목적
- 현황 분석
- 제안 내용 및 범위
- 기대 효과
- 추진 일정
- 소요 예산 (해당 시)
- 결론 및 제언

한국어로 작성하세요.`;
  }

  if (lower === '수행계획서') {
    return `수행계획서(Implementation Plan)를 다음 구성으로 작성하세요:
- 사업 개요
- 추진 배경 및 목적
- 추진 범위
- 추진 일정 및 마일스톤
- 추진 체계 및 역할
- 성과 지표
- 위험 요소 및 대응 방안

한국어로 작성하세요.`;
  }

  if (lower === '보고서') {
    return `보고서(Report)를 다음 구성으로 작성하세요:
- 개요
- 현황 및 배경
- 주요 내용
- 분석 및 결과
- 결론 및 제언

한국어로 작성하세요.`;
  }

  // Generic fallback
  return `Create a professional ${type} document with appropriate sections for the project context provided.`;
}
