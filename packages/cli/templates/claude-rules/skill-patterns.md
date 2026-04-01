---
patterns:
  - "**/*.skill.ts"
  - "**/skills-harness/**"
  - "**/skills-workflow/**"
---

# Skill Implementation Patterns

- Every skill uses `export default defineSkill({...})` — no other export pattern
- Skill lifecycle: entry → progress → gather → process → state.set → ui.result → return
- Two kinds: `kind: 'deterministic'` (zero LLM, pure logic) and `kind: 'prompt'` (agent-powered)
- Deterministic first: if you can enforce something with lint/test, do not use an LLM
- State persistence: `ctx.state.set('skillName.lastResult', data)` for recommender integration
- Cross-skill invocation: `await ctx.run('workflow.diagnose')` via skill ID, never direct import
- Graceful degradation: unstructured agent output returns `success: true` with `warnings[]`
- Partial failure: `success: true` with `warnings[]` when at least 1 subtask succeeds
