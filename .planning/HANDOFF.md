# SUNCO Handoff — 2026-04-02 (Session 3)

## 현재 상태

**프로젝트**: SUNCO — 에이전트 워크스페이스 OS
**v0.4.1**: npm published as `popcoru`
**브랜치**: main
**GitHub**: https://github.com/kwmin122/sunco-harness
**npm**: https://www.npmjs.com/package/popcoru
**Landing**: https://sunco-smoky.vercel.app/ (Vercel — 수동 배포 필요: `npx vercel --prod --cwd site`)

## 이번 세션 완료

### gstack 기능 흡수 v0.4.0 — 12개 신규 스킬 ✅

**Tier 1 (Security & Safety + Operations):**
| 스킬 | 커맨드 | 워크플로 | 설명 |
|------|--------|----------|------|
| `/sunco:cso` | 44행 | 304행 | OWASP Top 10, STRIDE, 시크릿 탐지, 데이터 분류 |
| `/sunco:careful` | 33행 | 78행 | 파괴적 명령어 경고 (rm -rf, DROP TABLE, force-push) |
| `/sunco:freeze` | 34행 | 76행 | 디렉토리 스코프 잠금 |
| `/sunco:unfreeze` | 30행 | 20행 | freeze 해제 |
| `/sunco:retro` | 49행 | 252행 | 주간 회고 (git 분석, 세션 탐지, 추세 추적) |
| `/sunco:benchmark` | 48행 | 220행 | 빌드/번들/테스트 성능 베이스라인 + 회귀 탐지 |
| `/sunco:land` | 45행 | 232행 | PR 머지 → CI → 배포 → 헬스체크 |

**Tier 2 (Reviews & Monitoring):**
| 스킬 | 커맨드 | 워크플로 | 설명 |
|------|--------|----------|------|
| `/sunco:office-hours` | 41행 | 245행 | 프로젝트 시작 전 구조화 브레인스토밍 |
| `/sunco:ceo-review` | 43행 | 168행 | CEO 관점 플랜 리뷰 (10-star, 전제 도전) |
| `/sunco:eng-review` | 42행 | 176행 | 엔지니어링 리뷰 (아키텍처, 테스트 커버리지 다이어그램) |
| `/sunco:design-review` | 39행 | 166행 | 디자인 차원별 0-10 점수 |
| `/sunco:canary` | 50행 | 197행 | 배포 후 curl 기반 지속 모니터링 |

**추가 변경:**
- `sunco:mode` — Super Saiyan 리디자인 (금색 ki 오라, 블록 문자, 무지개 금지)
- README, help.md, 랜딩 페이지 업데이트 (65 → 77 skills)
- 버전 0.3.2 → 0.4.0 → 0.4.1

**총 +2,632행 신규 콘텐츠 (24개 파일)**

## 최종 수치

| 카테고리 | v0.3.2 | v0.4.1 | 증감 |
|----------|--------|--------|------|
| 커맨드 | 65 | 77 | +12 |
| 워크플로 | 65 | 77 | +12 |
| 전체 라인 | ~57,000 | ~60,870 | +3,870 |
| npm files | 247 | 271 | +24 |
| npm size | 3.3MB | 3.5MB | +0.2MB |

## 다음 세션 작업

### 1. 터미널 하단 상시 상태바 (핵심 신규 기능)

사용자 요청: 터미널 하단에 항상 보이는 상태바
- **대화 컨텍스트 게이지** — 경험치 바처럼 얼마나 찼는지 표시
- **토큰 사용량 게이지** — 옆에 바 형태로 현재 세션 토큰 소비량 표시

구현 방향:
- Claude Code의 statusline API 활용 가능성 조사 (settings.json statusline 설정)
- 또는 hooks를 통한 구현 (PreToolUse/PostToolUse hook에서 토큰 추정)
- 토큰 사용량 추정: 대화 길이 기반 근사치 (정확한 API는 없음)
- 컨텍스트 게이지: 200K window 기준 대화 크기 추정

### 이후
2. **SUN Terminal** — Swift/AppKit + libghostty R&D
3. **gstack Tier 3** — `/sunco:qa`, `/sunco:browse` (SUN Terminal + Playwright)
4. **Codex 실행** — codex-benchmark.cjs 실제 A/B
5. **SUNCO HQ** — bootstrap-hq.sh 실행

## 빌드/배포

```bash
npx turbo build              # 빌드
npx vitest run               # 883 tests
npm publish --workspace=packages/cli --access public  # npm 배포
npx vercel --prod --cwd site  # 랜딩 페이지 배포
```

## 메모

- npm publish 시 브라우저 OTP 인증 필요 (자동 팝업)
- Vercel 자동 배포 안 됨 — `npx vercel --prod --cwd site`로 수동 배포
- GSD 코드 복사 금지 — 개념만 참고, SUNCO 고유 콘텐츠
