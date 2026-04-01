# ISSUE-002: Quality Supremacy — GSD 강점 흡수 + 3개 역전 + 인사이트 적용

## 서치 인사이트 (Anthropic Engineering)

1. **Poka-yoke 원칙**: 도구 인터페이스를 실수가 불가능하게 설계. 절대경로 강제가 상대경로 에러를 완전히 제거. → executor/planner에 적용
2. **도구 > 프롬프트**: SWE-bench에서 프롬프트보다 도구 최적화에 더 많은 시간 투자. → agent 도구 설계 강화
3. **Hidden test problem**: 모델이 성공했다고 "생각"하지만 숨겨진 테스트에서 실패. → Nyquist auditor 강화
4. **Simplicity first**: 불필요한 추상화 레이어를 피하라는 뜻. 기능을 빼라는 뜻이 아님. checkpoint/recovery는 필요한 복잡성 — 유지. 대신 인터페이스(에이전트가 읽는 프롬프트)를 명확하게. "도구 최적화 > 프롬프트 길이"
5. **Sandbox + guardrails**: 자율 운영 리스크를 샌드박스로 완화. → executor에 blast radius sandbox

## 역전 계획 (3개)

### 1. executor (GSD > SUNCO 소폭) → SUNCO > GSD

**GSD 강점 흡수:**
- Checkpoint per task (not just per plan) — 태스크 완료마다 `.partial` 파일 저장
- Partial completion tracking — 에이전트가 중단되면 어디까지 했는지 추적
- Worktree integration — 격리 실행 옵션

**Anthropic 인사이트 적용:**
- Poka-yoke: 모든 파일 경로를 절대경로로 강제 (task action에서 상대경로 사용 금지)
- Stopping conditions: 최대 반복 횟수 설정 (lint fix 3회, test retry 2회)
- Sandbox mindset: blast radius sandbox — 고위험 변경 시 worktree에서 먼저 실행

**SUNCO 고유 추가:**
- Lint-gate fix loop: 실패 시 자동 수정 시도 3회, 여전히 실패면 사용자에게 에스컬레이션
- Post-task verification: 각 태스크 완료 후 `<done>` block 자체 검증
- Recovery from crash: 에이전트 중단 시 `.partial` + git stash로 복구

### 2. phase-researcher (GSD > SUNCO 소폭) → SUNCO > GSD

**GSD 강점 흡수:**
- Web search integration detail — 검색 쿼리 템플릿, 소스 우선순위
- Structured output templates — 리서치 결과의 정형화된 구조
- More research prompts — 도메인별 리서치 프롬프트

**Anthropic 인사이트 적용:**
- Tool documentation: 리서치 도구(WebSearch, context7)의 사용법을 에이전트에게 명시적으로 교육
- Format in training data: 리서치 결과를 markdown table 형태로 (LLM이 잘 생성하는 형식)

**SUNCO 고유 추가:**
- Source credibility scoring: 출처별 신뢰도 점수 (공식 문서 > 블로그 > StackOverflow > 개인 gist)
- Research freshness check: 정보의 날짜 확인 (2년 이상 된 정보는 WARN)
- Contradiction detection: 소스 간 모순 발견 시 명시적 플래그

### 3. integration-checker (GSD > SUNCO 중폭) → SUNCO > GSD

**GSD 강점 흡수:**
- Data flow tracing — 입력→변환→출력을 모듈 경계 넘어 추적
- Cross-phase dependency verification — 페이즈 간 데이터 계약 검증
- Detailed regression surface analysis

**Anthropic 인사이트 적용:**
- Real unit tests validation: 실제 테스트로 통합 검증 (mock 아닌 실제 실행)
- Wrong abstraction level detection: 통합이 잘못된 추상화 수준에서 이루어지는지 감지

**SUNCO 고유 추가:**
- API contract verification: export/import 타입 시그니처 실제 일치 검증 (grep + tsc)
- Dead integration detection: 연결은 있지만 실제 사용되지 않는 통합 감지
- Circular dependency detection: 모듈 간 순환 의존성 자동 감지
