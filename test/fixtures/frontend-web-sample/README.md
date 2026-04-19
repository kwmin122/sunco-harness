# frontend-web-sample fixture

Phase 51/M5.2 test fixture. Covers spec §9 L782 requirement:
> small web project fixture, invokes detector, asserts ≥7 Impeccable rules fire

## Structure

- `index.html` — single-page, intentionally antipattern-dense
- `styles.css` — CSS with many quality/slop triggers
- `script.js` — interaction patterns with bounce easing

## Antipatterns intentionally triggered (≥10)

1. `pure-black-white` — `#000` / `#FFF` colors
2. `single-font` — one font-family across all
3. `flat-type-hierarchy` — all headings near-equal size
4. `gradient-text` — `background-clip: text` with gradient
5. `bounce-easing` — `cubic-bezier(...)` overshoot
6. `dark-glow` — dark bg + glowing box-shadow
7. `tiny-text` — `font-size: 10px` body
8. `all-caps-body` — `text-transform: uppercase` on body
9. `tight-leading` — `line-height: 1.1`
10. `cramped-padding` — padding: 2px

Exact fire count depends on Impeccable detector pass; test asserts ≥7 rules fire.

## Usage

See `packages/skills-workflow/src/shared/__tests__/phase51-frontend-web.test.ts`.
