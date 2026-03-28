/**
 * Roadmap writer - Add, insert, and remove phases in ROADMAP.md
 *
 * Modifies ROADMAP.md content string and returns the updated content.
 * Handles phase list, phase details sections, and progress table.
 */

export interface RemovePhaseResult {
  content: string;
  removed: boolean;
  reason?: string;
}

/**
 * Append a new phase with the next sequential integer number.
 * Adds the phase to the list, creates a detail section, and adds a progress row.
 */
export function addPhase(content: string, name: string, description: string): string {
  // Find the highest integer phase number in the list
  const phaseLineRe = /^- \[[ x]\] \*\*Phase (\d+)(?:\.\d+)?: .+\*\*/gm;
  let maxPhase = 0;
  let match: RegExpExecArray | null;

  while ((match = phaseLineRe.exec(content)) !== null) {
    const num = parseInt(match[1], 10);
    if (num > maxPhase) maxPhase = num;
  }

  const newNum = maxPhase + 1;
  const newPhaseLine = `- [ ] **Phase ${newNum}: ${name}** - ${description}`;
  const newDetailSection = `\n### Phase ${newNum}: ${name}\n**Goal**: TBD\n**Requirements**: TBD\n`;
  const newProgressRow = `| ${newNum}. ${name} | 0/? | Not started | - |`;

  // Insert phase line after the last phase list line
  let result = content;

  // Find the last phase list line and insert after it
  const allPhaseLinesRe = /^- \[[ x]\] \*\*Phase \d+(?:\.\d+)?: .+\*\* - .+$/gm;
  let lastPhaseLineEnd = -1;
  while ((match = allPhaseLinesRe.exec(content)) !== null) {
    lastPhaseLineEnd = match.index + match[0].length;
  }

  if (lastPhaseLineEnd >= 0) {
    result =
      result.slice(0, lastPhaseLineEnd) +
      '\n' +
      newPhaseLine +
      result.slice(lastPhaseLineEnd);
  }

  // Insert detail section before ## Progress
  const progressIdx = result.indexOf('## Progress');
  if (progressIdx >= 0) {
    result =
      result.slice(0, progressIdx) +
      newDetailSection +
      '\n' +
      result.slice(progressIdx);
  } else {
    // Append at end if no Progress section
    result += '\n' + newDetailSection;
  }

  // Insert progress row before the last row or at end of table
  const progressTableEndRe = /^(\|.+\|)\s*$/gm;
  let lastTableRowEnd = -1;
  while ((match = progressTableEndRe.exec(result)) !== null) {
    lastTableRowEnd = match.index + match[0].length;
  }

  if (lastTableRowEnd >= 0) {
    result =
      result.slice(0, lastTableRowEnd) +
      '\n' +
      newProgressRow +
      result.slice(lastTableRowEnd);
  }

  return result;
}

/**
 * Insert a phase as a decimal (e.g., 2.1, 2.2) after the specified phase number.
 * Finds existing decimal suffixes to auto-increment.
 */
export function insertPhase(content: string, name: string, description: string, afterPhase: number): string {
  // Find existing decimal phases for this base number
  const decimalRe = new RegExp(
    `^- \\[[ x]\\] \\*\\*Phase ${afterPhase}\\.(\\d+): .+\\*\\*`,
    'gm'
  );
  let maxDecimal = 0;
  let match: RegExpExecArray | null;

  while ((match = decimalRe.exec(content)) !== null) {
    const dec = parseInt(match[1], 10);
    if (dec > maxDecimal) maxDecimal = dec;
  }

  const newDecimal = maxDecimal + 1;
  const newPhaseNum = `${afterPhase}.${newDecimal}`;
  const newPhaseLine = `- [ ] **Phase ${newPhaseNum}: ${name}** - ${description}`;
  const newDetailSection = `\n### Phase ${newPhaseNum}: ${name}\n**Goal**: TBD\n**Requirements**: TBD\n`;
  const newProgressRow = `| ${newPhaseNum}. ${name} | 0/? | Not started | - |`;

  let result = content;

  // Find insertion point: after the last decimal of afterPhase, or after afterPhase itself
  // Look for the last line matching Phase afterPhase or Phase afterPhase.X
  const afterLineRe = new RegExp(
    `^- \\[[ x]\\] \\*\\*Phase ${afterPhase}(?:\\.\\d+)?: .+\\*\\* - .+$`,
    'gm'
  );
  let lastAfterEnd = -1;
  while ((match = afterLineRe.exec(content)) !== null) {
    lastAfterEnd = match.index + match[0].length;
  }

  if (lastAfterEnd >= 0) {
    result =
      result.slice(0, lastAfterEnd) +
      '\n' +
      newPhaseLine +
      result.slice(lastAfterEnd);
  }

  // Insert detail section: find the ### Phase (afterPhase+1) or ## Progress and insert before
  // First try to find next integer phase section
  const nextPhase = afterPhase + 1;
  const nextSectionRe = new RegExp(`^### Phase ${nextPhase}: `, 'm');
  const nextSectionMatch = nextSectionRe.exec(result);
  const progressIdx = result.indexOf('## Progress');

  if (nextSectionMatch) {
    result =
      result.slice(0, nextSectionMatch.index) +
      newDetailSection +
      '\n' +
      result.slice(nextSectionMatch.index);
  } else if (progressIdx >= 0) {
    result =
      result.slice(0, progressIdx) +
      newDetailSection +
      '\n' +
      result.slice(progressIdx);
  }

  // Insert progress row after the afterPhase row (or its last decimal)
  const afterProgressRe = new RegExp(
    `^\\|\\s*${afterPhase}(?:\\.\\d+)?\\..+?\\|.+?\\|.+?\\|.+?\\|`,
    'gm'
  );
  const baseProgressRe = new RegExp(
    `^\\|\\s*${afterPhase}\\..+?\\|.+?\\|.+?\\|.+?\\|`,
    'gm'
  );

  let lastProgressRowEnd = -1;

  // Find the base phase's progress row
  const baseRowRe = new RegExp(
    `^\\|\\s*${afterPhase}\\..+?\\|.+?\\|.+?\\|.+?\\|`,
    'gm'
  );
  while ((match = baseRowRe.exec(result)) !== null) {
    lastProgressRowEnd = match.index + match[0].length;
  }

  // If no decimal rows found, find the base afterPhase row
  if (lastProgressRowEnd < 0) {
    const exactRowRe = new RegExp(
      `^\\|\\s*${afterPhase}\\.\\s.+?\\|.+?\\|.+?\\|.+?\\|`,
      'gm'
    );
    while ((match = exactRowRe.exec(result)) !== null) {
      lastProgressRowEnd = match.index + match[0].length;
    }
  }

  if (lastProgressRowEnd >= 0) {
    result =
      result.slice(0, lastProgressRowEnd) +
      '\n' +
      newProgressRow +
      result.slice(lastProgressRowEnd);
  }

  return result;
}

