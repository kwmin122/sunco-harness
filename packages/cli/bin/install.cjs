#!/usr/bin/env node
'use strict';

const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const readline = require('readline');

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const EMERALD = '\x1b[38;2;0;128;70m';
const GREEN   = '\x1b[32m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const RESET   = '\x1b[0m';

// ---------------------------------------------------------------------------
// ASCII art logo
// ---------------------------------------------------------------------------
const LOGO_WIDE = `
${EMERALD} ███████╗██╗   ██╗███╗   ██╗ ██████╗ ██████╗ ${RESET}
${EMERALD} ██╔════╝██║   ██║████╗  ██║██╔════╝██╔═══██╗${RESET}
${EMERALD} ███████╗██║   ██║██╔██╗ ██║██║     ██║   ██║${RESET}
${EMERALD} ╚════██║██║   ██║██║╚██╗██║██║     ██║   ██║${RESET}
${EMERALD} ███████║╚██████╔╝██║ ╚████║╚██████╗╚██████╔╝${RESET}
${EMERALD} ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝${RESET}
`;

const LOGO_COMPACT = `
${EMERALD} ╔═╗╦ ╦╔╗╔╔═╗╔═╗${RESET}
${EMERALD} ╚═╗║ ║║║║║  ║ ║${RESET}
${EMERALD} ╚═╝╚═╝╝╚╝╚═╝╚═╝${RESET}
`;

function getLogo() {
  const cols = process.stdout.columns || 80;
  return cols >= 50 ? LOGO_WIDE : LOGO_COMPACT;
}

// ---------------------------------------------------------------------------
// Read version from package.json
// ---------------------------------------------------------------------------
function readVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;
  ensureDir(dest);
  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

function copyGlob(srcDir, pattern, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  ensureDir(destDir);
  let count = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    // Simple suffix match — pattern is e.g. "*.md", "*.js", "*.cjs"
    const ext = pattern.replace('*', '');
    if (!entry.name.endsWith(ext)) continue;
    fs.copyFileSync(
      path.join(srcDir, entry.name),
      path.join(destDir, entry.name)
    );
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Runtime-aware path replacement (P0-4)
//
// Source files use $HOME/.claude/ as the canonical default path.
// For non-Claude runtimes, we replace .claude/ with .<runtime>/ at copy time.
// This is the same approach GSD uses: separate copies per runtime.
//
// Path patterns replaced:
//   .claude/sunco/     → .<runtime>/sunco/
//   .claude/hooks/     → .<runtime>/hooks/
//   .claude/commands/  → .<runtime>/commands/
//   .claude/agents/    → .<runtime>/sunco/agents/ (agents live under sunco/)
// ---------------------------------------------------------------------------
const PATH_REPLACEMENT_EXTENSIONS = new Set(['.md', '.cjs', '.js', '.json', '.toml', '.txt']);

function shouldReplacePaths(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return PATH_REPLACEMENT_EXTENSIONS.has(ext);
}

function replaceRuntimePaths(content, runtimeDir) {
  if (runtimeDir === '.claude') return content;
  // Replace all .claude/ references with the target runtime directory
  return content.replace(/\.claude\//g, `${runtimeDir}/`);
}

function copyFileWithReplacement(srcPath, destPath, runtimeDir) {
  if (runtimeDir && runtimeDir !== '.claude' && shouldReplacePaths(srcPath)) {
    const content = fs.readFileSync(srcPath, 'utf8');
    fs.writeFileSync(destPath, replaceRuntimePaths(content, runtimeDir), 'utf8');
  } else {
    fs.copyFileSync(srcPath, destPath);
  }
}

function copyDirWithReplacement(src, dest, runtimeDir) {
  if (!fs.existsSync(src)) return 0;
  ensureDir(dest);
  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirWithReplacement(srcPath, destPath, runtimeDir);
    } else {
      copyFileWithReplacement(srcPath, destPath, runtimeDir);
      count++;
    }
  }
  return count;
}

function removeDirIfExists(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// settings.json patching
// ---------------------------------------------------------------------------
function patchSettings(targetDir, runtimeDir) {
  const settingsPath = path.join(targetDir, 'settings.json');
  let settings = {};

  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      settings = {};
    }
  }

  const hooksBase = `$HOME/${runtimeDir}/hooks`;

  // --- Idempotent hook cleanup (P0-8) ---
  // Remove ALL existing sunco hook entries in any format (flat or nested)
  // before re-adding in the canonical flat format.
  if (!settings.hooks) settings.hooks = {};

  for (const eventType of ['SessionStart', 'PreToolUse', 'PostToolUse']) {
    if (!Array.isArray(settings.hooks[eventType])) continue;
    settings.hooks[eventType] = settings.hooks[eventType].filter((h) => {
      // Flat format: { matcher, command }
      if (h.command && h.command.includes('sunco-')) return false;
      // Nested format: { matcher, hooks: [{ type, command }] }
      if (Array.isArray(h.hooks) && h.hooks.some((inner) => inner.command && inner.command.includes('sunco-'))) return false;
      return true;
    });
  }

  // --- Register hooks (P0-7: all copied hooks get wired) ---

  // SessionStart: update check
  if (!Array.isArray(settings.hooks.SessionStart)) settings.hooks.SessionStart = [];
  settings.hooks.SessionStart.push({
    matcher: '',
    command: `node ${hooksBase}/sunco-check-update.cjs`
  });

  // PostToolUse: context window monitor
  if (!Array.isArray(settings.hooks.PostToolUse)) settings.hooks.PostToolUse = [];
  settings.hooks.PostToolUse.push({
    matcher: '',
    command: `node ${hooksBase}/sunco-context-monitor.cjs`
  });

  // PreToolUse: prompt injection guard (advisory, Write/Edit tools)
  if (!Array.isArray(settings.hooks.PreToolUse)) settings.hooks.PreToolUse = [];
  settings.hooks.PreToolUse.push({
    matcher: 'Write|Edit',
    command: `node ${hooksBase}/sunco-prompt-guard.cjs`
  });

  // UserPromptSubmit: SUNCO Mode auto-router (intercepts natural language input when mode active)
  if (!Array.isArray(settings.hooks.UserPromptSubmit)) settings.hooks.UserPromptSubmit = [];
  settings.hooks.UserPromptSubmit.push({
    matcher: '',
    command: `node ${hooksBase}/sunco-mode-router.cjs`
  });

  // --- StatusLine ---
  const statusLineCmd = `node ${hooksBase}/sunco-statusline.cjs`;
  settings.statusLine = {
    type: 'command',
    command: statusLineCmd,
    padding: 2
  };

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function unpatchSettings(targetDir) {
  const settingsPath = path.join(targetDir, 'settings.json');
  if (!fs.existsSync(settingsPath)) return;

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return;
  }

  // Remove ALL sunco hooks in any format (flat or nested) from all event types
  if (settings.hooks) {
    for (const eventType of Object.keys(settings.hooks)) {
      if (!Array.isArray(settings.hooks[eventType])) continue;
      settings.hooks[eventType] = settings.hooks[eventType].filter((h) => {
        if (h.command && h.command.includes('sunco-')) return false;
        if (Array.isArray(h.hooks) && h.hooks.some((inner) => inner.command && inner.command.includes('sunco-'))) return false;
        return true;
      });
    }
  }

  // Remove statusLine if it's ours
  if (
    settings.statusLine &&
    settings.statusLine.command &&
    settings.statusLine.command.includes('sunco-statusline')
  ) {
    delete settings.statusLine;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Count skills (*.md files) in commands/sunco
// ---------------------------------------------------------------------------
function countSkills(srcDir) {
  if (!fs.existsSync(srcDir)) return 0;
  try {
    return fs.readdirSync(srcDir).filter((f) => f.endsWith('.md')).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Korean description patching
// ---------------------------------------------------------------------------
const DESCRIPTIONS_KO = {
  'agents.md':         '에이전트 지시 파일(CLAUDE.md) 분석 — 효율성 점수',
  'assume.md':         '페이즈 실행 전 에이전트의 가정 사항을 미리 확인',
  'audit-uat.md':      '전체 페이즈의 UAT(사용자 수락 테스트) 현황 감사',
  'auto.md':           '전체 자율 파이프라인 — discuss→plan→execute→verify 자동 실행',
  'backlog.md':        '아이디어 주차장 — 현재 마일스톤 밖의 아이디어 관리',
  'context.md':        '현재 페이즈의 결정사항, 차단요소, 다음 행동 표시',
  'debug.md':          '체계적 디버깅 — 상태 저장으로 컨텍스트 초기화 후에도 재개 가능',
  'diagnose.md':       '빌드/테스트/린트 출력을 분석하여 구조화된 진단 결과 생성',
  'discuss.md':        '페이즈 계획 전 결정사항과 모호한 부분을 정리',
  'do.md':             '자연어 입력을 적절한 sunco 명령어로 자동 라우팅',
  'doc.md':            '코드베이스와 계획 산출물에서 문서 생성 (HWPX, Markdown 지원)',
  'execute.md':        '웨이브 기반 병렬 실행 — 린트 게이트와 영향 범위 분석 포함',
  'export.md':         '자체 완결형 HTML 프로젝트 리포트 생성',
  'fast.md':           '간단한 작업을 계획 없이 즉시 실행',
  'forensics.md':      '실패한 워크플로의 사후 분석 — git 이력과 산출물 조사',
  'graph.md':          '코드 의존성 그래프와 변경 영향 범위 분석',
  'guard.md':          '파일 변경 시 실시간 린트 + 규칙 승격',
  'headless.md':       'CI/CD용 헤드리스 모드 — JSON 출력과 종료 코드',
  'health.md':         '코드베이스 건강 점수 — 추세 추적 포함',
  'help.md':           'SUNCO 전체 명령어 목록과 사용 가이드',
  'init.md':           '프로젝트 하네스 초기화 — 스택 감지, 린트 규칙 생성',
  'lint.md':           '아키텍처 경계 검사 — 의존성 방향, 레이어 위반',
  'manager.md':        '인터랙티브 커맨드 센터 — 현재 상태, 진행률, 다음 행동',
  'map-codebase.md':   '4개 병렬 에이전트로 코드베이스 분석 (스택, 아키텍처, 관례, 우려사항)',
  'milestone.md':      '마일스톤 관리 — 감사, 완료, 생성, 격차 분석',
  'new.md':            '아이디어에서 로드맵까지 새 프로젝트 부트스트랩',
  'next.md':           'STATE.md 기반으로 다음 단계를 자동 감지하여 실행',
  'note.md':           '즉시 아이디어 캡처 — 메모 추가, 목록, todo로 승격',
  'pause.md':          '세션 상태 저장 — 나중에 이어서 작업할 수 있도록 핸드오프 생성',
  'phase.md':          'ROADMAP.md에서 페이즈 추가, 삽입, 삭제',
  'plan.md':           '페이즈를 검증된 실행 계획으로 변환 — BDD 수락 기준 포함',
  'pr-branch.md':      '.planning/ 커밋을 제외한 깨끗한 PR 브랜치 생성',
  'profile.md':        '모델 프로필 관리 — quality, balanced, budget, inherit',
  'progress.md':       '전체 프로젝트 진행 상황과 현재 페이즈 상태',
  'query.md':          '프로젝트 상태 즉시 조회 — JSON 출력 (LLM 불필요)',
  'quick.md':          'SUNCO 보장(원자적 커밋, 린트 게이트) 하에 빠른 작업 실행',
  'release.md':        '버전 업, 체인지로그, git 태그, npm 배포',
  'research.md':       '병렬 리서치 에이전트로 구현 방법 조사 — RESEARCH.md 생성',
  'resume.md':         '마지막 세션에서 컨텍스트 복원하여 작업 재개',
  'review.md':         '멀티 프로바이더 크로스 리뷰 — 다양한 AI로 코드 품질 검토',
  'scan.md':           '기존 코드베이스 분석 — 7개 구조화 문서 생성',
  'seed.md':           '트리거 조건이 있는 아이디어 심기 — 적절한 시점에 자동 표면화',
  'session-report.md': '세션 요약 생성 — 작업 내역, 결정사항, 결과, 다음 단계',
  'settings.md':       'TOML 설정 보기 및 관리',
  'ship.md':           '검증 후 PR 생성 — 실행 요약에서 PR 본문 자동 생성',
  'stats.md':          '프로젝트 통계 — 페이즈, 계획, 요구사항, git 지표',
  'status.md':         '현재 프로젝트 상태, 페이즈, 진행률 표시',
  'test-gen.md':       'BDD 수락 기준에서 단위/E2E 테스트 자동 생성',
  'thread.md':         '영구 컨텍스트 스레드 — 세션 간 작업 맥락 유지',
  'todo.md':           '작업 추가, 목록, 완료 — .sun/todos.md에 경량 추적',
  'ui-phase.md':       'UI 설계 계약서(UI-SPEC.md) 생성 — 레이아웃, 컴포넌트, 상호작용',
  'ui-review.md':      '6축 시각 UI 감사 — 각 축 0-10 점수와 구체적 발견사항',
  'update.md':         'SUNCO 최신 버전으로 업데이트 — 변경사항 미리보기',
  'validate.md':       '테스트 커버리지 감사 및 구조화 보고서 생성',
  'verify.md':         '6계층 스위스 치즈 검증 — 각 계층이 다른 실패 유형 포착',
  'workspaces.md':     'git worktree로 격리된 워크스페이스 관리',
  'workstreams.md':    '병렬 워크스트림 관리 — 분기 생성, 전환, 병합',
  'mode.md':           'SUNCO 모드 ON — 모든 입력을 최적 스킬로 자동 라우팅. 슈퍼 사이어인.',
};

function patchDescriptions(commandsDir, descriptions) {
  if (!fs.existsSync(commandsDir)) return;
  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const koDesc = descriptions[file];
    if (!koDesc) continue;
    const filePath = path.join(commandsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace the description line in YAML frontmatter
    content = content.replace(
      /^(description:\s*).+$/m,
      `$1${koDesc}`
    );
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

// ---------------------------------------------------------------------------
// Runtime config map
// ---------------------------------------------------------------------------
const RUNTIMES = {
  claude:      { name: 'Claude Code',  dir: '.claude',      nameKo: 'Claude Code' },
  codex:       { name: 'Codex CLI',    dir: '.codex',       nameKo: 'Codex CLI' },
  cursor:      { name: 'Cursor',       dir: '.cursor',      nameKo: 'Cursor' },
  antigravity: { name: 'Antigravity',  dir: '.antigravity', nameKo: 'Antigravity' },
};

// ---------------------------------------------------------------------------
// UI messages (bilingual)
// ---------------------------------------------------------------------------
const MSG = {
  en: {
    selectLang:    '  Select language:',
    selectRuntime: '  Select runtimes to install (comma-separated, default: 1):',
    installing:    'Installing',
    done:          'Done!',
    runHelp:       'Run /sunco:help to get started.',
    commands:      'commands/sunco',
    engine:        'sunco engine',
    hooks:         'hooks',
    docs:          'docs',
    skills:        'skills',
    files:         'files',
  },
  ko: {
    selectLang:    '  언어를 선택하세요:',
    selectRuntime: '  설치할 런타임을 선택하세요 (쉼표로 구분, 기본: 1):',
    installing:    '설치 중',
    done:          '완료!',
    runHelp:       '/sunco:help를 실행하여 시작하세요.',
    commands:      '명령어',
    engine:        '엔진',
    hooks:         '훅',
    docs:          '문서',
    skills:        '개 스킬',
    files:         '개 파일',
  },
};

// ---------------------------------------------------------------------------
// Codex SKILL.md generation (P1-1)
//
// Codex uses skills/<name>/SKILL.md instead of commands/<name>.md.
// We read each Claude command .md, extract frontmatter, and generate
// a Codex-compatible SKILL.md with adapter blocks.
// ---------------------------------------------------------------------------
function generateCodexSkills(srcCommands, targetDirOrOpts, runtimeDir) {
  // Accept either targetDir string or { skillsDir } options
  const skillsRoot = (typeof targetDirOrOpts === 'string')
    ? path.join(targetDirOrOpts, 'skills')
    : targetDirOrOpts.skillsDir;
  if (!fs.existsSync(srcCommands)) return 0;
  const pkgRoot = path.join(__dirname, '..');
  const adapterHeader = path.join(pkgRoot, 'templates', 'codex-skill-adapter-header.md');
  let adapterContent = '';
  try { adapterContent = fs.readFileSync(adapterHeader, 'utf8'); } catch { /* no adapter template */ }

  const files = fs.readdirSync(srcCommands).filter((f) => f.endsWith('.md'));
  let count = 0;

  for (const file of files) {
    const cmdPath = path.join(srcCommands, file);
    const content = fs.readFileSync(cmdPath, 'utf8');

    // Extract frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];

    // Parse name and description from YAML frontmatter
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    const descMatch = fm.match(/^description:\s*(.+)$/m);
    if (!nameMatch) continue;

    const cmdName = nameMatch[1].trim();  // e.g., sunco:status
    // Strip surrounding quotes from description if present (YAML may have "..." already)
    let description = descMatch ? descMatch[1].trim() : cmdName;
    if (description.startsWith('"') && description.endsWith('"')) {
      description = description.slice(1, -1);
    }
    const skillName = cmdName.replace(':', '-');  // e.g., sunco-status

    // Extract sections after frontmatter
    const body = content.slice(fmMatch[0].length).trim();

    // Build SKILL.md
    const skillContent = [
      '---',
      `name: "${skillName}"`,
      `description: "${description}"`,
      'metadata:',
      `  short-description: "${description}"`,
      '---',
      '',
      adapterContent.replace(/\{\{SKILL_NAME\}\}/g, skillName),
      '',
      body,
    ].join('\n');

    // Apply runtime path replacement
    const finalContent = replaceRuntimePaths(skillContent, runtimeDir);

    // Write to <skillsRoot>/<skillName>/SKILL.md
    const skillDir = path.join(skillsRoot, skillName);
    ensureDir(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), finalContent, 'utf8');
    count++;
  }

  return count;
}

// ---------------------------------------------------------------------------
// Runtime Contract (P0-1)
//
// Each runtime installs SUNCO into:
//   $HOME/.<runtime>/
//     commands/sunco/       ← slash commands (*.md)
//     sunco/
//       bin/                ← engine (cli.js + chunks), sunco-tools.cjs, package.json
//       agents/             ← agent prompt files (*.md)
//       workflows/          ← workflow files (*.md)
//       references/         ← reference docs (*.md)
//       templates/          ← template files (*.md)
//       VERSION             ← installed version
//     hooks/                ← hook scripts (*.cjs)
//
// Source files use $HOME/.claude/ as the canonical path. For non-Claude
// runtimes, paths are replaced at install time (P0-4).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Install (single runtime directory)
// ---------------------------------------------------------------------------
function install(targetDir, runtimeDir) {
  const pkgRoot = path.join(__dirname, '..');

  // Source paths (relative to the npm package root)
  const srcCommands   = path.join(pkgRoot, 'commands', 'sunco');
  const srcEngine     = path.join(pkgRoot, 'dist');
  const srcBin        = path.join(pkgRoot, 'bin');
  const srcHooks      = path.join(pkgRoot, 'hooks');
  const srcAgents     = path.join(pkgRoot, 'agents');
  const srcWorkflows  = path.join(pkgRoot, 'workflows');
  const srcReferences = path.join(pkgRoot, 'references');
  const srcTemplates  = path.join(pkgRoot, 'templates');

  // Destination paths
  const destCommands   = path.join(targetDir, 'commands', 'sunco');
  const destEngine     = path.join(targetDir, 'sunco', 'bin');
  const destHooks      = path.join(targetDir, 'hooks');
  const destAgents     = path.join(targetDir, 'sunco', 'agents');
  const destWorkflows  = path.join(targetDir, 'sunco', 'workflows');
  const destReferences = path.join(targetDir, 'sunco', 'references');
  const destTemplates  = path.join(targetDir, 'sunco', 'templates');

  const skillCount = countSkills(srcCommands);

  // Clean previous install artifacts to prevent stale files from prior installs
  // (e.g., Codex used to get commands/sunco/ but now gets skills/sunco-*)
  removeDirIfExists(path.join(targetDir, 'commands', 'sunco'));
  removeDirIfExists(path.join(targetDir, 'sunco'));
  // Clean runtime-specific skill dirs from prior installs
  if (runtimeDir === '.codex') {
    removeDirIfExists(path.join(targetDir, 'skills'));
  } else if (runtimeDir === '.cursor') {
    // Cursor skills are in skills-cursor/sunco-*/
    const cursorSkillsDir = path.join(targetDir, 'skills-cursor');
    if (fs.existsSync(cursorSkillsDir)) {
      const entries = fs.readdirSync(cursorSkillsDir).filter(d => d.startsWith('sunco-'));
      for (const d of entries) removeDirIfExists(path.join(cursorSkillsDir, d));
    }
  }

  // Copy commands:
  //   - Claude: commands/sunco/*.md (slash commands)
  //   - Codex: skills/sunco-*/SKILL.md (Codex skill adapter format)
  //   - Others: commands/sunco/*.md (same as Claude for now)
  let cmdCopied = 0;
  let codexSkillsCopied = 0;
  if (runtimeDir === '.codex') {
    // Codex: generate SKILL.md adapters in skills/sunco-*/
    codexSkillsCopied = generateCodexSkills(srcCommands, targetDir, runtimeDir);
    cmdCopied = codexSkillsCopied;
  } else if (runtimeDir === '.cursor') {
    // Cursor: uses skills-cursor/<name>/SKILL.md format (same as Codex SKILL.md)
    const cursorSkillsDir = path.join(targetDir, 'skills-cursor');
    codexSkillsCopied = generateCodexSkills(srcCommands, { skillsDir: cursorSkillsDir }, runtimeDir);
    cmdCopied = codexSkillsCopied;
  } else {
    cmdCopied = copyDirWithReplacement(srcCommands, destCommands, runtimeDir);
  }

  // Copy engine (dist/ -> {target}/sunco/bin/) — binary files, no path replacement
  const engCopied = copyDirRecursive(srcEngine, destEngine);

  // P0-3: Copy sunco-tools.cjs (critical: 168+ workflow callsites depend on this)
  const srcTools = path.join(srcBin, 'sunco-tools.cjs');
  if (fs.existsSync(srcTools)) {
    ensureDir(destEngine);
    copyFileWithReplacement(srcTools, path.join(destEngine, 'sunco-tools.cjs'), runtimeDir);
  }

  // P0-2: Write minimal package.json for ESM resolution (cli.js uses ESM imports)
  const runtimePkg = JSON.stringify({ type: 'module' }, null, 2) + '\n';
  ensureDir(destEngine);
  fs.writeFileSync(path.join(destEngine, 'package.json'), runtimePkg, 'utf8');

  // Write VERSION file alongside engine + just-upgraded marker
  const version = readVersion();
  ensureDir(path.join(targetDir, 'sunco'));
  const versionPath = path.join(targetDir, 'sunco', 'VERSION');
  let oldVersion = null;
  try { oldVersion = fs.readFileSync(versionPath, 'utf8').trim(); } catch { /* first install */ }
  fs.writeFileSync(versionPath, version + '\n', 'utf8');
  if (oldVersion && oldVersion !== version) {
    const stateDir = path.join(os.homedir(), '.sun');
    ensureDir(stateDir);
    fs.writeFileSync(path.join(stateDir, 'just-upgraded-from'), oldVersion, 'utf8');
  }

  // Copy hooks (.cjs files — with path replacement for runtime-aware hook paths)
  let hooksCopied = 0;
  if (fs.existsSync(srcHooks)) {
    ensureDir(destHooks);
    const entries = fs.readdirSync(srcHooks, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.cjs')) continue;
      copyFileWithReplacement(
        path.join(srcHooks, entry.name),
        path.join(destHooks, entry.name),
        runtimeDir
      );
      hooksCopied++;
    }
  }

  // Copy workflows, agents, references, templates (all with path replacement)
  const agCopied  = copyDirWithReplacement(srcAgents, destAgents, runtimeDir);
  const wfCopied  = copyDirWithReplacement(srcWorkflows, destWorkflows, runtimeDir);
  const refCopied = copyDirWithReplacement(srcReferences, destReferences, runtimeDir);
  const tplCopied = copyDirWithReplacement(srcTemplates, destTemplates, runtimeDir);

  // Runtime-specific registration
  if (runtimeDir === '.claude') {
    // Claude Code: patch settings.json for hooks + statusLine
    patchSettings(targetDir, runtimeDir);
  } else if (runtimeDir === '.codex') {
    // Codex: agents are registered via skills/SKILL.md (done in generateCodexSkills)
    // No config.toml wiring needed — Codex discovers skills/ directory automatically
  } else if (runtimeDir === '.cursor') {
    // Cursor: SKILL.md files installed to skills-cursor/sunco-*/
    // Cursor may auto-discover these, or user can register via Cursor's create-skill
  } else if (runtimeDir === '.antigravity') {
    // Antigravity: commands/sunco/*.md format (same as Claude, with .antigravity paths)
    // Registration mechanism TBD — for now, copy assets with correct paths
  }

  return { cmdCopied, engCopied, hooksCopied, agCopied, wfCopied, refCopied, tplCopied, skillCount, version, destCommands };
}

// ---------------------------------------------------------------------------
// Uninstall (single runtime directory)
// ---------------------------------------------------------------------------
function uninstall(targetDir) {
  const removed = [];

  const toRemove = [
    path.join(targetDir, 'commands', 'sunco'),
    path.join(targetDir, 'sunco'),
  ];

  for (const p of toRemove) {
    if (removeDirIfExists(p)) removed.push(p);
  }

  // Remove SUNCO hooks
  const hooksDir = path.join(targetDir, 'hooks');
  if (fs.existsSync(hooksDir)) {
    for (const f of fs.readdirSync(hooksDir)) {
      if (f.startsWith('sunco-')) {
        fs.rmSync(path.join(hooksDir, f), { force: true });
        removed.push(path.join(hooksDir, f));
      }
    }
  }

  unpatchSettings(targetDir);

  return removed;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    global:    false,
    local:     false,
    uninstall: false,
    help:      false,
    lang:      null,    // 'en' | 'ko' | null
    runtime:   null,    // comma-separated string or null
  };

  const runtimePicks = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--global'       || a === '-g') flags.global    = true;
    if (a === '--local'        || a === '-l') flags.local     = true;
    if (a === '--uninstall'    || a === '-u') flags.uninstall = true;
    if (a === '--help'         || a === '-h') flags.help      = true;
    // GSD-style runtime flags
    if (a === '--claude')       runtimePicks.push('claude');
    if (a === '--codex')        runtimePicks.push('codex');
    if (a === '--cursor')       runtimePicks.push('cursor');
    if (a === '--antigravity')  runtimePicks.push('antigravity');
    if (a === '--all')          runtimePicks.push('claude', 'codex', 'cursor', 'antigravity');
    if (a === '--lang' && args[i + 1]) {
      flags.lang = args[++i].toLowerCase();
    }
    if (a === '--runtime' && args[i + 1]) {
      flags.runtime = args[++i].toLowerCase();
    }
  }

  // Merge --claude/--codex/--all into flags.runtime
  if (runtimePicks.length > 0 && !flags.runtime) {
    flags.runtime = [...new Set(runtimePicks)].join(',');
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Detect non-interactive mode
// Non-interactive when ANY of the legacy flags are present OR when stdin is
// not a TTY (piped / CI environment).
// ---------------------------------------------------------------------------
function isNonInteractive(flags) {
  return (
    flags.global    ||
    flags.local     ||
    flags.uninstall ||
    flags.help      ||
    flags.lang  !== null ||
    flags.runtime !== null ||
    !process.stdin.isTTY
  );
}

// ---------------------------------------------------------------------------
// Resolve runtime keys from a comma-separated selection string
// e.g. "1,3" -> ['claude', 'cursor']
// ---------------------------------------------------------------------------
const RUNTIME_KEYS = Object.keys(RUNTIMES); // order matters for menu

function resolveRuntimeKeys(selectionStr) {
  if (!selectionStr || selectionStr.trim() === '') {
    // Default: Claude Code only
    return ['claude'];
  }

  // Allow named keys directly (for --runtime flag)
  const byName = selectionStr.split(',').map((s) => s.trim()).filter(Boolean);
  const namedMatch = byName.every((k) => RUNTIME_KEYS.includes(k));
  if (namedMatch) return byName;

  // Otherwise treat as numbered selection
  const numbers = selectionStr.split(',').map((s) => parseInt(s.trim(), 10));
  const keys = [];
  for (const n of numbers) {
    const key = RUNTIME_KEYS[n - 1];
    if (key) keys.push(key);
  }
  return keys.length > 0 ? keys : ['claude'];
}

// ---------------------------------------------------------------------------
// Interactive prompts (GSD-style: readline.question, numbered choices)
// ---------------------------------------------------------------------------

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function runInteractivePrompts() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let answered = false;
  rl.on('close', () => { if (!answered) process.exit(0); });

  // --- Language ---
  console.log(`  ${BOLD}Select language / 언어를 선택하세요${RESET}\n`);
  console.log(`  ${EMERALD}1${RESET}) English`);
  console.log(`  ${EMERALD}2${RESET}) 한국어\n`);
  const langAnswer = await ask(rl, `  Choice ${DIM}[1]${RESET}: `);
  const lang = langAnswer.trim() === '2' ? 'ko' : 'en';

  // --- Runtimes ---
  const rtTitle = lang === 'ko'
    ? '설치할 런타임을 선택하세요'
    : 'Which runtime(s) to install?';
  const selectMultiple = lang === 'ko'
    ? '복수 선택: 1,2,3 또는 5 (전체)'
    : 'Select multiple: 1,2,3 or 5 (all)';

  console.log(`\n  ${BOLD}${rtTitle}${RESET}\n`);
  console.log(`  ${EMERALD}1${RESET}) Claude Code   ${DIM}(~/.claude/)${RESET}`);
  console.log(`  ${EMERALD}2${RESET}) Codex CLI     ${DIM}(~/.codex/)${RESET}`);
  console.log(`  ${EMERALD}3${RESET}) Cursor        ${DIM}(~/.cursor/)${RESET}`);
  console.log(`  ${EMERALD}4${RESET}) Antigravity   ${DIM}(~/.antigravity/)${RESET}`);
  console.log(`  ${EMERALD}5${RESET}) All\n`);
  console.log(`  ${DIM}${selectMultiple}${RESET}\n`);
  const rtAnswer = await ask(rl, `  Choice ${DIM}[1]${RESET}: `);

  answered = true;
  rl.close();

  const input = rtAnswer.trim() || '1';
  let runtimeKeys;
  if (input === '5') {
    runtimeKeys = [...RUNTIME_KEYS];
  } else {
    const nums = input.split(/[\s,]+/).map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 4);
    runtimeKeys = nums.map(n => RUNTIME_KEYS[n - 1]).filter(Boolean);
  }
  if (runtimeKeys.length === 0) runtimeKeys = ['claude'];

  return { lang, runtimeKeys };
}

// ---------------------------------------------------------------------------
// Show help
// ---------------------------------------------------------------------------
function showHelp(version) {
  console.log(getLogo());
  console.log(`  ${BOLD}SUNCO v${version}${RESET}`);
  console.log(`  ${DIM}Agent Workspace OS — harness engineering for AI agents${RESET}\n`);
  console.log(`  ${BOLD}Usage:${RESET}`);
  console.log(`    npx popcoru [options]\n`);
  console.log(`  ${BOLD}Options:${RESET}`);
  console.log(`    ${EMERALD}--global${RESET}, -g            Install to ~/.claude/  ${DIM}(default, non-interactive)${RESET}`);
  console.log(`    ${EMERALD}--local${RESET},  -l            Install to ./.claude/`);
  console.log(`    ${EMERALD}--uninstall${RESET}, -u         Remove SUNCO files`);
  console.log(`    ${EMERALD}--lang${RESET} <en|ko>          Set language (skips prompt)`);
  console.log(`    ${EMERALD}--claude${RESET}                Install for Claude Code`);
  console.log(`    ${EMERALD}--codex${RESET}                 Install for Codex CLI`);
  console.log(`    ${EMERALD}--cursor${RESET}                Install for Cursor`);
  console.log(`    ${EMERALD}--antigravity${RESET}           Install for Antigravity`);
  console.log(`    ${EMERALD}--all${RESET}                   Install for all runtimes`);
  console.log(`    ${EMERALD}--runtime${RESET} <keys>        Comma-separated ${DIM}(claude,codex,cursor,antigravity)${RESET}`);
  console.log(`    ${EMERALD}--help${RESET},    -h           Show this help\n`);
  console.log(`  ${BOLD}Examples:${RESET}`);
  console.log(`    npx popcoru                  ${DIM}# interactive (language + runtime prompts)${RESET}`);
  console.log(`    npx popcoru --all            ${DIM}# install for all runtimes${RESET}`);
  console.log(`    npx popcoru --claude --codex ${DIM}# Claude Code + Codex${RESET}`);
  console.log(`    npx popcoru --lang ko --all  ${DIM}# all runtimes, Korean descriptions${RESET}\n`);
}

// ---------------------------------------------------------------------------
// Print install results for one runtime
// ---------------------------------------------------------------------------
function printInstallResult(r, runtimeName, lang) {
  const msg = MSG[lang];
  const skillLabel = r.skillCount > 0
    ? `(${r.skillCount} ${msg.skills})`
    : `(${r.cmdCopied} ${msg.files})`;
  const docCount = (r.agCopied || 0) + r.wfCopied + r.refCopied + r.tplCopied;

  console.log(`  ${GREEN}✓${RESET} ${runtimeName}: ${BOLD}${msg.commands}${RESET} ${DIM}${skillLabel}${RESET}`);
  console.log(`  ${GREEN}✓${RESET} ${runtimeName}: ${BOLD}${msg.engine}${RESET}  ${DIM}(${r.engCopied} ${msg.files})${RESET}`);
  console.log(`  ${GREEN}✓${RESET} ${runtimeName}: ${BOLD}${msg.hooks}${RESET}   ${DIM}(${r.hooksCopied} ${msg.files})${RESET}`);
  if (docCount > 0) {
    console.log(`  ${GREEN}✓${RESET} ${runtimeName}: ${BOLD}${msg.docs}${RESET}    ${DIM}(${docCount} ${msg.files})${RESET}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const version = readVersion();
  const flags   = parseArgs(process.argv);

  if (flags.help) {
    showHelp(version);
    process.exit(0);
  }

  console.log(getLogo());
  console.log(`  ${BOLD}SUNCO v${version}${RESET}`);
  console.log(`  ${DIM}Agent Workspace OS — harness engineering for AI agents${RESET}\n`);

  // ---- UNINSTALL (P0-9: multi-runtime) ------------------------------------
  if (flags.uninstall) {
    // Determine which runtimes to uninstall
    const uninstallKeys = flags.runtime
      ? resolveRuntimeKeys(flags.runtime)
      : Object.keys(RUNTIMES); // default: uninstall ALL runtimes

    const base = flags.local ? process.cwd() : os.homedir();
    let totalRemoved = 0;

    for (const key of uninstallKeys) {
      const runtime = RUNTIMES[key];
      if (!runtime) continue;
      const targetDir = path.join(base, runtime.dir);

      // Skip if runtime dir doesn't exist or has no sunco artifacts
      if (!fs.existsSync(path.join(targetDir, 'sunco')) &&
          !fs.existsSync(path.join(targetDir, 'commands', 'sunco'))) {
        continue;
      }

      console.log(`  Uninstalling from ${DIM}${runtime.name}${RESET} (${DIM}~/${runtime.dir}/${RESET}) ...\n`);

      try {
        const removed = uninstall(targetDir);
        if (removed.length > 0) {
          for (const p of removed) {
            console.log(`  ${GREEN}✓${RESET} Removed ${DIM}${path.relative(targetDir, p)}${RESET}`);
          }
          totalRemoved += removed.length;
          console.log('');
        }
      } catch (err) {
        console.error(`  Error uninstalling from ${runtime.name}: ${err.message}\n`);
      }
    }

    if (totalRemoved === 0) {
      console.log(`  ${DIM}Nothing to uninstall.${RESET}\n`);
    } else {
      console.log(`  Done! SUNCO has been uninstalled from ${uninstallKeys.length} runtime(s).\n`);
    }
    return;
  }

  // ---- Determine lang + runtimeKeys ----------------------------------------
  let lang;
  let runtimeKeys;

  if (isNonInteractive(flags)) {
    // Non-interactive: use flags or apply defaults
    lang        = (flags.lang === 'ko') ? 'ko' : 'en';
    runtimeKeys = flags.runtime
      ? resolveRuntimeKeys(flags.runtime)
      : ['claude'];

    // Legacy --local flag: override runtimeKeys to use cwd-relative .claude
    if (flags.local) {
      // handled below via targetDir override
    }
  } else {
    // Interactive mode
    try {
      const result = await runInteractivePrompts();
      lang        = result.lang;
      runtimeKeys = result.runtimeKeys;
      console.log('');
    } catch (err) {
      console.error(`\n  Prompt error: ${err.message}\n`);
      process.exit(1);
    }
  }

  const msg = MSG[lang];

  // ---- INSTALL -------------------------------------------------------------
  const errors = [];
  for (const key of runtimeKeys) {
    const runtime = RUNTIMES[key];
    if (!runtime) continue;
    const base = flags.local ? process.cwd() : os.homedir();
    const targetDir = path.join(base, runtime.dir);
    const displayName = lang === 'ko' ? runtime.nameKo : runtime.name;
    const displayPath = flags.local ? `./${runtime.dir}/` : `~/${runtime.dir}/`;

    console.log(`  ${msg.installing} ${BOLD}${displayName}${RESET} (${DIM}${displayPath}${RESET}) ...\n`);

    try {
      const r = install(targetDir, runtime.dir);
      if (lang === 'ko') patchDescriptions(r.destCommands, DESCRIPTIONS_KO);
      printInstallResult(r, displayName, lang);
      console.log('');
    } catch (err) {
      console.error(`  ${BOLD}Error installing to ${displayName}:${RESET} ${err.message}\n`);
      if (process.env.DEBUG) console.error(err.stack);
      errors.push({ runtime: displayName, err });
    }
  }

  if (errors.length === 0) {
    console.log(`  ${GREEN}${msg.done}${RESET} ${EMERALD}/sunco:help${RESET} — ${msg.runHelp}\n`);
  } else if (errors.length < runtimeKeys.length) {
    console.log(`  ${GREEN}${msg.done}${RESET} (partial — ${errors.length} runtime(s) failed)\n`);
    process.exit(1);
  } else {
    console.log(`  Install failed for all selected runtimes.\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n  Fatal error: ${err.message}\n`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
