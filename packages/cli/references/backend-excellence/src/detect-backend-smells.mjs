#!/usr/bin/env node

// SUNCO Backend Smell Detector — Phase 43/M3.2
//
// 7 high-confidence deterministic rules (spec-locked, §13 out-of-scope for expansion).
// No LLM, no heuristic rules, no framework auto-wiring. Standalone CLI.
//
// Clean-room authorship: no port from ESLint plugins, SonarQube, or Semgrep. Rule IDs,
// messages, fixtures, and implementation are SUNCO-original. AST walk is standard estree
// traversal (non-copyrightable public CS knowledge). See backend-excellence/NOTICE.md.
//
// Usage:
//   node detect-backend-smells.mjs <target-dir> [--json]
//   node detect-backend-smells.mjs --test
//
// Exit codes:
//   0 = clean scan (no findings) / --test all pass
//   1 = --test had failures, or runtime error (unusable args, unreadable target)
//   2 = findings present in a scan
//
// Output schema (--json):
//   { findings: [{rule, severity, kind:"deterministic", file, line, column, match, fix_hint}],
//     meta: {files_scanned, duration_ms, rules_enabled, detector_version:"1.0.0"} }

import { readFileSync, statSync, readdirSync, existsSync, accessSync, constants as fsConstants } from 'node:fs';
import { resolve, join, relative, extname, basename, dirname, sep as pathSep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { parse as parseEstree, AST_NODE_TYPES as T } from '@typescript-eslint/typescript-estree';

// ─── Constants ──────────────────────────────────────────────────────────────

const DETECTOR_VERSION = '1.0.0';

const RULES_ENABLED = Object.freeze([
  'raw-sql-interpolation',
  'missing-timeout',
  'swallowed-catch',
  'any-typed-body',
  'missing-validation-public-route',
  'non-reversible-migration',
  'logged-secret',
]);

const SCANNED_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SQL_EXTS = new Set(['.sql']);

// Always skip these directories during recursion. Universal CI/build/VCS set.
// Project-specific exclusions (e.g., SUNCO's .planning/, vendored references/) are
// left to caller to exclude via target selection — the detector stays content-neutral.
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.turbo', '.cache', 'coverage', '.nuxt', 'out',
]);

// Auth-prefix regex — routes matching this are exempt from missing-validation check.
// Conservative default; user-configurable via --auth-prefix in a future version (v1 = fixed).
const AUTH_PREFIX_RE = /^\/(api\/)?(auth|login|signup|signin|logout|oauth)\b/i;

// Validator library call markers — presence of any of these in handler body treats
// the handler as validated. Pattern matches MemberExpression property name against a
// known set. Generic enough to catch wrappers without over-matching.
const VALIDATOR_METHODS = new Set([
  // zod
  'parse', 'safeParse',
  // joi / yup (shared)
  'validate', 'validateSync', 'validateAsync', 'assert',
  // ajv
  'compile', // ajv.compile(schema)(data) — presence of compile in handler is evidence
  // class-validator
  'validateOrReject', 'plainToInstance', 'plainToClass',
]);

// SQL keyword regex for raw-sql-interpolation
const SQL_KW_RE = /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|JOIN|UNION|DROP|ALTER|CREATE)\b/i;

// Secret key regex for logged-secret
const SECRET_KEY_RE = /^(authorization|api[_-]?key|password|token|secret|credential|client[_-]?secret|access[_-]?token|refresh[_-]?token|private[_-]?key|cookie)$/i;

// Logger method names (matched as MemberExpression.property.name OR callee Identifier)
const LOGGER_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug', 'trace', 'fatal']);

// HTTP client callees whose options arg must carry timeout/signal evidence
const TIMEOUT_REQUIRED_CALLEES = Object.freeze({
  // Identifier callees
  identifiers: new Set(['fetch']),
  // MemberExpression: object.method callees
  members: {
    axios: new Set(['get', 'post', 'put', 'delete', 'patch', 'request', 'head', 'options']),
    http: new Set(['request', 'get']),
    https: new Set(['request', 'get']),
  },
});

