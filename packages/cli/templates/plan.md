---
phase: {{phase_number}}
plan: {{plan_number}}
title: {{plan_title}}
wave: {{wave_number}}
depends_on: {{depends_on}}
files_modified:
  - {{file_1}}
  - {{file_2}}
  - {{file_3}}
---

<objective>
{{objective}}

Requirements fulfilled: {{requirements_covered}}
Phase goal contribution: {{phase_goal_contribution}}
</objective>

<tasks>
<task id="{{phase_number}}-{{plan_number}}-01">
  <name>{{task_1_name}}</name>
  <description>
    {{task_1_description}}
  </description>
  <files>
    - {{task_1_file_1}}
    - {{task_1_file_2}}
  </files>
  <acceptance_criteria>
    - {{task_1_criterion_1}}
    - {{task_1_criterion_2}}
    - {{task_1_criterion_3}}
  </acceptance_criteria>
</task>

<task id="{{phase_number}}-{{plan_number}}-02">
  <name>{{task_2_name}}</name>
  <description>
    {{task_2_description}}
  </description>
  <files>
    - {{task_2_file_1}}
    - {{task_2_file_2}}
  </files>
  <acceptance_criteria>
    - {{task_2_criterion_1}}
    - {{task_2_criterion_2}}
    - {{task_2_criterion_3}}
  </acceptance_criteria>
</task>

<task id="{{phase_number}}-{{plan_number}}-03">
  <name>{{task_3_name}}</name>
  <description>
    {{task_3_description}}
  </description>
  <files>
    - {{task_3_file_1}}
  </files>
  <acceptance_criteria>
    - {{task_3_criterion_1}}
    - {{task_3_criterion_2}}
  </acceptance_criteria>
</task>
</tasks>

<done_when>
- [ ] {{completion_criterion_1}}
- [ ] {{completion_criterion_2}}
- [ ] {{completion_criterion_3}}
- [ ] All task acceptance criteria verified
- [ ] /sunco:lint passes with zero errors
- [ ] npx tsc --noEmit passes with zero errors
</done_when>
