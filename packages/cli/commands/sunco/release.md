---
name: sunco:release
description: Create a release — version bump, changelog generation, git tag, and npm publish. Validates that all tests pass and lint is clean before publishing.
argument-hint: "[patch|minor|major] [--dry-run] [--no-publish]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Arguments:**
- `[patch|minor|major]` — Version bump type. If omitted, asks based on what changed.

**Flags:**
- `--dry-run` — Show what would happen without making changes.
- `--no-publish` — Create tag and changelog but don't publish to npm.
</context>

<objective>
Create a clean release: bump version, generate changelog from commits, create git tag, and publish to npm.

**Pre-flight checklist (all must pass before release):**
- Lint: zero errors
- TypeScript: zero errors
- Tests: all passing
- Working tree: clean
- Branch: main (unless --no-publish)
</objective>

<process>
## Step 1: Pre-flight checks

```bash
# Lint
npx eslint packages/ --max-warnings 0

# TypeScript
npx tsc --noEmit

# Tests
npx vitest run

# Git state
git status --short
git branch --show-current
```

If any check fails: stop and report. Do not release with failing checks.

If `--dry-run`: show what would be done and stop after this step.

## Step 2: Determine version bump

Read `package.json` for current version.
Read recent commits: `git log --oneline [last-tag]..HEAD`

If bump type not in $ARGUMENTS:
Show commit list and ask: "What kind of release?
  patch ([current] → [patch]) — bug fixes only
  minor ([current] → [minor]) — new features, backward compatible
  major ([current] → [major]) — breaking changes"

## Step 3: Generate changelog

Read commits since last tag:
```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
```

Group commits by type:
- feat: → Features
- fix: → Bug Fixes
- docs: → Documentation
- refactor: → Internal

Write to `CHANGELOG.md` (append new version section at top):
```markdown
## [version] — [date]

### Features
- [feat commits]

### Bug Fixes
- [fix commits]

### Internal
- [refactor/docs commits]
```

## Step 4: Bump version

```bash
npm version [patch|minor|major] --no-git-tag-version
```

This updates `package.json` versions in all packages.

## Step 5: Commit and tag

```bash
git add package.json packages/*/package.json CHANGELOG.md
git commit -m "chore: release v[version]"
git tag v[version]
```

## Step 6: Publish (skip if --no-publish)

```bash
npm run build
npm publish --access public
```

Show: "Published sunco v[version] to npm."

## Step 7: Push

```bash
git push origin main
git push origin v[version]
```

## Step 8: Report

```
Release v[version] complete.
  npm: https://www.npmjs.com/package/sunco/v/[version]
  tag: v[version]
  changelog: CHANGELOG.md updated
```
</process>