// Route-registration method names (Express/Fastify/Koa share the verb set)
const ROUTE_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'all', 'head', 'options']);

// ─── AST walk helpers ──────────────────────────────────────────────────────

function walk(node, visitor, parent = null) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visitor, parent);
    return;
  }
  if (typeof node.type !== 'string') return;
  visitor(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range' || key === 'type') continue;
    const child = node[key];
    if (child && typeof child === 'object') walk(child, visitor, node);
  }
}

function getLoc(node) {
  if (node?.loc?.start) return { line: node.loc.start.line, column: node.loc.start.column + 1 };
  return { line: 0, column: 0 };
}

function sourceSlice(source, node, maxLen = 200) {
  if (!node?.range) return '';
  const [start, end] = node.range;
  const slice = source.slice(start, Math.min(end, start + maxLen));
  return slice.replace(/\s+/g, ' ').trim();
}

function memberChainName(node) {
  // a.b.c → "a.b.c" for MemberExpression chains with Identifier properties.
  // Returns null if the chain contains non-identifier (computed) links.
  if (!node) return null;
  if (node.type === T.Identifier) return node.name;
  if (node.type === T.MemberExpression && !node.computed && node.property?.type === T.Identifier) {
    const base = memberChainName(node.object);
    return base ? `${base}.${node.property.name}` : null;
  }
  return null;
}

function containsValidatorCall(fnBody) {
  // Walk function body; return true if we see a CallExpression whose callee's property
  // name is in VALIDATOR_METHODS. Conservative: any method call with those names
  // counts (handler authors who name unrelated methods the same will produce FNs,
  // which is the safer direction per Gate 43 A2 high-confidence discipline).
  let found = false;
  walk(fnBody, (n) => {
    if (found) return;
    if (n.type !== T.CallExpression) return;
    const callee = n.callee;
    if (!callee) return;
    if (callee.type === T.MemberExpression && !callee.computed
        && callee.property?.type === T.Identifier
        && VALIDATOR_METHODS.has(callee.property.name)) {
      found = true;
    }
  });
  return found;
}

function findObjectProp(objExpr, keyName) {
  // Look up a property by name in an ObjectExpression. Returns the property node
  // or null. Only handles simple Identifier / string-literal keys.
  if (!objExpr || objExpr.type !== T.ObjectExpression) return null;
  for (const prop of objExpr.properties) {
    if (prop.type !== T.Property || prop.computed) continue;
    const k = prop.key;
    const name = (k?.type === T.Identifier) ? k.name
               : (k?.type === T.Literal && typeof k.value === 'string') ? k.value
               : null;
    if (name === keyName) return prop;
  }
  return null;
}

function lastObjectArg(args) {
  // HTTP client pattern: last arg that's an ObjectExpression is the options bag.
  for (let i = args.length - 1; i >= 0; i--) {
    if (args[i].type === T.ObjectExpression) return args[i];
  }
  return null;
}

// ─── Rule implementations ──────────────────────────────────────────────────

const RULE_SPECS = {
  'raw-sql-interpolation': {
    severity: 'HIGH',
    fix_hint: 'Use parameterized query via your ORM or prepared statement (e.g., $1 / ? placeholders).',
  },
  'missing-timeout': {
    severity: 'HIGH',
    fix_hint: 'Add a timeout option or AbortSignal to the request (e.g., signal: AbortSignal.timeout(5000)).',
  },
  'swallowed-catch': {
    severity: 'HIGH',
    fix_hint: 'Handle the error: log with context, rethrow, or return a typed error value.',
  },
  'any-typed-body': {
    severity: 'HIGH',
    fix_hint: 'Replace any with a validated schema (zod/joi/yup/ajv/class-validator).',
    message: 'untyped or unvalidated request body',
  },
  'missing-validation-public-route': {
    severity: 'MEDIUM',
    fix_hint: 'Add a local validator call or document the framework/global validation boundary.',
    message: 'No local validation evidence found for public route',
  },
  'non-reversible-migration': {
    severity: 'HIGH',
    fix_hint: 'Export a down() function, or mark the migration as expand-contract with a reversibility comment.',
  },
  'logged-secret': {
    severity: 'HIGH',
    fix_hint: 'Redact the secret before logging (e.g., authorization: "[REDACTED]") or omit it entirely.',
  },
};

