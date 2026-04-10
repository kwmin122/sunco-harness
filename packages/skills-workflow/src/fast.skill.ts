/**
 * @sunco/skills-workflow - Fast Skill (alias for `quick --speed fast`)
 *
 * Preserved for backward compatibility. Delegates to workflow.quick with speed=fast.
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';

export default defineSkill({
  id: 'workflow.fast',
  command: 'fast',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'simple',
  description: 'Immediate task execution -- zero planning overhead (alias for quick --speed fast)',
  options: [],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    return ctx.run('workflow.quick', { ...ctx.args, speed: 'fast' });
  },
});
