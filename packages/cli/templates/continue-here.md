# Continue Here — Session Handoff

**Paused:** {{pause_timestamp}}
**Session ID:** {{session_id}}
**Paused by:** {{paused_by}}

> Pick up exactly here. Read this file first, then read the referenced context files.
> Do NOT start fresh — continue from the exact state described below.

---

## What Was Happening

{{what_was_happening}}

---

## Exact Resume Point

**Current phase:** {{current_phase}}
**Current plan:** {{current_plan}}
**Current task:** {{current_task}}
**Task status:** {{task_status}}
*(not-started | in-progress | blocked | needs-verification)*

**Last action taken:**
{{last_action}}

**Next action to take:**
{{next_action}}

**Do this first:**
```bash
{{first_command_on_resume}}
```

---

## Context to Restore

```
{{context_to_restore}}
```

**Files in flight (open/modified but not committed):**
- `{{open_file_1}}` — {{open_file_1_state}}
- `{{open_file_2}}` — {{open_file_2_state}}

**Partial work committed:**
- {{partial_commit_1}}
- {{partial_commit_2}}

---

## Critical State

**Decisions made this session:**
{{session_decisions}}

**Blockers active:**
{{active_blockers}}

**Things to NOT do (learned this session):**
{{things_to_avoid}}

---

## Read These Files First

```
{{files_to_read_list}}
```

---

## Mental Model Snapshot

{{mental_model}}

*(Short description of the current understanding of the system state)*

---

## Why Paused

{{pause_reason}}
*(end-of-session | blocker | waiting-for-user | context-limit | error)*

---

## Quick Resume Checklist

- [ ] Read this file fully
- [ ] Read referenced context files above
- [ ] Run `{{health_check_command}}` to verify environment state
- [ ] Check git status: `git status && git log --oneline -5`
- [ ] Resume from: {{resume_task_description}}

---

*Session paused by: /sunco:pause*
*Resume with: /sunco:resume*
*File: .sun/session/continue-here.md*
*Session: {{session_id}}*