function scanJsTsAst(ast, ctx) {
  // ctx: { source, filePath, findings, file, addFinding }
  walk(ast, (node) => {
    // Rule: raw-sql-interpolation
    if (node.type === T.TemplateLiteral) {
      const hasExpr = node.expressions && node.expressions.length > 0;
      if (hasExpr) {
        const raw = node.quasis.map(q => q.value?.cooked ?? '').join(' ');
        if (SQL_KW_RE.test(raw)) {
          ctx.addFinding('raw-sql-interpolation', node);
        }
      }
    }

    // Rule: missing-timeout
    if (node.type === T.CallExpression && node.callee) {
      let isTimeoutTarget = false;
      const callee = node.callee;
      if (callee.type === T.Identifier && TIMEOUT_REQUIRED_CALLEES.identifiers.has(callee.name)) {
        isTimeoutTarget = true;
      } else if (callee.type === T.MemberExpression && !callee.computed
                 && callee.object?.type === T.Identifier
                 && callee.property?.type === T.Identifier) {
        const obj = callee.object.name;
        const prop = callee.property.name;
        const methods = TIMEOUT_REQUIRED_CALLEES.members[obj];
        if (methods && methods.has(prop)) isTimeoutTarget = true;
      }
      if (isTimeoutTarget) {
        const opts = lastObjectArg(node.arguments || []);
        let timeoutEvidence = false;
        if (opts) {
          if (findObjectProp(opts, 'timeout') || findObjectProp(opts, 'signal')) {
            timeoutEvidence = true;
          }
        }
        // Also accept if any arg's raw source contains "AbortSignal.timeout(" —
        // catches inline expressions that skip the options-bag idiom.
        if (!timeoutEvidence) {
          const raw = sourceSlice(ctx.source, node, 500);
          if (raw.includes('AbortSignal.timeout(') || raw.includes('.signal')) {
            timeoutEvidence = true;
          }
        }
        if (!timeoutEvidence) {
          ctx.addFinding('missing-timeout', node);
        }
      }
    }

    // Rule: swallowed-catch
    if (node.type === T.CatchClause) {
      const body = node.body?.body ?? [];
      let swallowed = false;
      if (body.length === 0) {
        swallowed = true;
      } else if (body.length === 1 && body[0].type === T.ReturnStatement) {
        const arg = body[0].argument;
        if (!arg) swallowed = true;
        else if (arg.type === T.Literal && (arg.value === null)) swallowed = true;
        else if (arg.type === T.Identifier && arg.name === 'undefined') swallowed = true;
      }
      if (swallowed) {
        ctx.addFinding('swallowed-catch', node);
      }
    }

    // Rule: any-typed-body
    if (node.type === T.FunctionDeclaration
        || node.type === T.FunctionExpression
        || node.type === T.ArrowFunctionExpression) {
      const firstParam = node.params?.[0];
      if (firstParam && firstParam.type === T.Identifier
          && firstParam.typeAnnotation?.typeAnnotation?.type === T.TSAnyKeyword) {
        if (!containsValidatorCall(node.body)) {
          ctx.addFinding('any-typed-body', firstParam);
        }
      }
    }

    // Rule: missing-validation-public-route
    if (node.type === T.CallExpression && node.callee?.type === T.MemberExpression) {
      const callee = node.callee;
      if (!callee.computed
          && callee.property?.type === T.Identifier
          && ROUTE_METHODS.has(callee.property.name)
          && callee.object?.type === T.Identifier) {
        // Shape: <router>.<method>(path, ...) — path is first arg
        const pathArg = node.arguments?.[0];
        if (pathArg && pathArg.type === T.Literal && typeof pathArg.value === 'string') {
          if (!AUTH_PREFIX_RE.test(pathArg.value)) {
            // Look at remaining args:
            //   ObjectExpression → Fastify schema/preValidation/preHandler option (validated)
            //   Identifier / CallExpression / ArrayExpression → middleware chain (validated)
            //   FunctionExpression / ArrowFunctionExpression → handler fn (check its body)
            let hasFastifySchema = false;
            let hasMiddlewareArg = false;
            let handlerFn = null;
            for (let i = 1; i < node.arguments.length; i++) {
              const a = node.arguments[i];
              if (a.type === T.ObjectExpression) {
                if (findObjectProp(a, 'schema')
                    || findObjectProp(a, 'preValidation')
                    || findObjectProp(a, 'preHandler')
                    || findObjectProp(a, 'validate')) {
                  hasFastifySchema = true;
                }
              } else if (a.type === T.FunctionExpression || a.type === T.ArrowFunctionExpression) {
                handlerFn = a;
              } else if (a.type === T.Identifier
                         || a.type === T.CallExpression
                         || a.type === T.ArrayExpression) {
                // Named middleware (authMw), middleware-factory call (validate(schema)),
                // or middleware array ([mw1, mw2, handler]) — treat as validated.
                hasMiddlewareArg = true;
              }
            }
            if (!hasFastifySchema && !hasMiddlewareArg) {
              const validated = handlerFn ? containsValidatorCall(handlerFn.body) : false;
              if (!validated) {
                ctx.addFinding('missing-validation-public-route', pathArg);
              }
            }
          }
        }
      }
    }

    // Rule: logged-secret
    if (node.type === T.CallExpression && node.callee) {
      const callee = node.callee;
      let isLoggerCall = false;
      if (callee.type === T.MemberExpression && !callee.computed
          && callee.property?.type === T.Identifier
          && LOGGER_METHODS.has(callee.property.name)) {
        // matches console.log, logger.info, log.warn, etc.
        isLoggerCall = true;
      }
      if (isLoggerCall) {
        for (const arg of node.arguments || []) {
          if (arg.type === T.ObjectExpression) {
            for (const prop of arg.properties) {
              if (prop.type !== T.Property || prop.computed) continue;
              const k = prop.key;
              const name = (k?.type === T.Identifier) ? k.name
                         : (k?.type === T.Literal && typeof k.value === 'string') ? k.value
                         : null;
              if (name && SECRET_KEY_RE.test(name)) {
                // But — if value is a string-literal redaction marker, skip.
                const v = prop.value;
                const isRedacted = v?.type === T.Literal && typeof v.value === 'string'
                  && /\[?(REDACTED|MASKED|HIDDEN|redacted|\*{3,})\]?/i.test(v.value);
                if (!isRedacted) {
                  ctx.addFinding('logged-secret', prop);
                  break; // one finding per logger call is enough
                }
              }
            }
          }
        }
      }
    }
  });
}

