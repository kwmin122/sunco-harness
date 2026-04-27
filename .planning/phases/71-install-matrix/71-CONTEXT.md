# Phase 71 Context — Install Matrix

Milestone: M8 Productization Gate
Date: 2026-04-27

## Purpose

Phase 71 broadens release confidence beyond the developer machine. The target
matrix is still conservative: supported Node versions and Unix-like CI
environments for the installed runtime artifact.

## Decisions

- Node 22 is the minimum supported engine; Node 24 is the forward-compatibility
  check.
- Ubuntu and macOS are the release CI operating systems for v0.14.0.
- Windows and alternate package managers are not claimed for v0.14.0.
- The clean HOME artifact smoke is more important than a source-only test count.

## Implemented

- `.github/workflows/ci.yml` runs Node 22 and Node 24 on Ubuntu and macOS.
- The same matrix runs `npm ci`, build, typecheck, tests, lint, format check,
  audit, installed runtime smoke, and release artifact smoke.
- Release artifact smoke creates a clean npm prefix and temp HOME before
  installing Claude, Codex, Cursor, and Antigravity runtime files.

## Scope Boundary

pnpm/yarn/bun and Windows are not release claims for `popcoru@0.14.0`.
If those become product claims, they need their own matrix expansion and
artifact smoke fixtures.
