# Global Harness Engineering Research — 2026-03-29

**Sources**: 60+ URLs across US/EU ecosystems, academic papers, competitor analysis

## 업계 합의: "2025 = 에이전트, 2026 = 에이전트 하네스"

- OpenAI: 100만줄 앱을 사람 코드 0으로. 하네스가 전부.
- LangChain: 하네스만 바꿔서 Terminal Bench Top 30 → Top 5.
- Martin Fowler: 하네스 엔지니어링을 새 분야로 정의.
- 41% 커밋이 AI 보조 → 40% 품질 결핍 (리뷰 인력 부족)

## SUNCO에 즉시 접목할 인사이트 TOP 5

### 1. Garbage Collection (OpenAI 3대 기둥 중 빠진 것)

> "에이전트가 주기적으로 문서/아키텍처 엔트로피를 찾아서 수정" — OpenAI Codex

**현재**: `sunco health`가 결정적 패턴 추적만 함. 에이전트 기반 엔트로피 탐지 없음.
**접목**: `sunco health --deep` 옵션. 에이전트가 코드-문서 불일치, 죽은 import, 오래된 TODO 탐지+수정 제안.

### 2. KV-cache 최적화 (Manus — 10x 비용 절감)

> "stable prefix + append-only context + deterministic serialization" — Manus AI

**현재**: 매 agent dispatch마다 프롬프트 전체 재구성.
**접목**: Agent Router에서 프롬프트를 구조화:
- **Stable prefix** (변하지 않는 것): AGENTS.md, 규칙, 스킬 정의
- **Variable suffix** (변하는 것): 현재 작업, 컨텍스트
- cache hit rate 높이면 비용 대폭 절감

### 3. GAN-Style Generator/Evaluator 분리 (Anthropic)

> "Generator agent (creative) + Evaluator agent (skeptical critic)" — Anthropic

**현재**: verify Layer 5가 이미 adversarial agent 사용. BUT 같은 호출 체인 안에 있음.
**접목**: verify의 evaluator가 generator와 완전히 별도 컨텍스트에서 실행되도록 보장.
현재 코드 확인 필요: Promise.allSettled로 병렬 호출하면 이미 별도 컨텍스트일 수 있음.

### 4. fail loudly, succeed silently (HumanLayer)

> "검증 성공은 조용히, 실패만 크게" — back-pressure 패턴

**현재**: `sunco verify` 모든 결과를 동일 상세도로 출력.
**접목**: PASS → 1줄 요약. FAIL → 전체 상세 보고서 + 수정 제안. 컨텍스트 오염 방지.

### 5. Spec-driven verification 자동 연결 (Opslane/Verify)

> "plan의 acceptance_criteria를 verify가 자동 로드하여 검증" — spec-first 패턴

**현재**: plan에 acceptance_criteria 필수(PQP-05). BUT verify가 이걸 자동 로드하지 않음.
**접목**: verify Layer 3에서 해당 phase의 PLAN.md를 파싱하여 acceptance_criteria를 자동 추출 → 검증.

## 진짜 경쟁자 (GSD가 아님)

| 경쟁자 | 형태 | 위협도 | SUNCO 차별점 |
|--------|------|--------|-------------|
| **Augment Intent** | 데스크톱 워크스페이스 (Coordinator/Implementor/Verifier) | 높음 | CLI-native, 하네스 깊이 |
| **Windsurf** | IDE (Arena Mode + Plan Mode + 병렬 에이전트) | 높음 | 독립 런타임, 에디터 비종속 |
| **Composio** | 오케스트레이터 (병렬 에이전트 + worktree) | 중간 | 5겹 검증, lint/guard |
| **GitHub Copilot Agent** | GitHub 내장 (이슈→PR 자동) | 높음 | 독립성, 품질 게이트 |

**핵심**: GSD, Spec Kit, Taskmaster는 프롬프트 레이어. SUNCO는 **런타임 레이어**로 포지셔닝해야 함.

## EU 특화 인사이트

- EU AI Act 사전 준수 = 마케팅 포인트 ("EU AI Act pre-compliant by design")
- SonarQube Quality Gate 패턴 → 이미 verify에 적용 (오늘 구현)
- "결정적 우선(Deterministic First)" = 유럽 업계 표준 = SUNCO 원칙과 일치
- Mistral Codestral = 유럽 sovereign AI provider 옵션 (향후)