function scanSqlMigration(source, ctx) {
  // non-reversible-migration for .sql files
  const first20Lines = source.split('\n').slice(0, 20).join('\n');
  const hasMarker = /^--\s*(reversible:|expand-contract\b|down\b)/mi.test(first20Lines);
  const hasDownSection = /^--+\s*down\s*--+/mi.test(source);
  if (!hasMarker && !hasDownSection) {
    // Fire at line 1
    const fakeNode = { loc: { start: { line: 1, column: 0 } }, range: [0, Math.min(source.length, 100)] };
    ctx.addFinding('non-reversible-migration', fakeNode);
  }
}

function scanJsTsMigration(ast, source, ctx) {
  // non-reversible-migration for JS/TS files in migrations/
  let hasDown = false;

  walk(ast, (node) => {
    if (hasDown) return;

    // export function down(...)
    if (node.type === T.ExportNamedDeclaration && node.declaration) {
      const d = node.declaration;
      if (d.type === T.FunctionDeclaration && d.id?.name === 'down') hasDown = true;
      if (d.type === T.VariableDeclaration) {
        for (const decl of d.declarations) {
          if (decl.id?.type === T.Identifier && decl.id.name === 'down') hasDown = true;
        }
      }
    }
    // export const down = ... (top-level VariableDeclaration without export via ExportNamedDeclaration
    //                         is not exported, so we only accept the two forms above)

    // module.exports.down = ... / exports.down = ...
    if (node.type === T.AssignmentExpression && node.left?.type === T.MemberExpression && !node.left.computed) {
      const chain = memberChainName(node.left);
      if (chain === 'module.exports.down' || chain === 'exports.down') hasDown = true;
    }

    // class Migration { down() {} } — ClassDeclaration with method name 'down'
    if (node.type === T.ClassDeclaration || node.type === T.ClassExpression) {
      for (const m of node.body?.body || []) {
        if (m.type === T.MethodDefinition && m.key?.type === T.Identifier && m.key.name === 'down') {
          hasDown = true;
        }
      }
    }
  });

  if (!hasDown) {
    // Also accept a reversibility comment in the first 20 lines
    const first20 = source.split('\n').slice(0, 20).join('\n');
    if (/\/\/\s*(reversible:|expand-contract\b)/i.test(first20)
        || /\/\*[\s\S]*?(reversible:|expand-contract)[\s\S]*?\*\//i.test(first20)) {
      hasDown = true;
    }
  }

  if (!hasDown) {
    const fakeNode = { loc: { start: { line: 1, column: 0 } }, range: [0, Math.min(source.length, 100)] };
    ctx.addFinding('non-reversible-migration', fakeNode);
  }
}

