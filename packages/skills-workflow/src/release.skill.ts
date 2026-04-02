/**
 * @sunco/skills-workflow - Release Skill
 *
 * Deterministic release pipeline: version bump across all workspace packages,
 * CHANGELOG.md generation from git log, annotated git tag, and optional npm publish.
 *
 * This skill is purely deterministic (no agent calls needed).
 *
 * Requirements: SHP-01, SHP-02
 * Decisions: D-05 (release pipeline), D-06 (version bumper contract),
 *   D-07 (deterministic kind), D-15 (state tracking), D-16 (UI pattern)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { captureGitState } from './shared/git-state.js';
import { artifactGate } from './shared/gates.js';
import { bumpVersion, updateAllVersions } from './shared/version-bumper.js';
import {
  parseGitLog,
  generateChangelog,
  prependChangelog,
} from './shared/changelog-writer.js';

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.release',
  command: 'release',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  description: 'Bump version, generate changelog, create git tag, optionally publish to npm',

  options: [
    { flags: '--major', description: 'Bump major version' },
    { flags: '--minor', description: 'Bump minor version' },
    { flags: '--patch', description: 'Bump patch version (default)' },
    { flags: '--dry-run', description: 'Preview without publishing' },
    { flags: '--skip-publish', description: 'Skip npm publish step' },
    { flags: '--force', description: 'Proceed even with dirty working tree' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Release',
      description: 'Starting release pipeline...',
    });

    // --- Step 1: Dirty tree check (Pitfall 2) ---
    const gitState = await captureGitState(ctx.cwd);
    const force = ctx.args.force === true;

    if (gitState.uncommittedChanges && !force) {
      const summary = 'Working tree is dirty. Commit changes first or use --force.';
      await ctx.ui.result({ success: false, title: 'Release', summary });
      return { success: false, summary };
    }

    // --- Step 2: Determine bump type ---
    let bumpType: 'major' | 'minor' | 'patch' = 'patch';
    if (ctx.args.major === true) {
      bumpType = 'major';
    } else if (ctx.args.minor === true) {
      bumpType = 'minor';
    }

    // --- Step 3: Read current version ---
    const pkgPath = join(ctx.cwd, 'package.json');
    const pkgRaw = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
    const currentVersion = pkg.version as string;

    if (!currentVersion) {
      const summary = 'No version field found in root package.json';
      await ctx.ui.result({ success: false, title: 'Release', summary });
      return { success: false, summary };
    }

    // --- Step 4: Bump version ---
    const newVersion = bumpVersion(currentVersion, bumpType);
    ctx.log.info(`Version bump: ${currentVersion} -> ${newVersion} (${bumpType})`);

    // --- Step 5: Dry-run check ---
    const dryRun = ctx.args['dry-run'] === true || ctx.args.dryRun === true;

    if (dryRun) {
      const summary = `Dry run: would bump to ${newVersion}`;
      await ctx.ui.result({
        success: true,
        title: 'Release',
        summary,
        details: [
          `Current: ${currentVersion}`,
          `New: ${newVersion}`,
          `Bump type: ${bumpType}`,
          'No changes were made.',
        ],
      });
      return {
        success: true,
        summary,
        data: { dryRun: true, newVersion, currentVersion, bumpType },
      };
    }

    // --- Step 6: Update all workspace packages ---
    const versionProgress = ctx.ui.progress({
      title: 'Version update',
      total: 1,
    });

    const updatedFiles = await updateAllVersions(ctx.cwd, newVersion);
    versionProgress.update({ completed: 1 });
    versionProgress.done({ summary: `Updated ${updatedFiles.length} package(s)` });

    // --- Step 7: Generate changelog ---
    const changelogProgress = ctx.ui.progress({
      title: 'Changelog',
      total: 1,
    });

    const git = simpleGit(ctx.cwd);
    const tags = await git.tags();
    const lastTag = tags.all.length > 0 ? tags.all[tags.all.length - 1] : undefined;

    let logOutput: string;
    try {
      const logResult = lastTag
        ? await git.log({ from: lastTag, to: 'HEAD' })
        : await git.log();
      logOutput = logResult.all.map((c) => `${c.hash.slice(0, 7)} ${c.message}`).join('\n');
    } catch {
      logOutput = '';
    }

    const entries = parseGitLog(logOutput);
    const today = new Date().toISOString().split('T')[0]!;
    const changelogSection = generateChangelog(entries, newVersion, today);

    // Read existing CHANGELOG.md or start fresh
    const changelogPath = join(ctx.cwd, 'CHANGELOG.md');
    let existingChangelog = '';
    try {
      existingChangelog = await readFile(changelogPath, 'utf-8');
    } catch {
      // No existing CHANGELOG.md -- that's fine
    }

    const newChangelog = prependChangelog(existingChangelog, changelogSection);
    await writeFile(changelogPath, newChangelog, 'utf-8');

    changelogProgress.update({ completed: 1 });
    changelogProgress.done({ summary: 'CHANGELOG.md updated' });

    // --- Step 8: Git commit ---
    const commitProgress = ctx.ui.progress({
      title: 'Release commit',
      total: 1,
    });

    const filesToStage = [...updatedFiles, 'CHANGELOG.md'];
    await git.add(filesToStage);
    await git.commit(`release: v${newVersion}`);

    commitProgress.update({ completed: 1 });
    commitProgress.done({ summary: `Committed release: v${newVersion}` });

    // --- Step 9: Create tag (Pitfall 7 -- check if exists) ---
    const tagProgress = ctx.ui.progress({
      title: 'Tagging',
      total: 1,
    });

    const tagName = `v${newVersion}`;
    let tagCreated = false;

    // Re-fetch tags after commit
    const updatedTags = await git.tags();
    if (updatedTags.all.includes(tagName)) {
      ctx.log.warn(`Tag ${tagName} already exists -- skipping`);
    } else {
      await git.addAnnotatedTag(tagName, `Release ${tagName}`);
      tagCreated = true;
    }

    tagProgress.update({ completed: 1 });
    tagProgress.done({ summary: tagCreated ? `Tagged ${tagName}` : `Tag ${tagName} already exists` });

    // --- Step 10a: Artifact Gate (shared stop-the-line gate) ---
    const artifactCheck = await artifactGate(ctx);
    if (!artifactCheck.passed) {
      await ctx.ui.result({ success: false, title: 'Release', summary: artifactCheck.reason });
      return { success: false, summary: artifactCheck.reason };
    }
    ctx.log.info(artifactCheck.reason);

    // --- Step 10b: Proceed Gate — fresh re-verify (mandatory before publish) ---
    // Do NOT trust cached verify.lastResult — code may have changed since last verify.
    // Run a fresh lightweight verification to ensure current state is clean.
    ctx.log.info('proceed-gate: Running fresh verification before publish...');
    const freshVerify = await ctx.run('workflow.verify', { auto: true });
    if (!freshVerify.success) {
      const report = freshVerify.data as { verdict?: string; findings?: unknown[] } | undefined;
      const findingsCount = report?.findings?.length ?? 0;
      const summary = `Release blocked by proceed-gate: fresh verify failed (${findingsCount} finding(s), verdict: ${report?.verdict ?? 'FAIL'}). Resolve all findings before release.`;
      await ctx.ui.result({ success: false, title: 'Release', summary });
      return { success: false, summary };
    }
    ctx.log.info('proceed-gate: Fresh verification PASSED');

    // --- Step 10c: npm publish ---
    const skipPublish = ctx.args['skip-publish'] === true || ctx.args.skipPublish === true;
    let published = false;

    if (!skipPublish) {
      try {
        const { execa } = await import('execa');
        await execa('npm', ['publish', '--access', 'public'], { cwd: ctx.cwd });
        published = true;
        ctx.log.info('Published to npm');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.log.warn(`npm publish failed: ${msg}`);
      }
    }

    // --- Step 11: Push tag ---
    try {
      await git.push('origin', gitState.branch);
      await git.pushTags('origin');
    } catch (err) {
      ctx.log.warn('Push failed', { error: err });
    }

    // --- Step 12: Return result ---
    const summary = `Released v${newVersion}`;
    await ctx.ui.result({
      success: true,
      title: 'Release',
      summary,
      details: [
        `Version: ${currentVersion} -> ${newVersion}`,
        `Updated: ${updatedFiles.length} package(s)`,
        `Tag: ${tagCreated ? tagName : 'skipped (exists)'}`,
        `Published: ${published ? 'yes' : 'no'}`,
      ],
    });

    return {
      success: true,
      summary,
      data: {
        version: newVersion,
        updatedFiles,
        tagCreated,
        published,
      },
    };
  },
});
