# SUNCO Brainstorming Wrapper

This workflow runs the vendored Superpowers `brainstorming` skill as SUNCO's second project-start layer.

## Source Of Truth

Read this file before doing anything else:

```text
$HOME/.claude/sunco/references/superpowers/brainstorming/SKILL.md
```

That file is vendored from Superpowers and must remain the behavioral source of truth. Do not paraphrase it from memory. Do not replace it with a SUNCO-specific brainstorming flow.

## SUNCO Adapter

Follow the Superpowers brainstorming process exactly through:

1. Explore project context
2. Offer visual companion when relevant
3. Ask clarifying questions one at a time
4. Propose 2-3 approaches
5. Present the design and get approval
6. Write the design doc
7. Run the spec self-review
8. Ask the user to review the written spec

The only SUNCO-specific adaptation is the terminal handoff:

- Superpowers says the terminal state is `writing-plans`.
- For SUNCO project starts, `/sunco:new --from-preflight <spec-path>` is the equivalent planning handoff.
- Do not implement after brainstorming.

## Handoff

After the user approves the written spec, run or instruct:

```text
/sunco:new --from-preflight <path-to-approved-spec>
```

If the user started with `/sunco:new` and this workflow is being executed as an embedded preflight, return the approved spec path and summary to the parent `/sunco:new` flow.

## Success Criteria

- The vendored Superpowers skill was read.
- The hard gate against implementation was honored.
- A design doc exists.
- The user approved the written spec.
- The next step is `/sunco:new --from-preflight <spec-path>`.