// ─── File/dir scan ─────────────────────────────────────────────────────────

function isMigrationPath(filePath) {
  return /[\\/]migrations?[\\/]/i.test(filePath);
}

function scanFile(absPath, relPath) {
  const findings = [];
  let source;
  try {
    source = readFileSync(absPath, 'utf8');
  } catch {
    return findings;
  }

  const ext = extname(absPath).toLowerCase();
  const isSql = SQL_EXTS.has(ext);
  const isJsTs = SCANNED_EXTS.has(ext);
  if (!isSql && !isJsTs) return findings;

  const addFinding = (ruleId, node) => {
    const spec = RULE_SPECS[ruleId];
    const { line, column } = getLoc(node);
    findings.push({
      rule: ruleId,
      severity: spec.severity,
      kind: 'deterministic',
      file: relPath,
      line,
      column,
      match: sourceSlice(source, node),
      fix_hint: spec.fix_hint,
      ...(spec.message ? { message: spec.message } : {}),
    });
  };

  const ctx = { source, filePath: absPath, findings, addFinding };

  if (isSql) {
    if (isMigrationPath(absPath)) {
      scanSqlMigration(source, ctx);
    }
    return findings;
  }

  // JS/TS parse
  let ast;
  try {
    ast = parseEstree(source, {
      loc: true,
      range: true,
      jsx: ext === '.tsx' || ext === '.jsx',
      comment: false,
      errorOnUnknownASTType: false,
      errorOnTypeScriptSyntacticAndSemanticIssues: false,
    });
  } catch (err) {
    // Conservative: skip unparseable files. Log to stderr unless --test mode.
    if (process.env.SUNCO_DETECTOR_DEBUG) {
      process.stderr.write(`[detect-backend-smells] parse failed: ${relPath}: ${err.message}\n`);
    }
    return findings;
  }

  scanJsTsAst(ast, ctx);

  if (isMigrationPath(absPath)) {
    scanJsTsMigration(ast, source, ctx);
  }

  return findings;
}

function* walkFiles(root) {
  const stat = statSync(root);
  if (stat.isFile()) {
    yield root;
    return;
  }
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        stack.push(full);
      } else if (ent.isFile()) {
        const ext = extname(ent.name).toLowerCase();
        if (SCANNED_EXTS.has(ext) || SQL_EXTS.has(ext)) yield full;
      }
    }
  }
}

