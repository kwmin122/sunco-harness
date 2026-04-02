## SUNCO — Agent Workspace OS

에이전트가 실수를 덜 하게 판을 깔아주는 OS. 하네스 엔지니어링이 핵심.

### Key Rules

- **Skill-Only**: 모든 기능은 스킬. 하드코딩된 명령어 금지
- **Deterministic First**: 린터/테스트로 강제할 수 있는 건 LLM 사용 안 함
- **ESM-only**: `.js` extension in imports even for `.ts` files
- **Clean Room**: GSD 코드 복사 금지. 개념만 참고하여 처음부터 작성
- **Quality**: 각 스킬은 완성품

### Product Contract

See `packages/cli/references/product-contract.md` for the single source of truth on:
verify layers (7), runtime paths, bin names, state/config schema, hook contracts, gate definitions.

### Detailed Rules

See `.claude/rules/` for context-specific guidelines:
- `tech-stack.md` — versions, alternatives, what NOT to use
- `architecture.md` — monorepo structure, key patterns
- `conventions.md` — naming, imports, testing, skill patterns
- `workflow.md` — GSD/SUNCO workflow enforcement, gate definitions
- `project-identity.md` — core value, constraints, distribution

### Workflow

Use `/sunco:*` commands. Entry points:
- `/sunco:quick` — small fixes
- `/sunco:debug` — investigation
- `/sunco:execute` — planned phase work

Gates (stop-the-line): plan-gate, artifact-gate, proceed-gate, dogfood-gate.

Do not make direct repo edits outside a workflow unless explicitly asked.

### Developer Profile

> Run `/gsd:profile-user` to generate your developer profile.