/**
 * Remove a phase if not started/completed.
 * Renumbers subsequent integer phases in the list, details, and progress table.
 */
export function removePhase(content: string, phaseNumber: number | string): RemovePhaseResult {
  const phaseStr = String(phaseNumber);

  // Check if phase exists in the list
  const phaseLineRe = new RegExp(
    `^- \\[([ x])\\] \\*\\*Phase ${escapeRegex(phaseStr)}: .+\\*\\* - .+$`,
    'm'
  );
  const phaseMatch = phaseLineRe.exec(content);

  if (!phaseMatch) {
    return { content, removed: false, reason: `Phase ${phaseStr} not found` };
  }

  // Check if completed
  if (phaseMatch[1] === 'x') {
    return { content, removed: false, reason: `Phase ${phaseStr} is already complete and cannot be removed` };
  }

  // Check progress table for completed plans
  const progressRowRe = new RegExp(
    `^\\|\\s*${escapeRegex(phaseStr)}\\..+?\\|\\s*(\\d+)/`,
    'm'
  );
  const progressMatch = progressRowRe.exec(content);
  if (progressMatch && parseInt(progressMatch[1], 10) > 0) {
    return { content, removed: false, reason: `Phase ${phaseStr} has completed plans and cannot be removed` };
  }

  let result = content;

  // Remove phase list line
  result = result.replace(
    new RegExp(`^- \\[[ x]\\] \\*\\*Phase ${escapeRegex(phaseStr)}: .+\\*\\* - .+\\n?`, 'm'),
    ''
  );

  // Remove detail section: ### Phase N: Name ... (until next ### or ## or end)
  const detailRe = new RegExp(
    `\\n?### Phase ${escapeRegex(phaseStr)}: [^\\n]+\\n(?:(?!###|## ).*\\n)*`,
    ''
  );
  result = result.replace(detailRe, '');

  // Remove progress table row
  result = result.replace(
    new RegExp(`^\\|\\s*${escapeRegex(phaseStr)}\\..+?\\|.+?\\|.+?\\|.+?\\|\\n?`, 'm'),
    ''
  );

  // Renumber subsequent integer phases if this was an integer phase
  if (!phaseStr.includes('.')) {
    const removedNum = parseInt(phaseStr, 10);
    result = renumberPhases(result, removedNum);
  }

  return { content: result, removed: true };
}

/**
 * Renumber all integer phases above removedNum by decrementing by 1.
 * Handles: phase list (**Phase N:**), detail headers (### Phase N:), progress table rows (| N. Name).
 */
function renumberPhases(content: string, removedNum: number): string {
  let result = content;

  // Collect all integer phase numbers above removedNum from all patterns
  const phaseNums: number[] = [];
  const patterns = [/\*\*Phase (\d+):/g, /### Phase (\d+):/g, /\|\s*(\d+)\.\s/g];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const num = parseInt(match[1], 10);
      if (num > removedNum && !phaseNums.includes(num)) {
        phaseNums.push(num);
      }
    }
  }

  // Sort ascending and renumber each
  phaseNums.sort((a, b) => a - b);

  for (const num of phaseNums) {
    const newNum = num - 1;
    // Phase list line: **Phase N: -> **Phase (N-1):
    result = result.replace(
      new RegExp(`(\\*\\*Phase )${num}(: )`, 'g'),
      `$1${newNum}$2`
    );
    // Detail section header: ### Phase N: -> ### Phase (N-1):
    result = result.replace(
      new RegExp(`(### Phase )${num}(: )`, 'g'),
      `$1${newNum}$2`
    );
    // Progress table row: | N. -> | (N-1).
    result = result.replace(
      new RegExp(`(\\|\\s*)${num}(\\.\\s)`, 'g'),
      `$1${newNum}$2`
    );
  }

  return result;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