function scanTarget(target) {
  const absTarget = resolve(target);
  if (!existsSync(absTarget)) {
    const err = new Error(`Target not found: ${target}`);
    err.code = 'TARGET_NOT_FOUND';
    throw err;
  }
  const rootForRel = statSync(absTarget).isDirectory() ? absTarget : dirname(absTarget);
  const t0 = performance.now();
  let filesScanned = 0;
  const findings = [];
  for (const abs of walkFiles(absTarget)) {
    filesScanned += 1;
    const rel = relative(rootForRel, abs) || basename(abs);
    const fs_ = scanFile(abs, rel);
    for (const f of fs_) findings.push(f);
  }
  const t1 = performance.now();
  return {
    findings,
    meta: {
      files_scanned: filesScanned,
      duration_ms: Math.round(t1 - t0),
      rules_enabled: [...RULES_ENABLED],
      detector_version: DETECTOR_VERSION,
    },
  };
}

// ─── --test mode (fixture corpus) ──────────────────────────────────────────

function runTest() {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const fixturesRoot = resolve(here, '..', 'fixtures');
  const posDir = join(fixturesRoot, 'positive');
  const negDir = join(fixturesRoot, 'negative');

  if (!existsSync(posDir) || !existsSync(negDir)) {
    process.stderr.write(`FAIL  fixtures root missing: ${fixturesRoot}\n`);
    process.exit(1);
  }

  const results = [];

  // Positive: each rule must fire on at least one of its positive fixtures
  const posByRule = new Map();
  for (const rule of RULES_ENABLED) posByRule.set(rule, { fired: 0, files: 0 });

  for (const abs of walkFiles(posDir)) {
    const rel = relative(posDir, abs);
    // Fixture naming convention: <rule-id>[-variant].<ext>
    const base = basename(rel, extname(rel));
    // Strip variant suffix: "missing-validation-public-route-fastify" → "missing-validation-public-route"
    let matchedRule = null;
    for (const rule of RULES_ENABLED) {
      if (base === rule || base.startsWith(rule + '-')) { matchedRule = rule; break; }
    }
    if (!matchedRule) {
      results.push({ ok: false, msg: `positive fixture has no recognized rule prefix: ${rel}` });
      continue;
    }
    const counters = posByRule.get(matchedRule);
    counters.files += 1;
    // For migration fixtures, the fixture path must include "migrations/" to activate that rule
    const fs_ = scanFile(abs, rel);
    const firedThisRule = fs_.some(f => f.rule === matchedRule);
    if (firedThisRule) {
      counters.fired += 1;
      results.push({ ok: true, msg: `positive fixture fires ${matchedRule}: ${rel}` });
    } else {
      results.push({ ok: false, msg: `positive fixture did NOT fire ${matchedRule}: ${rel} (got [${fs_.map(f=>f.rule).join(',')||'none'}])` });
    }
  }

  for (const [rule, c] of posByRule.entries()) {
    if (c.files === 0) {
      results.push({ ok: false, msg: `no positive fixture found for rule: ${rule}` });
    } else if (c.fired === 0) {
      results.push({ ok: false, msg: `rule has positive fixtures but none fired: ${rule}` });
    }
  }

  // Framework spread for missing-validation-public-route: ≥2 frameworks
  {
    const mvprFixtures = [];
    for (const abs of walkFiles(posDir)) {
      const rel = relative(posDir, abs);
      const base = basename(rel, extname(rel));
      if (base.startsWith('missing-validation-public-route')) mvprFixtures.push(base);
    }
    const frameworks = new Set();
    for (const f of mvprFixtures) {
      if (/express/i.test(f)) frameworks.add('express');
      else if (/fastify/i.test(f)) frameworks.add('fastify');
      else if (/koa/i.test(f)) frameworks.add('koa');
      else frameworks.add('generic');
    }
    const ok = frameworks.size >= 2 && frameworks.has('express') && frameworks.has('fastify');
    results.push({
      ok,
      msg: `missing-validation-public-route framework spread (≥2, incl. express+fastify): [${[...frameworks].join(',')}]`,
    });
  }

  // Negative: each rule must have at least one fixture that does NOT fire
  const negByRule = new Map();
  for (const rule of RULES_ENABLED) negByRule.set(rule, { silent: 0, files: 0 });

  for (const abs of walkFiles(negDir)) {
    const rel = relative(negDir, abs);
    const base = basename(rel, extname(rel));
    let matchedRule = null;
    for (const rule of RULES_ENABLED) {
      if (base === rule || base.startsWith(rule + '-')) { matchedRule = rule; break; }
    }
    if (!matchedRule) {
      results.push({ ok: false, msg: `negative fixture has no recognized rule prefix: ${rel}` });
      continue;
    }
    const counters = negByRule.get(matchedRule);
    counters.files += 1;
    const fs_ = scanFile(abs, rel);
    const silentForRule = !fs_.some(f => f.rule === matchedRule);
    if (silentForRule) {
      counters.silent += 1;
      results.push({ ok: true, msg: `negative fixture silent for ${matchedRule}: ${rel}` });
    } else {
      results.push({ ok: false, msg: `negative fixture FIRED ${matchedRule} (false positive): ${rel}` });
    }
  }

  for (const [rule, c] of negByRule.entries()) {
    if (c.files === 0) {
      results.push({ ok: false, msg: `no negative fixture found for rule: ${rule}` });
    } else if (c.silent === 0) {
      results.push({ ok: false, msg: `rule has negative fixtures but all fired: ${rule}` });
    }
  }

  // Report
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  for (const r of results) {
    process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.msg}\n`);
  }
  process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
  return failed === 0 ? 0 : 1;
}

// ─── CLI ───────────────────────────────────────────────────────────────────

function printHumanReport(result) {
  const { findings, meta } = result;
  if (findings.length === 0) {
    process.stdout.write(`No backend smells detected. (${meta.files_scanned} files, ${meta.duration_ms}ms)\n`);
    return;
  }
  for (const f of findings) {
    const msg = f.message ? ` — ${f.message}` : '';
    process.stdout.write(`${f.severity}  ${f.rule}  ${f.file}:${f.line}:${f.column}${msg}\n`);
    process.stdout.write(`       ${f.match}\n`);
    process.stdout.write(`       fix: ${f.fix_hint}\n\n`);
  }
  process.stdout.write(`${findings.length} finding(s) across ${meta.files_scanned} file(s) in ${meta.duration_ms}ms.\n`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(
      `SUNCO Backend Smell Detector v${DETECTOR_VERSION}\n\n` +
      `Usage:\n` +
      `  node detect-backend-smells.mjs <target-dir> [--json]\n` +
      `  node detect-backend-smells.mjs --test\n\n` +
      `Rules (${RULES_ENABLED.length}):\n` +
      RULES_ENABLED.map(r => `  - ${r} (${RULE_SPECS[r].severity})`).join('\n') + '\n'
    );
    process.exit(0);
  }

  if (args.includes('--test')) {
    process.exit(runTest());
  }

  const jsonMode = args.includes('--json');
  const target = args.find(a => !a.startsWith('--'));

  if (!target) {
    process.stderr.write('error: target directory or file required\n');
    process.stderr.write('usage: detect-backend-smells.mjs <target> [--json]\n');
    process.exit(1);
  }

  let result;
  try {
    result = scanTarget(target);
  } catch (err) {
    const payload = { error: { code: err.code || 'SCAN_FAILED', message: err.message } };
    if (jsonMode) process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    else process.stderr.write(`error: ${err.message}\n`);
    process.exit(1);
  }

  if (jsonMode) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    printHumanReport(result);
  }
  process.exit(result.findings.length > 0 ? 2 : 0);
}

// Run only when invoked directly (not when imported).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { scanTarget, scanFile, RULES_ENABLED, DETECTOR_VERSION };
