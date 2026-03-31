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
function patchSettings(targetDir) {
  const settingsPath = path.join(targetDir, 'settings.json');
  let settings = {};

  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      // If parse fails, start fresh (don't nuke existing file on error though)
      settings = {};
    }
  }

  // Ensure hooks structure exists
  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.SessionStart)) settings.hooks.SessionStart = [];

  const hookEntry = {
    matcher: '',
    command: 'node $HOME/.claude/hooks/sunco-check-update.cjs'
  };

  // Only add if not already present (check both .js and .cjs variants for idempotency)
  const alreadyPresent = settings.hooks.SessionStart.some(
    (h) =>
      h.command === hookEntry.command ||
      h.command === 'node $HOME/.claude/hooks/sunco-check-update.js'
  );

  if (!alreadyPresent) {
    settings.hooks.SessionStart.push(hookEntry);
  }

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

  if (!settings.hooks || !settings.hooks.SessionStart) return;

  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
    (h) =>
      h.command !== 'node $HOME/.claude/hooks/sunco-check-update.cjs' &&
      h.command !== 'node $HOME/.claude/hooks/sunco-check-update.js'
  );

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
// Install (single runtime directory)
// ---------------------------------------------------------------------------
function install(targetDir) {
  const pkgRoot = path.join(__dirname, '..');

  // Source paths (relative to the npm package root)
  const srcCommands   = path.join(pkgRoot, 'commands', 'sunco');
  const srcEngine     = path.join(pkgRoot, 'dist');
  const srcHooks      = path.join(pkgRoot, 'hooks');
  const srcWorkflows  = path.join(pkgRoot, 'workflows');
  const srcReferences = path.join(pkgRoot, 'references');
  const srcTemplates  = path.join(pkgRoot, 'templates');

  // Destination paths
  const destCommands   = path.join(targetDir, 'commands', 'sunco');
  const destEngine     = path.join(targetDir, 'sunco', 'bin');
  const destHooks      = path.join(targetDir, 'hooks');
  const destWorkflows  = path.join(targetDir, 'sunco', 'workflows');
  const destReferences = path.join(targetDir, 'sunco', 'references');
  const destTemplates  = path.join(targetDir, 'sunco', 'templates');

  const skillCount = countSkills(srcCommands);

  // Copy commands
  const cmdCopied = copyDirRecursive(srcCommands, destCommands);

  // Copy engine (dist/ -> {target}/sunco/bin/)
  const engCopied = copyDirRecursive(srcEngine, destEngine);

  // Write VERSION file alongside engine + just-upgraded marker
  const version = readVersion();
  ensureDir(path.join(targetDir, 'sunco'));
  const versionPath = path.join(targetDir, 'sunco', 'VERSION');
  // Read old version before overwriting (for just-upgraded notification)
  let oldVersion = null;
  try { oldVersion = fs.readFileSync(versionPath, 'utf8').trim(); } catch { /* first install */ }
  fs.writeFileSync(versionPath, version + '\n', 'utf8');
  // Write just-upgraded marker if version changed
  if (oldVersion && oldVersion !== version) {
    const stateDir = path.join(os.homedir(), '.sunco');
    ensureDir(stateDir);
    fs.writeFileSync(path.join(stateDir, 'just-upgraded-from'), oldVersion, 'utf8');
  }

  // Copy hooks (.cjs files — CJS format required to run standalone outside ESM package)
  const hooksCopied = copyGlob(srcHooks, '*.cjs', destHooks);

  // Copy workflows, references, templates
  const wfCopied  = copyDirRecursive(srcWorkflows, destWorkflows);
  const refCopied = copyDirRecursive(srcReferences, destReferences);
  const tplCopied = copyDirRecursive(srcTemplates, destTemplates);

  // Patch settings.json (only for Claude Code — settings.json is Claude-specific)
  const runtimeDirName = path.basename(targetDir);
  if (runtimeDirName === '.claude') {
    patchSettings(targetDir);
  }

  return { cmdCopied, engCopied, hooksCopied, wfCopied, refCopied, tplCopied, skillCount, version, destCommands };
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
// Interactive TUI selectors (arrow keys, zero deps)
// Uses \x1b7 (save cursor) / \x1b8 (restore cursor) for flicker-free redraw.
// ---------------------------------------------------------------------------

const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const SAVE_POS    = '\x1b7';
const RESTORE_POS = '\x1b8';
const CLEAR_BELOW = '\x1b[J';

/**
 * Single-select: arrow keys to move, enter to confirm.
 */
function singleSelect(title, options) {
  return new Promise((resolve) => {
    let cursor = 0;
    const { stdin, stdout } = process;

    function render() {
      stdout.write(RESTORE_POS + CLEAR_BELOW);
      stdout.write(`  ${BOLD}${title}${RESET}\n\n`);
      for (let i = 0; i < options.length; i++) {
        const active = i === cursor;
        const arrow = active ? `${EMERALD}\u276F${RESET}` : ' ';
        const dot   = active ? `${EMERALD}\u25CF${RESET}` : `${DIM}\u25CB${RESET}`;
        const label = active ? `${BOLD}${options[i]}${RESET}` : `${DIM}${options[i]}${RESET}`;
        stdout.write(`  ${arrow} ${dot} ${label}\n`);
      }
      stdout.write(`\n  ${DIM}\u2191\u2193 move \u00B7 enter select${RESET}\n`);
    }

    stdout.write(HIDE_CURSOR + SAVE_POS);
    render();

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    function onKey(key) {
      if (key === '\x1b[A') { cursor = (cursor - 1 + options.length) % options.length; render(); }
      else if (key === '\x1b[B') { cursor = (cursor + 1) % options.length; render(); }
      else if (key === '\r' || key === '\n') { done(cursor); }
      else if (key === '\x03') { done(0, true); }
    }

    function done(val, exit) {
      stdin.removeListener('data', onKey);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write(SHOW_CURSOR);
      // Show final selection
      stdout.write(RESTORE_POS + CLEAR_BELOW);
      stdout.write(`  ${BOLD}${title}${RESET} ${EMERALD}${options[val]}${RESET}\n\n`);
      if (exit) process.exit(0);
      resolve(val);
    }

    stdin.on('data', onKey);
  });
}

/**
 * Multi-select: arrow keys move, space toggles, 'a' toggles all, enter confirms.
 * Last item is a "Confirm" button — pressing enter on it also confirms.
 */
function multiSelect(title, options) {
  return new Promise((resolve) => {
    let cursor = 0;
    const selected = new Set([0]); // Claude Code on by default
    const confirmIdx = options.length; // virtual confirm button index
    const totalItems = options.length + 1;
    const { stdin, stdout } = process;

    function render() {
      stdout.write(RESTORE_POS + CLEAR_BELOW);
      stdout.write(`  ${BOLD}${title}${RESET}\n\n`);
      for (let i = 0; i < options.length; i++) {
        const active = i === cursor;
        const checked = selected.has(i);
        const arrow = active ? `${EMERALD}\u276F${RESET}` : ' ';
        const box   = checked ? `${GREEN}[\u2713]${RESET}` : `${DIM}[ ]${RESET}`;
        const label = active ? `${BOLD}${options[i]}${RESET}` : options[i];
        stdout.write(`  ${arrow} ${box} ${label}\n`);
      }
      // Confirm button
      const onConfirm = cursor === confirmIdx;
      const count = selected.size;
      stdout.write('\n');
      if (onConfirm) {
        stdout.write(`  ${EMERALD}\u276F ${BOLD}[ Install ${count} runtime${count !== 1 ? 's' : ''} ]${RESET}\n`);
      } else {
        stdout.write(`    ${DIM}[ Install ${count} runtime${count !== 1 ? 's' : ''} ]${RESET}\n`);
      }
      stdout.write(`\n  ${DIM}\u2191\u2193 move \u00B7 space toggle \u00B7 a all \u00B7 enter confirm${RESET}\n`);
    }

    stdout.write(HIDE_CURSOR + SAVE_POS);
    render();

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    function onKey(key) {
      if (key === '\x1b[A') { cursor = (cursor - 1 + totalItems) % totalItems; render(); }
      else if (key === '\x1b[B') { cursor = (cursor + 1) % totalItems; render(); }
      else if (key === ' ') {
        if (cursor < options.length) {
          if (selected.has(cursor)) selected.delete(cursor); else selected.add(cursor);
          render();
        } else {
          confirm(); // space on confirm button
        }
      }
      else if (key === 'a' || key === 'A') {
        if (selected.size === options.length) selected.clear();
        else for (let i = 0; i < options.length; i++) selected.add(i);
        render();
      }
      else if (key === '\r' || key === '\n') { confirm(); }
      else if (key === '\x03') { exit(); }
    }

    function confirm() {
      stdin.removeListener('data', onKey);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write(SHOW_CURSOR);
      if (selected.size === 0) selected.add(0);
      // Show final selection
      stdout.write(RESTORE_POS + CLEAR_BELOW);
      const names = [...selected].sort().map(i => options[i].replace(/\x1b\[[^m]*m/g, '').trim()).join(', ');
      stdout.write(`  ${BOLD}${title}${RESET} ${EMERALD}${names}${RESET}\n\n`);
      resolve([...selected].sort());
    }

    function exit() {
      stdin.removeListener('data', onKey);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write(SHOW_CURSOR);
      process.exit(0);
    }

    stdin.on('data', onKey);
  });
}

async function runInteractivePrompts() {
  const langIdx = await singleSelect(
    'Select language / 언어를 선택하세요:',
    ['English', '한국어']
  );
  const lang = langIdx === 1 ? 'ko' : 'en';

  const runtimeLabels = [
    'Claude Code   (~/.claude/)',
    'Codex CLI     (~/.codex/)',
    'Cursor        (~/.cursor/)',
    'Antigravity   (~/.antigravity/)',
  ];
  const selectedIndices = await multiSelect(
    lang === 'ko' ? '설치할 런타임을 선택하세요:' : 'Select runtimes to install:',
    runtimeLabels
  );

  const runtimeKeys = selectedIndices.map((i) => RUNTIME_KEYS[i]).filter(Boolean);
  return { lang, runtimeKeys: runtimeKeys.length > 0 ? runtimeKeys : ['claude'] };
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
  const docCount = r.wfCopied + r.refCopied + r.tplCopied;

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

  // ---- UNINSTALL -----------------------------------------------------------
  if (flags.uninstall) {
    const targetDir = flags.local
      ? path.join(process.cwd(), '.claude')
      : path.join(os.homedir(), '.claude');

    console.log(`  Uninstalling from ${DIM}${targetDir}${RESET} ...\n`);

    try {
      const removed = uninstall(targetDir);
      if (removed.length === 0) {
        console.log(`  ${DIM}Nothing to uninstall.${RESET}\n`);
      } else {
        for (const p of removed) {
          console.log(`  ${GREEN}✓${RESET} Removed ${DIM}${path.relative(targetDir, p)}${RESET}`);
        }
        console.log(`\n  Done! SUNCO has been uninstalled.\n`);
      }
    } catch (err) {
      console.error(`\n  Error during uninstall: ${err.message}\n`);
      process.exit(1);
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
      const r = install(targetDir);
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
