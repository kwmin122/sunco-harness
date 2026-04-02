---
description: Project identity, core value, constraints, and distribution details
---

## SUNCO

SUNCO is an independent workspace OS for agent-era builders. In an era where AI agents write code, the builder's job is not writing code -- it's setting up the field so agents make fewer mistakes. SUN is that field. A standalone CLI runtime with a skill-based architecture, harness engineering at its core, a 6-stage review pipeline with 7-layer Swiss cheese verification, and a dedicated terminal for real-time agent observation. The first workspace OS for Korean developers. Zero competitors.

**Core Value:** 에이전트가 실수를 덜 하게 판을 깔아주는 OS -- 하네스 엔지니어링이 핵심이다. 린터가 가르치면서 막고, 코드가 아니라 의도를 검증하고, 모든 것을 스킬로 구성한다. 각 스킬이 완성품이며, 퀄리티와 디테일이 생명줄이다.

### Constraints
- **Tech Stack**: TypeScript (Node.js), Commander.js, TOML, tsup, Vitest
- **Distribution**: npm (npx popcoru / npx sunco)
- **First Agent Provider**: Claude Code CLI, provider-agnostic via Vercel AI SDK
- **Terminal**: Swift/AppKit (macOS) with libghostty
- **Clean Room**: GSD 코드 복사 금지. 개념만 참고하여 처음부터 작성
- **Skill-Only**: 모든 기능은 스킬. 하드코딩된 명령어 금지
- **Deterministic First**: 린터/테스트로 강제할 수 있는 건 LLM 사용 안 함
- **Quality**: 각 스킬은 완성품. 하나 작성하는 데 모든 역량/스킬/서치 투입
