# ISSUE-003: SUNCO HQ — 두 번째 제품

## 제품 정의

**SUNCO HQ**는 SUNCO 사용자를 위한 웹 대시보드 + 팀 협업 플랫폼이다.

SUNCO CLI가 "로컬에서 에이전트를 제어하는 OS"라면, HQ는 "팀/조직 수준에서 에이전트 워크를 관리하는 본부"다.

## 핵심 기능

### 1. Project Dashboard
- SUNCO 프로젝트의 .planning/ 아티팩트를 시각화
- 페이즈 진행률, 결정 히스토리, 롤백 포인트 타임라인
- STATE.md를 실시간 반영하는 칸반 뷰

### 2. Team View
- 여러 개발자의 SUNCO 세션을 한 화면에서 모니터링
- 누가 어떤 페이즈를 작업 중인지, 에이전트 상태
- 충돌 감지: 같은 파일을 두 에이전트가 동시에 수정하려 할 때 경고

### 3. Agent Analytics
- 에이전트별 성공률, 평균 태스크 완료 시간, 실패 패턴
- 모델별 비용 트래킹 (Claude vs Codex vs Gemini)
- 린트 게이트 통과율, 롤백 빈도

### 4. Knowledge Base
- 프로젝트별 학습된 패턴 자동 수집
- guard가 감지한 반복 위반 → 조직 규칙으로 승격
- 팀 전체에 적용되는 .claude/rules/ 관리

### 5. Benchmark Hub
- codex-benchmark.cjs 결과를 자동 업로드 + 시각화
- 하네스 버전별 성능 추이
- A/B 테스트 결과 아카이브

## 기술 스택

| 기술 | 용도 | 이유 |
|------|------|------|
| Next.js 15 | 프레임워크 | App Router, Server Actions, RSC |
| TypeScript 6 | 언어 | SUNCO와 동일 |
| Tailwind CSS 4 | 스타일링 | Utility-first, 빠른 이터레이션 |
| Drizzle ORM | DB | Type-safe, lightweight |
| PostgreSQL | 데이터베이스 | JSON 지원, full-text search |
| Vercel | 배포 | Next.js 최적화, 이미 사용 중 |
| Auth.js v5 | 인증 | OAuth (GitHub, Google) |
| tRPC | API | End-to-end type safety |

## 데이터 흐름

```
SUNCO CLI (.planning/)
  ↓ git push / webhook
SUNCO HQ (API)
  ↓ parse artifacts
PostgreSQL (structured data)
  ↓ query
Dashboard (React)
```

## MVP 스코프 (v0.1)

**포함:**
- GitHub OAuth 로그인
- 프로젝트 연결 (GitHub repo URL)
- .planning/ 파싱 + 시각화 (페이즈, 상태, 진행률)
- 기본 대시보드 (칸반 뷰)

**미포함 (v0.2+):**
- 팀 기능 (멀티 유저)
- 에이전트 분석
- 실시간 동기화
- Knowledge base

## 레포 구조

```
sunco-hq/
├── .planning/          ← SUNCO로 관리 (GSD 파이프라인)
├── src/
│   ├── app/            ← Next.js App Router
│   │   ├── (auth)/     ← 인증 라우트
│   │   ├── (dashboard)/← 대시보드 라우트
│   │   └── api/        ← tRPC routes
│   ├── components/     ← React 컴포넌트
│   ├── lib/            ← 유틸리티
│   │   ├── parser/     ← .planning/ 파서
│   │   └── db/         ← Drizzle schema + queries
│   └── server/         ← tRPC routers
├── drizzle/            ← Migrations
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## 부트스트랩 순서

1. `gh repo create kwmin122/sunco-hq --private --clone`
2. `cd sunco-hq`
3. `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir`
4. SUNCO 하네스 설치: `npx popcoru`
5. `/sunco:new --prd path/to/this-file.md`
6. 정상 SUNCO 파이프라인 진행: discuss → plan → execute → verify

## 연동 포인트 (SUNCO CLI ↔ HQ)

### CLI → HQ (Push)
```bash
# 향후 sunco-tools.cjs에 추가
sunco-tools.cjs hq-sync --endpoint https://hq.sunco.dev/api/sync
```
- STATE.md 변경 시 자동 푸시
- 페이즈 전환 시 이벤트 발송
- 벤치마크 결과 업로드

### HQ → CLI (Pull)
- 조직 규칙 (.claude/rules/) 다운로드
- 팀 컨벤션 동기화
- 에이전트 모델 프로필 중앙 관리

## 비즈니스 모델

- **Free tier**: 1 프로젝트, 1 유저, 기본 대시보드
- **Pro** ($19/mo): 무제한 프로젝트, 에이전트 분석, 벤치마크
- **Team** ($49/user/mo): 팀 뷰, 충돌 감지, Knowledge base
